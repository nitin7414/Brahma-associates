import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/useAuthStore';
import { useStockStore } from '@/stores/useStockStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { syncWithCloud } from '@/lib/sync';
import { exportSilentBackup } from '@/lib/backup';
import { ThemedText } from '@/components/themed-text';
import { Card, Badge } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { format, startOfDay, startOfWeek, startOfMonth, isAfter, differenceInDays } from 'date-fns';

export default function DashboardScreen() {
  const router = useRouter();
  const theme = useTheme();

  // Stores
  const { currentUser, logout } = useAuthStore();
  const { items: stockItems, loadStock } = useStockStore();
  const { customersList, loadCustomers } = useCustomerStore();
  const { transactionsList, loadTransactions } = useTransactionStore();
  const { settings } = useSettingsStore();

  const lastBackup = settings.lastBackupDate;
  const daysSinceBackup = lastBackup ? differenceInDays(new Date(), new Date(lastBackup)) : null;
  const needsBackupReminder = lastBackup === null || (daysSinceBackup !== null && daysSinceBackup >= 7);

  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    refreshData();
    // Auto-backup in background if it's been more than 7 days
    if (lastBackup === null || (daysSinceBackup !== null && daysSinceBackup >= 7)) {
      exportSilentBackup()
        .then((uri) => {
          if (uri) console.log('[AutoBackup] Background backup completed!');
        })
        .catch((err) => console.error('[AutoBackup] Background backup error:', err));
    }
  }, []);

  const refreshData = async () => {
    setRefreshing(true);
    if (settings.backendUrl) {
      try {
        await syncWithCloud();
      } catch (e) {
        console.warn('Background sync failed on refresh:', e);
      }
    }
    await Promise.all([
      loadStock(),
      loadCustomers(),
      loadTransactions(),
    ]);
    setRefreshing(false);
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await syncWithCloud();
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const added = res.addedCount ?? 0;
        const updated = res.updatedCount ?? 0;
        const deleted = res.deletedCount ?? 0;
        Alert.alert(
          'Sync Successful',
          `Cloud database synchronized.\n- Downloaded: ${added}\n- Updated: ${updated}\n- Deleted: ${deleted}`
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Sync Failed', res.error || 'Server error occurred.');
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sync Error', err.message || 'Failed to connect to the server.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Logout', 'Are you sure you want to end your session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() }
    ]);
  };

  const isOwner = currentUser?.role === 'owner';

  // 1. Calculations: Stock metrics
  const totalSKUs = stockItems.length;
  const totalUnits = stockItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAssetValue = stockItems.reduce((sum, item) => sum + item.quantity * (item.costPrice || 0), 0);

  // 2. Calculations: Low Stock Alerts
  const lowStockAlerts = stockItems
    .filter((item) => item.quantity <= item.lowStockThreshold)
    .sort((a, b) => {
      if (a.quantity === 0 && b.quantity > 0) return -1;
      if (b.quantity === 0 && a.quantity > 0) return 1;
      return a.quantity - b.quantity;
    });

  // 3. Calculations: Revenue snap (Owner only)
  const salesTransactions = transactionsList.filter(tx => tx.type === 'sale');
  
  const todayStart = startOfDay(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const monthStart = startOfMonth(new Date());

  const todayRevenue = salesTransactions
    .filter(tx => isAfter(new Date(tx.createdAt), todayStart))
    .reduce((sum, tx) => sum + tx.grandTotal, 0);

  const weekRevenue = salesTransactions
    .filter(tx => isAfter(new Date(tx.createdAt), weekStart))
    .reduce((sum, tx) => sum + tx.grandTotal, 0);

  const monthRevenue = salesTransactions
    .filter(tx => isAfter(new Date(tx.createdAt), monthStart))
    .reduce((sum, tx) => sum + tx.grandTotal, 0);

  // Recent transactions list
  const recentTransactions = transactionsList.slice(0, 8);

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return 'N/A';
    const c = customersList.find(cust => cust.id === customerId);
    return c ? c.name : 'Unknown Customer';
  };

  const getTxBadge = (type: string) => {
    switch (type) {
      case 'sale': return { label: 'SALE', variant: 'info' as const };
      case 'purchase': return { label: 'BUY', variant: 'success' as const };
      case 'return_in': return { label: 'RET IN', variant: 'warning' as const };
      case 'payment': return { label: 'PAYMENT', variant: 'success' as const };
      default: return { label: 'RET OUT', variant: 'danger' as const };
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Header controls */}
      <View style={[styles.dashboardHeader, { borderBottomColor: theme.backgroundSelected }]}>
        <View style={{   
          flex: 1,
          
        }}>
          <ThemedText themeColor="textSecondary" style={styles.welcomeLabel}>
            NAMASTE,
          </ThemedText>
          <ThemedText type="subtitle" style={styles.welcomeName}>
            {currentUser?.name || 'Staff User'}
          </ThemedText>
          {settings.lastSyncTimestamp > 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10, marginTop: 1 }}>
              Synced: {format(new Date(settings.lastSyncTimestamp), 'dd MMM, hh:mm a')}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10, marginTop: 1 }}>
              Not Synced Yet
            </ThemedText>
          )}
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: theme.backgroundElement }]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <SymbolView name={{ ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' } as any} size={18} tintColor={theme.text} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: theme.backgroundElement }]}
            onPress={() => router.push('/search')}
          >
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={18} tintColor={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: theme.danger + '12' }]}
            onPress={handleLogout}
          >
            <SymbolView name={{ ios: 'power', android: 'exit_to_app', web: 'logout' }} size={18} tintColor={theme.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshData} colors={[theme.primary]} />
        }
      >
        {/* Quick Action Buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.push('/transactions/new?type=sale')}
          >
            <SymbolView name={{ ios: 'cart.badge.plus', android: 'add_shopping_cart', web: 'plus' } as any} size={20} tintColor="#FFFFFF" />
            <ThemedText style={styles.actionBtnText}>New Sale</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, borderWidth: 1 }]}
            onPress={() => router.push('/stock/edit')}
          >
            <SymbolView name={{ ios: 'plus.square.fill', android: 'add_box', web: 'add' } as any} size={20} tintColor={theme.primary} />
            <ThemedText style={[styles.actionBtnText, { color: theme.text }]}>Add Stock</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, borderWidth: 1 }]}
            onPress={() => router.push('/customers/edit')}
          >
            <SymbolView name={{ ios: 'person.badge.plus.fill', android: 'person_add', web: 'person' } as any} size={20} tintColor={theme.primary} />
            <ThemedText style={[styles.actionBtnText, { color: theme.text }]}>Add Customer</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Live Stock Summary Widget */}
        <Card style={styles.summaryCard}>
          <ThemedText style={styles.widgetTitle}>Live Inventory Status</ThemedText>
          <View style={styles.metricsGrid}>
            <View style={[styles.metricBlock, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
              <View style={[styles.metricIconWrap, { backgroundColor: theme.primary + '15' }]}>
                <SymbolView name={{ ios: 'shippingbox.fill', android: 'inventory', web: 'inventory' }} size={16} tintColor={theme.primary} />
              </View>
              <ThemedText style={styles.metricValue}>{totalSKUs}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.metricLabel}>Total Stock Items</ThemedText>
            </View>
            
            <View style={[styles.metricBlock, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
              <View style={[styles.metricIconWrap, { backgroundColor: theme.success + '15' }]}>
                <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} size={16} tintColor={theme.success} />
              </View>
              <ThemedText style={styles.metricValue}>{totalUnits}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.metricLabel}>Total Units</ThemedText>
            </View>

            {isOwner && (
              <View style={[styles.metricBlock, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
                <View style={[styles.metricIconWrap, { backgroundColor: theme.warning + '15' }]}>
                  <SymbolView name={{ ios: 'indianrupeesign.circle', android: 'payments', web: 'payments' }} size={16} tintColor={theme.warning} />
                </View>
                <ThemedText style={[styles.metricValue, { color: theme.primary }]}>
                  ₹{totalAssetValue >= 100000 ? `${(totalAssetValue / 100000).toFixed(2)}L` : totalAssetValue.toLocaleString('en-IN')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.metricLabel}>Stock Value</ThemedText>
              </View>
            )}
          </View>
        </Card>

        {/* Revenue Snapshots (Owner Only) */}
        {isOwner && (
          <Card style={styles.revenueCard}>
            <ThemedText style={styles.widgetTitle}>Revenue Snapshots</ThemedText>
            <View style={styles.revenueGrid}>
              <View style={[styles.revenueBlock, { borderRightColor: theme.backgroundSelected, borderRightWidth: 1 }]}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.revenueLabel}>Today</ThemedText>
                <ThemedText style={[styles.revenueVal, { color: theme.success }]}>₹{todayRevenue.toLocaleString('en-IN')}</ThemedText>
              </View>
              <View style={[styles.revenueBlock, { borderRightColor: theme.backgroundSelected, borderRightWidth: 1 }]}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.revenueLabel}>This Week</ThemedText>
                <ThemedText style={[styles.revenueVal, { color: theme.success }]}>₹{weekRevenue.toLocaleString('en-IN')}</ThemedText>
              </View>
              <View style={styles.revenueBlock}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.revenueLabel}>This Month</ThemedText>
                <ThemedText style={[styles.revenueVal, { color: theme.success }]}>₹{monthRevenue.toLocaleString('en-IN')}</ThemedText>
              </View>
            </View>
          </Card>
        )}

        {/* Low Stock Alerts Ticker Widget */}
        <View style={styles.alertsSection}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.widgetTitle}>Low Stock Alerts</ThemedText>
            {lowStockAlerts.length > 0 && (
              <Badge label={`${lowStockAlerts.length} Warnings`} variant="danger" />
            )}
          </View>

          {lowStockAlerts.length === 0 ? (
            <Card style={styles.noAlertsCard}>
              <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'check_circle', web: 'check' }} size={16} tintColor={theme.success} />
              <ThemedText type="small" themeColor="textSecondary" style={{ marginLeft: 8, fontWeight: '600' }}>
                All inventory quantities are healthy.
              </ThemedText>
            </Card>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.alertsScroll}
            >
              {lowStockAlerts.map((item) => {
                const isOut = item.quantity === 0;
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    style={[
                      styles.alertCard,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                      isOut ? { borderColor: theme.danger, borderLeftWidth: 3 } : { borderColor: theme.warning, borderLeftWidth: 3 },
                    ]}
                    onPress={() => router.push(`/stock/${item.id}`)}
                  >
                    <ThemedText style={styles.alertName} numberOfLines={1}>
                      {item.name}
                    </ThemedText>
                    <View style={styles.alertMeta}>
                      <ThemedText 
                        style={[
                          styles.alertQty,
                          { color: isOut ? theme.danger : theme.warning }
                        ]}
                      >
                        {isOut ? 'OUT OF STOCK' : `${item.quantity} Left`}
                      </ThemedText>
                      <ThemedText type="code" style={{ fontSize: 10 }} themeColor="textSecondary">
                        Limit: {item.lowStockThreshold}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Top 8 Recent Transactions Ledger */}
        <View style={styles.transactionsSection}>
          <ThemedText style={styles.widgetTitle}>Recent Transactions</ThemedText>
          
          {recentTransactions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '500' }}>
                No transactions recorded yet. Click "New Sale" to begin.
              </ThemedText>
            </Card>
          ) : (
            recentTransactions.map((tx) => {
              const txMeta = getTxBadge(tx.type);
              const client = tx.type === 'purchase' || tx.type === 'return_out'
                ? tx.supplierName || 'Unknown Supplier'
                : getCustomerName(tx.customerId);

              return (
                <TouchableOpacity
                  key={tx.id}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/transactions/${tx.id}`)}
                  style={[
                    styles.txListItem,
                    { backgroundColor: theme.backgroundElement, borderBottomColor: theme.backgroundSelected },
                  ]}
                >
                  <View style={styles.txListLeft}>
                    <Badge label={txMeta.label} variant={txMeta.variant} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.txListClient} numberOfLines={1}>{client}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: 1 }}>
                        {format(new Date(tx.createdAt), 'dd MMM, hh:mm a')}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.txListRight}>
                    <ThemedText style={[styles.txListTotal, { color: theme.primary }]}>₹{tx.grandTotal.toFixed(2)}</ThemedText>
                    <ThemedText type="code" style={{ fontSize: 9, textTransform: 'uppercase', marginTop: 1, fontWeight: '700' }} themeColor="textSecondary">
                      {tx.paymentStatus}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  welcomeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  welcomeName: {
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: -0.2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    padding: Spacing.three,
    paddingBottom: 120,
    gap: Spacing.three,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionBtn: {
    flex: 1,
    height: 70,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryCard: {
    padding: Spacing.three,
  },
  widgetTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.three,
    opacity: 0.8,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metricBlock: {
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  revenueCard: {
    padding: Spacing.three,
  },
  revenueGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  revenueBlock: {
    alignItems: 'center',
    flex: 1,
  },
  revenueLabel: {
    fontWeight: '600',
    fontSize: 11,
  },
  revenueVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  alertsSection: {
    gap: Spacing.two,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noAlertsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
  },
  alertsScroll: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: 2,
  },
  alertCard: {
    width: 140,
    borderRadius: 12,
    padding: Spacing.two,
    borderWidth: 1,
    gap: Spacing.one,
    marginRight: Spacing.one,
  },
  alertName: {
    fontSize: 13,
    fontWeight: '700',
  },
  alertMeta: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 2,
  },
  alertQty: {
    fontSize: 11,
    fontWeight: '800',
  },
  transactionsSection: {
    gap: Spacing.two,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  txListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    marginBottom: 6,
  },
  txListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.2,
  },
  txListClient: {
    fontSize: 14,
    fontWeight: '700',
  },
  txListRight: {
    alignItems: 'flex-end',
    flex: 0.8,
  },
  txListTotal: {
    fontSize: 14,
    fontWeight: '800',
  },
  reminderBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    gap: 6,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reminderTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reminderText: {
    lineHeight: 18,
    fontWeight: '500',
  },
});
