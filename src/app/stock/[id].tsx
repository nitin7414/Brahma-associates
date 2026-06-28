import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { useStockStore, StockItem, LinkedTransaction } from '@/stores/useStockStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { hasPermission } from '@/lib/permissions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { format } from 'date-fns';
import EditStockScreen from './edit';

export default function StockDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (id === 'edit') {
    return <EditStockScreen />;
  }

  const { currentUser } = useAuthStore();
  const { items, deactivateStockItem, getItemTransactions } = useStockStore();

  const [item, setItem] = useState<StockItem | null>(null);
  const [history, setHistory] = useState<LinkedTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Reload item details
  useEffect(() => {
    if (id) {
      const found = items.find((i) => i.id === id);
      if (found) {
        setItem(found);
      } else {
        setItem(null);
      }
    }
  }, [id, items]);

  // Load transaction history
  useEffect(() => {
    async function loadHistory() {
      if (id) {
        setLoading(true);
        const txs = await getItemTransactions(id);
        setHistory(txs);
        setLoading(false);
      }
    }
    loadHistory();
  }, [id, items]);

  const handleDelete = () => {
    if (!item) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Remove Stock Item',
      `Are you sure you want to deactivate "${item.name}"? This item will be hidden from the catalog, but transaction history will remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const success = await deactivateStockItem(item.id);
            if (success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } else {
              Alert.alert('Error', 'Failed to deactivate stock item.');
            }
          },
        },
      ]
    );
  };

  if (!item) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ThemedText>Item not found.</ThemedText>
          <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: Spacing.two }} />
        </View>
      </SafeAreaView>
    );
  }

  const isLowStock = item.quantity <= item.lowStockThreshold;
  const isOutOfStock = item.quantity === 0;
  const isOwner = currentUser?.role === 'owner';

  // Profit calculations
  const cost = item.costPrice || 0;
  const sell = item.sellingPrice || 0;
  const profit = sell - cost;
  const marginPct = sell > 0 ? ((profit / sell) * 100).toFixed(1) : '0';

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'sale': return { label: 'Sale', color: theme.danger, icon: 'arrow.down.right.circle.fill' };
      case 'purchase': return { label: 'Purchase', color: theme.success, icon: 'arrow.up.left.circle.fill' };
      case 'return_in': return { label: 'Customer Return', color: theme.primary, icon: 'arrow.left.circle.fill' };
      case 'return_out': return { label: 'Supplier Return', color: theme.textSecondary, icon: 'arrow.right.circle.fill' };
      default: return { label: type, color: theme.textSecondary, icon: 'circle.fill' };
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Upper Card: Details & Photo */}
        <Card style={styles.detailCard}>
          <View style={styles.headerRow}>
            <View style={[styles.imageWrapper, { backgroundColor: theme.backgroundElement }]}>
              {item.photoUri ? (
                <Image source={{ uri: item.photoUri }} style={styles.image} />
              ) : (
                <SymbolView
                  name={{
                    ios: item.category === 'scale' ? 'scalemass.fill' : 'gearshape.fill',
                    android: item.category === 'scale' ? 'square' : 'settings',
                    web: 'gear',
                  } as any}
                  size={50}
                  tintColor={theme.textSecondary}
                />
              )}
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.titleRow}>
                <ThemedText style={styles.titleText}>{item.name}</ThemedText>
                {item.brand && <Badge label={item.brand} variant="info" />}
              </View>
              <ThemedText themeColor="textSecondary" style={styles.categoryText}>
                Category: {item.category.toUpperCase().replace('_', ' ')}
              </ThemedText>
              {item.capacityLabel && (
                <ThemedText type="small" themeColor="textSecondary">
                  Capacity: {item.capacityLabel}
                </ThemedText>
              )}
              {item.variant && (
                <ThemedText type="small" themeColor="textSecondary">
                  Variant: {item.variant}
                </ThemedText>
              )}
            </View>
          </View>

          {/* Quick stock counts */}
          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
          
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <ThemedText type="small" themeColor="textSecondary">Current Stock</ThemedText>
              <ThemedText 
                style={[
                  styles.statNumber,
                  isOutOfStock && { color: theme.danger },
                  !isOutOfStock && isLowStock && { color: theme.warning },
                ]}
              >
                {item.quantity} units
              </ThemedText>
            </View>
            <View style={styles.statCol}>
              <ThemedText type="small" themeColor="textSecondary">Low Stock Trigger</ThemedText>
              <ThemedText style={styles.statSubNumber}>{item.lowStockThreshold} units</ThemedText>
            </View>
          </View>
        </Card>

        {/* Pricing details card */}
        <Card style={styles.priceCard}>
          <ThemedText style={styles.cardSectionTitle}>Pricing </ThemedText>
          <View style={styles.priceGrid}>
            <View style={styles.priceBlock}>
              <ThemedText type="small" themeColor="textSecondary">Selling Price</ThemedText>
              <ThemedText style={[styles.priceNumber, { color: theme.primary }]}>₹{sell.toFixed(2)}</ThemedText>
            </View>
            {isOwner && (
              <View style={styles.priceBlock}>
                <ThemedText type="small" themeColor="textSecondary">Cost Price</ThemedText>
                <ThemedText style={[styles.priceNumber, { color: theme.primary }]}>₹{cost.toFixed(2)}</ThemedText>
              </View>
            )}
          </View>
          
          {isOwner && profit > 0 && (
            <View style={[styles.marginRow, { backgroundColor: theme.success + '1A' }]}>
            </View>
          )}
        </Card>

        {/* Notes */}
        {item.notes ? (
          <Card style={styles.notesCard}>
            <ThemedText style={styles.cardSectionTitle}>Notes</ThemedText>
            <ThemedText style={styles.notesText}>{item.notes}</ThemedText>
          </Card>
        ) : null}

        {/* Action Row */}
        <View style={styles.actionRow}>
          <Button
            title="Edit Details"
            variant="secondary"
            onPress={() => router.push(`/stock/edit?id=${item.id}`)}
            style={{ flex: 1 }}
          />
          {isOwner && (
            <Button
              title="Deactivate"
              variant="danger"
              onPress={handleDelete}
              style={{ flex: 1 }}
            />
          )}
        </View>

        {/* Chronological Transaction Timeline */}
        <ThemedText style={styles.historySectionTitle}>Stock Ledger History</ThemedText>
        
        {loading ? (
          <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: Spacing.two }} />
        ) : history.length === 0 ? (
          <View style={[styles.emptyHistory, { backgroundColor: theme.backgroundElement }]}>
            <SymbolView name={{ ios: 'clock.badge.exclamationmark', android: 'history', web: 'history' }} size={24} tintColor={theme.textSecondary} />
            <ThemedText style={styles.emptyHistoryText} themeColor="textSecondary">
              No transactions have touched this item yet. Purchase or Sell to see logs.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {history.map((tx, idx) => {
              const txMeta = getTransactionTypeLabel(tx.type);
              const isAddition = tx.type === 'purchase' || tx.type === 'return_in';
              const sign = isAddition ? '+' : '-';
              
              return (
                <TouchableOpacity
                  key={tx.transactionId + idx}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/transactions/${tx.transactionId}`)}
                  style={[styles.timelineCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                >
                  <View style={styles.timelineHeader}>
                    <View style={styles.timelineType}>
                      <SymbolView name={{ ios: txMeta.icon as any, android: 'circle', web: 'circle' }} size={16} tintColor={txMeta.color} />
                      <ThemedText style={[styles.timelineTypeLabel, { color: txMeta.color }]}>
                        {txMeta.label}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {format(new Date(tx.createdAt), 'dd MMM yyyy, hh:mm a')}
                    </ThemedText>
                  </View>

                  <View style={styles.timelineDetails}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {tx.type === 'purchase' || tx.type === 'return_out'
                        ? `Supplier: ${tx.supplierName || 'N/A'}`
                        : `Customer: ${tx.customerName || 'N/A'}`}
                    </ThemedText>

                    <View style={styles.timelineQtyCol}>
                      <ThemedText 
                        style={[
                          styles.timelineQty,
                          { color: isAddition ? theme.success : theme.danger }
                        ]}
                      >
                        {sign}{tx.quantity} units
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        @ ₹{tx.unitPrice}
                      </ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  scrollContainer: {
    padding: Spacing.four,
    paddingBottom: 120,
  },
  detailCard: {
    marginBottom: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  imageWrapper: {
    width: 90,
    height: 90,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.three,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  statSubNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  priceCard: {
    marginBottom: Spacing.three,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  priceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  priceBlock: {
    flex: 1,
  },
  priceNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  marginRow: {
    padding: Spacing.two,
    borderRadius: Spacing.one,
    alignItems: 'center',
  },
  notesCard: {
    marginBottom: Spacing.three,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  historySectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: Spacing.two,
  },
  emptyHistory: {
    padding: Spacing.four,
    borderRadius: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  emptyHistoryText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  timelineContainer: {
    gap: Spacing.two,
  },
  timelineCard: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    padding: Spacing.three,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  timelineType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineTypeLabel: {
    fontWeight: '700',
    fontSize: 13,
  },
  timelineDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  timelineQtyCol: {
    alignItems: 'flex-end',
  },
  timelineQty: {
    fontSize: 15,
    fontWeight: '800',
  },
});
