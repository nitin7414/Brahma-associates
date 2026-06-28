import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Share,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { useCustomerStore, Customer, CustomerTransaction } from '@/stores/useCustomerStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { format } from 'date-fns';
import EditCustomerScreen from './edit';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (id === 'edit') {
    return <EditCustomerScreen />;
  }

  const { currentUser } = useAuthStore();
  const { customersList, deactivateCustomer, getCustomerTransactions } = useCustomerStore();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<CustomerTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Dues repayment state
  const [isPayModalVisible, setIsPayModalVisible] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMode, setRepayMode] = useState<'cash' | 'upi' | 'bank'>('upi');
  const [repayNotes, setRepayNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const handleSubmitRepayment = async () => {
    if (!customer) return;
    const amount = parseFloat(repayAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (amount > customer.outstandingBalance) {
      Alert.alert(
        'Excess Payment',
        `The amount entered (₹${amount}) exceeds the customer's outstanding debt of ₹${customer.outstandingBalance.toFixed(2)}. Please adjust the amount.`
      );
      return;
    }

    setIsSubmittingPayment(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await useTransactionStore.getState().createRepayment({
        customerId: customer.id,
        amount,
        paymentMode: repayMode,
        createdByStaffId: currentUser?.id || null,
        notes: repayNotes.trim() || 'Outstanding dues repayment',
      });

      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Payment Recorded', `Successfully received payment of ₹${amount.toFixed(2)}.`);
        
        // Refresh local history and customer list
        const txs = await getCustomerTransactions(customer.id);
        setHistory(txs);
        
        setIsPayModalVisible(false);
        setRepayAmount('');
        setRepayNotes('');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', res.error || 'Failed to record payment.');
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Load customer details
  useEffect(() => {
    if (id) {
      const found = customersList.find((c) => c.id === id);
      if (found) {
        setCustomer(found);
      } else {
        setCustomer(null);
      }
    }
  }, [id, customersList]);

  // Load transaction history
  useEffect(() => {
    async function loadHistory() {
      if (id) {
        setLoading(true);
        const txs = await getCustomerTransactions(id);
        setHistory(txs);
        setLoading(false);
      }
    }
    loadHistory();
  }, [id, customersList]);

  const handleCall = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = `tel:${phone}`;
    Linking.openURL(url).catch(err => console.error('Call failed:', err));
  };

  const handleOpenMaps = (addr: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(addr)}`,
      android: `geo:0,0?q=${encodeURIComponent(addr)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`,
    });
    Linking.openURL(url).catch(err => console.error('Maps failed:', err));
  };

  const handleShareStatement = () => {
    if (!customer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const dateStr = format(new Date(), 'dd-MM-yyyy');
    const statementText = `Brahma Associates - Account Statement
Date: ${dateStr}
Customer Name: ${customer.name}
${customer.businessName ? `Shop: ${customer.businessName}\n` : ''}Outstanding Balance: ₹${customer.outstandingBalance.toFixed(2)}
Please settle any pending dues. Thank you!`;

    Share.share({
      message: statementText,
      title: 'Share Account Statement',
    }).catch(err => console.error('Share failed:', err));
  };

  const handleDelete = () => {
    if (!customer) return;

    // Check outstanding balance
    if (customer.outstandingBalance > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Cannot Deactivate',
        `This customer has an outstanding balance of ₹${customer.outstandingBalance.toFixed(2)}. Dues must be fully cleared (₹0.00) before deactivating the profile.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Deactivate Customer Profile',
      `Are you sure you want to deactivate "${customer.name}"? Historical transactions will remain saved in database.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            const success = await deactivateCustomer(customer.id);
            if (success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace('/customers');
            } else {
              Alert.alert('Error', 'Failed to deactivate customer.');
            }
          },
        },
      ]
    );
  };

  if (!customer) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ThemedText>Customer not found.</ThemedText>
          <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: Spacing.two }} />
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = currentUser?.role === 'owner';
  const hasBalance = customer.outstandingBalance > 0;

  const getPaymentBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'partial': return 'warning';
      case 'pending': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Details */}
        <Card style={styles.profileCard}>
          <View style={styles.headerRow}>
            {/* Avatar */}
            <View style={[styles.avatarWrapper, { backgroundColor: theme.backgroundElement }]}>
              {customer.photoUri ? (
                <Image source={{ uri: customer.photoUri }} style={styles.avatar} />
              ) : (
                <SymbolView
                  name={{ ios: 'person.crop.circle.fill', android: 'person', web: 'person' }}
                  size={54}
                  tintColor={theme.textSecondary}
                />
              )}
            </View>

            {/* Info */}
            <View style={styles.headerInfo}>
              <ThemedText style={styles.nameText}>{customer.name}</ThemedText>
              {customer.businessName && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.shopText}>
                  Shop: {customer.businessName}
                </ThemedText>
              )}
              {customer.gstNumber && (
                <View style={styles.gstRow}>
                  <ThemedText type="small" themeColor="textSecondary">GST: </ThemedText>
                  <ThemedText type="smallBold">{customer.gstNumber}</ThemedText>
                </View>
              )}
            </View>
          </View>

          {/* Contact Actions */}
          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
          
          <View style={styles.contactDetails}>
            {customer.phone && (
              <TouchableOpacity
                onPress={() => handleCall(customer.phone!)}
                style={styles.contactRow}
              >
                <SymbolView name={{ ios: 'phone.fill', android: 'call', web: 'phone' }} size={16} tintColor={theme.primary} />
                <ThemedText type="small" style={[styles.contactLinkText, { color: theme.primary }]}>{customer.phone}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.contactLabel}>(Primary)</ThemedText>
              </TouchableOpacity>
            )}
            
            {customer.altPhone && (
              <TouchableOpacity
                onPress={() => handleCall(customer.altPhone!)}
                style={styles.contactRow}
              >
                <SymbolView name={{ ios: 'phone.fill', android: 'call', web: 'phone' }} size={16} tintColor={theme.primary} />
                <ThemedText type="small" style={[styles.contactLinkText, { color: theme.primary }]}>{customer.altPhone}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.contactLabel}>(Alternate)</ThemedText>
              </TouchableOpacity>
            )}

            {customer.address && (
              <TouchableOpacity
                onPress={() => handleOpenMaps(customer.address!)}
                style={styles.contactRow}
              >
                <SymbolView name={{ ios: 'mappin.and.ellipse', android: 'map', web: 'map' }} size={16} tintColor={theme.primary} />
                <ThemedText type="small" style={[styles.contactLinkText, { flex: 1, color: theme.primary }]}>
                  {customer.address}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Scale Details Card */}
        {(customer.purchasedScaleName || customer.model || customer.sellingPrice !== null || customer.gstCharged !== null) ? (
          <Card style={styles.scaleCard}>
            <ThemedText style={styles.sectionTitle}>Purchased Scale Details</ThemedText>
            <View style={styles.scaleGrid}>
              {customer.purchasedScaleName && (
                <View style={styles.scaleDetailRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.scaleDetailLabel}>Scale Name</ThemedText>
                  <ThemedText style={styles.scaleDetailValue}>{customer.purchasedScaleName}</ThemedText>
                </View>
              )}
              {customer.model && (
                <View style={styles.scaleDetailRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.scaleDetailLabel}>Model</ThemedText>
                  <ThemedText style={styles.scaleDetailValue}>{customer.model}</ThemedText>
                </View>
              )}
              {customer.sellingPrice !== null && (
                <View style={styles.scaleDetailRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.scaleDetailLabel}>Base Selling Price</ThemedText>
                  <ThemedText style={[styles.scaleDetailValue, { fontWeight: '700' }]}>₹{customer.sellingPrice.toFixed(2)}</ThemedText>
                </View>
              )}
              {customer.gstCharged !== null && (
                <View style={styles.scaleDetailRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.scaleDetailLabel}>GST Charged</ThemedText>
                  <ThemedText style={styles.scaleDetailValue}>{customer.gstCharged}%</ThemedText>
                </View>
              )}
              {customer.sellingPrice !== null && customer.gstCharged !== null && (
                <>
                  <View style={styles.scaleDetailRow}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.scaleDetailLabel}>GST Tax Amount</ThemedText>
                    <ThemedText style={[styles.scaleDetailValue, { color: theme.warning }]}>₹{(customer.sellingPrice * (customer.gstCharged / 100)).toFixed(2)}</ThemedText>
                  </View>
                  <View style={[styles.scaleDetailRow, { borderBottomWidth: 0, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderColor: theme.backgroundSelected }]}>
                    <ThemedText type="smallBold" style={styles.scaleDetailLabel}>Total (with GST added)</ThemedText>
                    <ThemedText style={[styles.scaleDetailValue, { color: theme.success, fontSize: 16, fontWeight: '900' }]}>₹{(customer.sellingPrice * (1 + customer.gstCharged / 100)).toFixed(2)}</ThemedText>
                  </View>
                </>
              )}
            </View>
          </Card>
        ) : null}

        {/* Khata / Balance Card */}
        <Card style={[styles.balanceCard, hasBalance && { borderLeftColor: theme.warning }]}>
          <ThemedText style={styles.sectionTitle}>Credit Ledger (Khata)</ThemedText>
          <View style={styles.balanceDisplay}>
            <ThemedText type="small" themeColor="textSecondary">Outstanding Debt</ThemedText>
            <ThemedText 
              style={[
                styles.balanceNumber,
                hasBalance ? { color: theme.warning } : { color: theme.textSecondary },
              ]}
            >
              ₹{customer.outstandingBalance.toFixed(2)}
            </ThemedText>
          </View>

          {hasBalance && (
            <View style={styles.balanceActionRow}>
              <TouchableOpacity
                style={[styles.balanceActionBtn, { backgroundColor: theme.success }]}
                onPress={() => {
                  setRepayAmount(customer.outstandingBalance.toString());
                  setIsPayModalVisible(true);
                }}
              >
                <SymbolView name={{ ios: 'indianrupeesign.circle.fill', android: 'payment', web: 'payment' } as any} size={14} tintColor="#FFFFFF" />
                <ThemedText style={styles.shareText}>Pay Due</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.balanceActionBtn, { backgroundColor: theme.warning }]}
                onPress={handleShareStatement}
              >
                <SymbolView name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' } as any} size={14} tintColor="#FFFFFF" />
                <ThemedText style={styles.shareText}>Send Dues</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Customer notes */}
        {customer.notes ? (
          <Card style={styles.notesCard}>
            <ThemedText style={styles.sectionTitle}>Notes</ThemedText>
            <ThemedText style={styles.notesText}>{customer.notes}</ThemedText>
          </Card>
        ) : null}

        {/* Actions */}
        <View style={styles.actionRow}>
          <Button
            title="Edit Profile"
            variant="secondary"
            onPress={() => router.push(`/customers/edit?id=${customer.id}`)}
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

        {/* Customer Transaction Timeline */}
        <ThemedText style={styles.historySectionTitle}>Transactions History</ThemedText>

        {loading ? (
          <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: Spacing.two }} />
        ) : history.length === 0 ? (
          <View style={[styles.emptyHistory, { backgroundColor: theme.backgroundElement }]}>
            <SymbolView name={{ ios: 'cart.fill.badge.questionmark', android: 'shopping_cart', web: 'shopping_cart' }} size={24} tintColor={theme.textSecondary} />
            <ThemedText style={styles.emptyHistoryText} themeColor="textSecondary">
              No transactions logged for this customer yet.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {history.map((tx) => {
              const isSale = tx.type === 'sale';
              const isPayment = tx.type === 'payment';
              
              let badgeLabel = 'RETURN IN';
              let badgeVariant: 'info' | 'success' | 'warning' | 'danger' | 'neutral' = 'success';
              if (isSale) {
                badgeLabel = 'SALE';
                badgeVariant = 'info';
              } else if (isPayment) {
                badgeLabel = 'REPAYMENT';
                badgeVariant = 'success';
              }

              return (
                <TouchableOpacity
                  key={tx.id}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/transactions/${tx.id}`)}
                  style={[
                    styles.timelineCard,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                    isPayment && { borderLeftWidth: 4, borderLeftColor: theme.success }
                  ]}
                >
                  <View style={styles.timelineHeader}>
                    <View style={styles.timelineType}>
                      <Badge
                        label={badgeLabel}
                        variant={badgeVariant}
                      />
                      {!isPayment && (
                        <Badge
                          label={tx.paymentStatus}
                          variant={getPaymentBadgeVariant(tx.paymentStatus)}
                        />
                      )}
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {format(new Date(tx.createdAt), 'dd MMM yyyy')}
                    </ThemedText>
                  </View>

                  <View style={styles.timelineDetails}>
                    <View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {isPayment ? 'Paid Amount' : 'Total Amount'}
                      </ThemedText>
                      <ThemedText style={[isPayment ? styles.timelinePaid : styles.timelineAmount, { color: isPayment ? theme.success : theme.primary }]}>
                        ₹{tx.grandTotal.toFixed(2)}
                      </ThemedText>
                    </View>
                    
                    {!isPayment && (
                      <View style={{ alignItems: 'flex-end' }}>
                        <ThemedText type="small" themeColor="textSecondary">Paid Amount</ThemedText>
                        <ThemedText style={[styles.timelinePaid, { color: theme.success }]}>₹{tx.amountPaid.toFixed(2)}</ThemedText>
                      </View>
                    )}
                  </View>
                  {isPayment && tx.notes && (
                    <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        Note: {tx.notes}
                      </ThemedText>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Payment Recording Modal */}
      <Modal
        visible={isPayModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmittingPayment) setIsPayModalVisible(false);
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => {
            if (!isSubmittingPayment) setIsPayModalVisible(false);
          }}
        >
          <ThemedView
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
            ]}
          >
            <TouchableOpacity activeOpacity={1} style={{ width: '100%' }}>
              <View style={styles.modalHeader}>
                <ThemedText type="subtitle">Record Repayment</ThemedText>
                <TouchableOpacity
                  disabled={isSubmittingPayment}
                  onPress={() => setIsPayModalVisible(false)}
                  style={styles.btnClose}
                >
                  <SymbolView
                    name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'close' }}
                    size={22}
                    tintColor={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {customer && (
                  <View style={[styles.dueInfoBox, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Outstanding Due Balance
                    </ThemedText>
                    <ThemedText style={[styles.dueInfoText, { color: theme.warning }]}>
                      ₹{customer.outstandingBalance.toFixed(2)}
                    </ThemedText>
                  </View>
                )}

                <ThemedText style={styles.modalLabel}>Payment Amount (₹)</ThemedText>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      color: theme.text,
                      backgroundColor: theme.background,
                      borderColor: theme.backgroundSelected,
                    },
                  ]}
                  placeholder="Enter repayment amount"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={repayAmount}
                  onChangeText={setRepayAmount}
                  editable={!isSubmittingPayment}
                />

                <ThemedText style={styles.modalLabel}>Payment Mode</ThemedText>
                <View style={styles.modeSelector}>
                  {(['upi', 'cash', 'bank'] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      disabled={isSubmittingPayment}
                      style={[
                        styles.modeChip,
                        { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
                        repayMode === mode && {
                          backgroundColor: theme.primary,
                          borderColor: theme.primary,
                        },
                      ]}
                      onPress={() => setRepayMode(mode)}
                    >
                      <ThemedText
                        style={[
                          styles.modeChipText,
                          { color: theme.text },
                          repayMode === mode && { color: '#FFFFFF' },
                        ]}
                      >
                        {mode.toUpperCase()}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                <ThemedText style={styles.modalLabel}>Notes / Remarks</ThemedText>
                <TextInput
                  style={[
                    styles.modalInput,
                    styles.notesInput,
                    {
                      color: theme.text,
                      backgroundColor: theme.background,
                      borderColor: theme.backgroundSelected,
                    },
                  ]}
                  placeholder="e.g. Received via PhonePe, cash at shop..."
                  placeholderTextColor={theme.textSecondary}
                  value={repayNotes}
                  onChangeText={setRepayNotes}
                  multiline
                  numberOfLines={2}
                  editable={!isSubmittingPayment}
                />

                <Button
                  title={isSubmittingPayment ? 'Processing...' : 'Confirm Payment'}
                  variant="primary"
                  onPress={handleSubmitRepayment}
                  disabled={isSubmittingPayment || !repayAmount}
                  style={styles.btnSubmitPayment}
                />
              </View>
            </TouchableOpacity>
          </ThemedView>
        </TouchableOpacity>
      </Modal>
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
  profileCard: {
    marginBottom: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '800',
  },
  shopText: {
    fontSize: 13,
  },
  gstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.three,
  },
  contactDetails: {
    gap: Spacing.two,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  contactLinkText: {
    fontWeight: '600',
  },
  contactLabel: {
    fontSize: 11,
  },
  balanceCard: {
    marginBottom: Spacing.three,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  balanceDisplay: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  balanceNumber: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  balanceActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
    width: '100%',
  },
  balanceActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 12,
    gap: 6,
  },
  shareText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: Spacing.four,
    paddingBottom: Platform.OS === 'ios' ? 44 : Spacing.four,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.three,
  },
  btnClose: {
    padding: 4,
  },
  modalBody: {
    width: '100%',
    gap: Spacing.two,
  },
  dueInfoBox: {
    padding: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  dueInfoText: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.one,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  notesInput: {
    height: 64,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  modeSelector: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modeChip: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  btnSubmitPayment: {
    marginTop: Spacing.three,
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
    marginBottom: Spacing.two,
  },
  timelineType: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  timelineDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  timelineAmount: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  timelinePaid: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  scaleCard: {
    marginBottom: Spacing.three,
  },
  scaleGrid: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  scaleDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  scaleDetailLabel: {
    fontWeight: '600',
  },
  scaleDetailValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
