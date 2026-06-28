import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { useTransactionStore, Transaction, FullTransactionItem } from '@/stores/useTransactionStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { format } from 'date-fns';
import NewTransactionScreen from './new';

export default function TransactionDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (id === 'new') {
    return <NewTransactionScreen />;
  }

  const { currentUser } = useAuthStore();
  const { getTransactionDetails, voidTransaction } = useTransactionStore();
  const { customersList } = useCustomerStore();

  const [details, setDetails] = useState<{
    transaction: Transaction;
    items: FullTransactionItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDetails() {
      if (id) {
        setLoading(true);
        const data = await getTransactionDetails(id);
        setDetails(data);
        setLoading(false);
      }
    }
    loadDetails();
  }, [id]);

  const handleVoid = () => {
    if (!details) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Void Transaction',
      `Are you sure you want to VOID this transaction? This action is permanent and will:\n1. Add/Subtract items back to Stock.\n2. Revert any credit outstanding balance for the Customer.\n3. Delete this invoice record.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void Invoice',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const success = await voidTransaction(details.transaction.id);
            setLoading(false);
            if (success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Voided', 'Invoice has been voided and stock reverted.', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } else {
              Alert.alert('Error', 'Failed to void transaction. Check if it would cause negative inventory.');
            }
          },
        },
      ]
    );
  };

  const getCustomerDetails = (customerId: string | null) => {
    if (!customerId) return null;
    return customersList.find(c => c.id === customerId) || null;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={{ marginTop: Spacing.two }}>Loading invoice details...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!details) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ThemedText>Invoice not found.</ThemedText>
          <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: Spacing.two }} />
        </View>
      </SafeAreaView>
    );
  }

  const { transaction, items } = details;
  const isOwner = currentUser?.role === 'owner';
  const customer = getCustomerDetails(transaction.customerId);

  const getTxTypeLabel = (type: string) => {
    switch (type) {
      case 'sale': return { label: 'SALE INVOICE', color: theme.primary, isDeduct: true };
      case 'purchase': return { label: 'PURCHASE INWARD', color: theme.success, isDeduct: false };
      case 'return_in': return { label: 'CUSTOMER RETURN', color: theme.warning, isDeduct: false };
      case 'return_out': return { label: 'SUPPLIER RETURN', color: theme.danger, isDeduct: true };
      case 'payment': return { label: 'REPAYMENT RECEIVED', color: theme.success, isDeduct: false };
      default: return { label: type.toUpperCase(), color: theme.textSecondary, isDeduct: true };
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'partial': return 'warning';
      case 'pending': return 'danger';
      default: return 'neutral';
    }
  };

  const txTypeMeta = getTxTypeLabel(transaction.type);
  const balanceDue = transaction.grandTotal - transaction.amountPaid;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Invoice Header Card */}
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <ThemedText style={[styles.txTypeTitle, { color: txTypeMeta.color }]}>
                {txTypeMeta.label}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.txIdText}>
                ID: {transaction.id}
              </ThemedText>
            </View>
            <Badge label={transaction.paymentStatus} variant={getPaymentStatusBadge(transaction.paymentStatus)} />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

          <View style={styles.metaGrid}>
            <View style={styles.metaCol}>
              <ThemedText type="small" themeColor="textSecondary">Date & Time</ThemedText>
              <ThemedText style={styles.metaValue}>
                {format(new Date(transaction.createdAt), 'dd MMM yyyy, hh:mm a')}
              </ThemedText>
            </View>
            <View style={styles.metaCol}>
              <ThemedText type="small" themeColor="textSecondary">Created By</ThemedText>
              <ThemedText style={styles.metaValue}>
                {transaction.createdByStaffId ? 'Staff / Owner' : 'System'}
              </ThemedText>
            </View>
          </View>
        </Card>

        {/* Customer / Supplier Contact Details */}
        <Card style={styles.entityCard}>
          {transaction.type === 'sale' || transaction.type === 'return_in' || transaction.type === 'payment' ? (
            <View>
              <ThemedText style={styles.sectionTitle}>Customer Billing Details</ThemedText>
              {customer ? (
                <View style={styles.entityInfo}>
                  <ThemedText style={styles.entityName}>{customer.name}</ThemedText>
                  {customer.businessName && (
                    <ThemedText type="small" themeColor="textSecondary">
                      Shop: {customer.businessName}
                    </ThemedText>
                  )}
                  {customer.phone && (
                    <ThemedText type="small" style={{ color: theme.primary, marginTop: 2 }}>
                      Phone: {customer.phone}
                    </ThemedText>
                  )}
                  {customer.address && (
                    <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>
                      Address: {customer.address}
                    </ThemedText>
                  )}
                  {customer.gstNumber && (
                    <ThemedText type="small" style={{ marginTop: 2 }}>
                      GSTIN: <ThemedText type="smallBold">{customer.gstNumber}</ThemedText>
                    </ThemedText>
                  )}
                </View>
              ) : (
                <ThemedText themeColor="textSecondary">Linked customer profile deleted or inactive.</ThemedText>
              )}
            </View>
          ) : (
            <View>
              <ThemedText style={styles.sectionTitle}>Supplier Details</ThemedText>
              <ThemedText style={styles.entityName}>
                {transaction.supplierName || 'Unknown Supplier'}
              </ThemedText>
            </View>
          )}
        </Card>

        {/* Itemized Cart List */}
        {transaction.type !== 'payment' && (
          <Card style={styles.cartCard}>
            <ThemedText style={styles.sectionTitle}>Itemized Cart Products</ThemedText>
            
            <View style={styles.cartHeader}>
              <ThemedText type="smallBold" style={{ flex: 2 }}>Item Description</ThemedText>
              <ThemedText type="smallBold" style={{ width: 60, textAlign: 'center' }}>Qty</ThemedText>
              <ThemedText type="smallBold" style={{ width: 80, textAlign: 'right' }}>Total</ThemedText>
            </View>
            
            <View style={[styles.dividerMini, { backgroundColor: theme.backgroundSelected }]} />

            {items.map((item) => (
              <View key={item.id} style={styles.cartRow}>
                <View style={{ flex: 2 }}>
                  <ThemedText style={styles.itemName}>{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    ₹{item.unitPrice.toFixed(2)} / unit
                  </ThemedText>
                </View>
                <ThemedText style={styles.itemQty}>{item.quantity}</ThemedText>
                <ThemedText style={styles.itemTotal}>₹{item.lineTotal.toFixed(2)}</ThemedText>
              </View>
            ))}
          </Card>
        )}

        {/* Financial Breakdown */}
        <Card style={styles.financialCard}>
          <ThemedText style={styles.sectionTitle}>Invoice Calculation Summary</ThemedText>

          <View style={styles.calcRow}>
            <ThemedText type="small" themeColor="textSecondary">Cart Subtotal</ThemedText>
            <ThemedText style={styles.calcVal}>₹{transaction.subtotal.toFixed(2)}</ThemedText>
          </View>

          {transaction.discount > 0 && (
            <View style={styles.calcRow}>
              <ThemedText type="small" themeColor="textSecondary">Discount Applied</ThemedText>
              <ThemedText style={[styles.calcVal, { color: theme.success }]}>
                - ₹{transaction.discount.toFixed(2)}
              </ThemedText>
            </View>
          )}

          {transaction.taxAmount > 0 && (
            <View style={styles.calcRow}>
              <ThemedText type="small" themeColor="textSecondary">GST Tax Amount</ThemedText>
              <ThemedText style={styles.calcVal}>₹{transaction.taxAmount.toFixed(2)}</ThemedText>
            </View>
          )}

          <View style={[styles.dividerMini, { backgroundColor: theme.backgroundSelected }]} />

          <View style={styles.calcRow}>
            <ThemedText type="smallBold">Grand Total</ThemedText>
            <ThemedText style={[styles.calcVal, { fontSize: 18, color: theme.primary, fontWeight: '900' }]}>
              ₹{transaction.grandTotal.toFixed(2)}
            </ThemedText>
          </View>

          <View style={styles.calcRow}>
            <ThemedText type="smallBold">Amount Paid</ThemedText>
            <ThemedText style={[styles.calcVal, { color: theme.success, fontWeight: '700' }]}>
              ₹{transaction.amountPaid.toFixed(2)}
            </ThemedText>
          </View>

          {transaction.paymentMode && (
            <View style={styles.calcRow}>
              <ThemedText type="small" themeColor="textSecondary">Payment Mode</ThemedText>
              <ThemedText style={[styles.calcVal, { textTransform: 'uppercase' }]}>
                {transaction.paymentMode}
              </ThemedText>
            </View>
          )}

          {balanceDue > 0 && (
            <View style={[styles.dueBox, { backgroundColor: theme.danger + '1A' }]}>
              <ThemedText style={{ color: theme.danger, fontWeight: 'bold' }}>
                Unpaid Balance Due: ₹{balanceDue.toFixed(2)}
              </ThemedText>
            </View>
          )}
        </Card>

        {/* Transaction Memo Notes */}
        {transaction.notes ? (
          <Card style={styles.notesCard}>
            <ThemedText style={styles.sectionTitle}>Invoice Memo</ThemedText>
            <ThemedText style={styles.notesText}>{transaction.notes}</ThemedText>
          </Card>
        ) : null}

        {/* Void Button (Owner-only) */}
        {isOwner && (
          <Button
            title="Void Invoice"
            variant="danger"
            onPress={handleVoid}
            style={styles.btnVoid}
          />
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
  headerCard: {
    marginBottom: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  txTypeTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  txIdText: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.three,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaCol: {
    flex: 1,
  },
  metaValue: {
    fontWeight: '700',
    fontSize: 14,
    marginTop: 2,
  },
  entityCard: {
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  entityInfo: {
    gap: 2,
  },
  entityName: {
    fontSize: 16,
    fontWeight: '800',
  },
  cartCard: {
    marginBottom: Spacing.three,
  },
  cartHeader: {
    flexDirection: 'row',
    paddingBottom: 4,
  },
  dividerMini: {
    height: 1,
    marginVertical: Spacing.one,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemQty: {
    width: 60,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  itemTotal: {
    width: 80,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
  },
  financialCard: {
    marginBottom: Spacing.three,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  calcVal: {
    fontSize: 14,
    fontWeight: '600',
  },
  dueBox: {
    padding: Spacing.two,
    borderRadius: Spacing.one,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  notesCard: {
    marginBottom: Spacing.three,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  btnVoid: {
    marginTop: Spacing.two,
  },
});
