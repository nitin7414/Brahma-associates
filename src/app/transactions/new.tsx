import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Text,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { useTransactionStore, TransactionItemInput } from '@/stores/useTransactionStore';
import { useStockStore, StockItem } from '@/stores/useStockStore';
import { useCustomerStore, Customer } from '@/stores/useCustomerStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Input, Card, Badge } from '@/components/ui/primitives';
import { Spacing, ListPaddingBottom } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function NewTransactionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { type: urlType } = useLocalSearchParams<{ type: string }>();
  
  // Stores
  const { createTransaction } = useTransactionStore();
  const { items: stockList, loadStock } = useStockStore();
  const { customersList, loadCustomers } = useCustomerStore();
  const { settings } = useSettingsStore();
  const { currentUser } = useAuthStore();

  // Form State
  const [type, setType] = useState<'sale' | 'purchase' | 'return_in' | 'return_out'>('sale');

  // Load catalogs on mount
  useEffect(() => {
    loadStock();
    loadCustomers();
  }, []);

  // Update type if passed from router query parameters
  useEffect(() => {
    if (urlType && ['sale', 'purchase', 'return_in', 'return_out'].includes(urlType)) {
      setType(urlType as any);
    }
  }, [urlType]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState('');
  
  // Line items state
  const [lineItems, setLineItems] = useState<(TransactionItemInput & { name: string; key: string })[]>([]);
  
  // Autocomplete state
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [showStockResults, setShowStockResults] = useState(false);
  
  // Current item being added
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');

  // Finance states
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState(String(settings.taxRate || 18));
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'bank' | 'credit'>('cash');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Computations
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const parsedDiscount = parseFloat(discount) || 0;
  const parsedTaxRate = parseFloat(taxRate) || 0;
  const taxableAmount = Math.max(0, subtotal - parsedDiscount);
  const taxAmount = taxableAmount * (parsedTaxRate / 100);
  const grandTotal = taxableAmount + taxAmount;
  
  // Auto-fill amount paid initially or when grandTotal changes
  const parsedAmountPaid = amountPaid === '' ? grandTotal : parseFloat(amountPaid) || 0;

  // Autocomplete searches
  const filteredCustomers = customersList.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    (c.businessName && c.businessName.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  const filteredStock = stockList.filter(s => 
    s.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
    (s.brand && s.brand.toLowerCase().includes(stockSearch.toLowerCase()))
  );

  const handleSelectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setCustomerSearch(customer.name);
    setShowCustomerResults(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Auto-apply customer's purchased scale and GST settings
    if (customer.gstCharged !== null) {
      setTaxRate(String(customer.gstCharged));
    }

    if (customer.purchasedScaleName && customer.sellingPrice !== null) {
      // Find matching stock item
      const match = stockList.find(s => 
        s.name.toLowerCase().includes(customer.purchasedScaleName!.toLowerCase()) ||
        customer.purchasedScaleName!.toLowerCase().includes(s.name.toLowerCase())
      );
      if (match) {
        setLineItems([
          {
            stockItemId: match.id,
            name: match.name,
            quantity: 1,
            unitPrice: customer.sellingPrice,
            key: `${match.id}_${Date.now()}`,
          }
        ]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const firstScale = stockList.find(s => s.category === 'scale');
        if (firstScale) {
          setLineItems([
            {
              stockItemId: firstScale.id,
              name: `${customer.purchasedScaleName} (mapped to ${firstScale.name})`,
              quantity: 1,
              unitPrice: customer.sellingPrice,
              key: `${firstScale.id}_${Date.now()}`,
            }
          ]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Alert.alert(
            'Auto-Apply Partially Failed',
            `Could not auto-apply "${customer.purchasedScaleName}" to cart because no Stock items exist in your inventory database. Please add Stock items first.`
          );
        }
      }
    }
  };

  const handleSelectStock = (item: StockItem) => {
    setSelectedStockItem(item);
    setStockSearch(item.name);
    // Autofill price (selling price for sale/return_in, cost price or 0 for purchase/return_out)
    const priceToFill = type === 'sale' || type === 'return_in' 
      ? item.sellingPrice || 0 
      : item.costPrice || 0;
    setItemPrice(String(priceToFill));
    setItemQty('1');
    setShowStockResults(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddLineItem = () => {
    if (!selectedStockItem) {
      Alert.alert('Selection Error', 'Please search and select a stock item first.');
      return;
    }

    const qty = parseInt(itemQty, 10);
    const price = parseFloat(itemPrice);

    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Validation Error', 'Quantity must be a positive integer.');
      return;
    }

    if (isNaN(price) || price < 0) {
      Alert.alert('Validation Error', 'Unit Price cannot be negative.');
      return;
    }

    // Verify stock availability for Sales and Return-Outs
    if (type === 'sale' || type === 'return_out') {
      const alreadyAddedQty = lineItems
        .filter(li => li.stockItemId === selectedStockItem.id)
        .reduce((sum, li) => sum + li.quantity, 0);

      const totalRequested = alreadyAddedQty + qty;

      if (totalRequested > selectedStockItem.quantity) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Insufficient Stock',
          `Cannot add ${qty} units. "${selectedStockItem.name}" only has ${selectedStockItem.quantity} units in stock (already added ${alreadyAddedQty} in this cart).`
        );
        return;
      }
    }

    // Add to items list
    setLineItems([
      ...lineItems,
      {
        stockItemId: selectedStockItem.id,
        name: selectedStockItem.name,
        quantity: qty,
        unitPrice: price,
        key: `${selectedStockItem.id}_${Date.now()}`,
      },
    ]);

    // Reset item picker states
    setSelectedStockItem(null);
    setStockSearch('');
    setItemQty('1');
    setItemPrice('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemoveLineItem = (key: string) => {
    setLineItems(lineItems.filter(item => item.key !== key));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSave = async () => {
    // Basic Validations
    if (lineItems.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Cart Empty', 'Please add at least one line item to the transaction.');
      return;
    }

    if ((type === 'sale' || type === 'return_in') && !customerId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Customer Required', 'Please select a Customer for sales or returns.');
      return;
    }

    if ((type === 'purchase' || type === 'return_out') && !supplierName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Supplier Required', 'Please enter a Supplier name.');
      return;
    }

    setIsSaving(true);

    // Calculate status
    let paymentStatus: 'paid' | 'partial' | 'pending' = 'paid';
    if (parsedAmountPaid === 0) {
      paymentStatus = 'pending';
    } else if (parsedAmountPaid < grandTotal) {
      paymentStatus = 'partial';
    }

    const txData = {
      type,
      customerId: (type === 'sale' || type === 'return_in') ? customerId : null,
      supplierName: (type === 'purchase' || type === 'return_out') ? supplierName.trim() : null,
      subtotal,
      discount: parsedDiscount,
      taxAmount,
      grandTotal,
      amountPaid: parsedAmountPaid,
      paymentMode: parsedAmountPaid > 0 ? paymentMode : null,
      paymentStatus,
      createdByStaffId: currentUser?.id || null,
      notes: notes.trim() || null,
      items: lineItems.map(item => ({
        stockItemId: item.stockItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    };

    const result = await createTransaction(txData);
    setIsSaving(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Transaction saved successfully!', [
        { text: 'OK', onPress: () => router.replace('/transactions') }
      ]);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Transaction Failed', result.error || 'Failed to save transaction');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle" style={styles.pageTitle}>New Transaction</ThemedText>

        {/* Transaction Type Picker */}
        <View style={styles.chipRow}>
          {(['sale', 'purchase', 'return_in', 'return_out'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => {
                setType(t);
                setCustomerId(null);
                setCustomerSearch('');
                setSupplierName('');
                setLineItems([]);
                setSelectedStockItem(null);
                setStockSearch('');
              }}
              style={[
                styles.typeChip,
                { backgroundColor: theme.backgroundElement },
                type === t && { backgroundColor: theme.primary },
              ]}
            >
              <Text 
                style={[
                  styles.typeChipText,
                  type === t && { color: '#FFFFFF', fontWeight: 'bold' }
                ]}
              >
                {t.toUpperCase().replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Client / Entity Section */}
        <Card style={styles.sectionCard}>
          {type === 'sale' || type === 'return_in' ? (
            <View>
              <ThemedText style={styles.cardLabel}>Select Customer *</ThemedText>
              <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                <SymbolView name={{ ios: 'person.crop.circle', android: 'person', web: 'person' }} size={16} tintColor={theme.textSecondary} />
                <TextInput
                  placeholder="Type name to search customer..."
                  placeholderTextColor={theme.textSecondary}
                  value={customerSearch}
                  onChangeText={(t) => {
                    setCustomerSearch(t);
                    setCustomerId(null);
                    setShowCustomerResults(true);
                  }}
                  onFocus={() => setShowCustomerResults(true)}
                  style={[styles.searchInput, { color: theme.text }]}
                />
                {customerId && <Badge label="Selected" variant="success" />}
              </View>
              
              {/* Autocomplete list */}
              {showCustomerResults && customerSearch.length > 0 && (
                <View style={[styles.dropdownList, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                  <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
                    {filteredCustomers.length === 0 ? (
                      <TouchableOpacity 
                        style={styles.dropdownItem}
                        onPress={() => {
                          setShowCustomerResults(false);
                          router.push('/customers/edit');
                        }}
                      >
                        <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                          + Add New Customer "{customerSearch}"
                        </ThemedText>
                      </TouchableOpacity>
                    ) : (
                      filteredCustomers.map(cust => (
                        <TouchableOpacity
                          key={cust.id}
                          onPress={() => handleSelectCustomer(cust)}
                          style={[styles.dropdownItem, { borderBottomColor: theme.backgroundSelected }]}
                        >
                          <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>{cust.name}</ThemedText>
                          {cust.businessName && <ThemedText type="small" themeColor="textSecondary">Shop: {cust.businessName}</ThemedText>}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          ) : (
            <Input
              label="Supplier Name *"
              placeholder="e.g. ASK Scale Manufacturing India"
              value={supplierName}
              onChangeText={setSupplierName}
            />
          )}
        </Card>

        {/* Add Line Items Section */}
        <Card style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeader}>Add Cart Items</ThemedText>
          
          <ThemedText style={styles.cardLabel}>Search Stock Catalog</ThemedText>
          <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={16} tintColor={theme.textSecondary} />
            <TextInput
              placeholder="Type model or brand (e.g. ASK 30)"
              placeholderTextColor={theme.textSecondary}
              value={stockSearch}
              onChangeText={(t) => {
                setStockSearch(t);
                setSelectedStockItem(null);
                setShowStockResults(true);
              }}
              onFocus={() => setShowStockResults(true)}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {selectedStockItem && (
              <Badge 
                label={`Qty: ${selectedStockItem.quantity}`} 
                variant={selectedStockItem.quantity === 0 ? 'danger' : selectedStockItem.quantity <= selectedStockItem.lowStockThreshold ? 'warning' : 'success'} 
              />
            )}
          </View>

          {/* Stock Autocomplete */}
          {showStockResults && stockSearch.length > 0 && (
            <View style={[styles.dropdownList, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
                {filteredStock.length === 0 ? (
                  <View style={styles.dropdownItem}>
                    <ThemedText type="small" themeColor="textSecondary">No items matching query</ThemedText>
                  </View>
                ) : (
                  filteredStock.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleSelectStock(item)}
                      style={[styles.dropdownItem, { borderBottomColor: theme.backgroundSelected }]}
                    >
                      <ThemedText style={{ fontSize: 14, fontWeight: '700' }}>{item.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Stock: {item.quantity} units | Brand: {item.brand || 'N/A'} {item.variant ? ` | ${item.variant}` : ''}
                      </ThemedText>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}

          {/* Qty & Price Row */}
          {selectedStockItem && (
            <View style={{ marginTop: Spacing.two }}>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: Spacing.two }}>
                  <Input
                    label="Cart Qty"
                    placeholder="1"
                    keyboardType="numeric"
                    value={itemQty}
                    onChangeText={(t) => setItemQty(t.replace(/[^0-9]/g, ''))}
                  />
                </View>
                <View style={{ flex: 1.2 }}>
                  <Input
                    label="Unit Price (₹)"
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={itemPrice}
                    onChangeText={(t) => setItemPrice(t.replace(/[^0-9.]/g, ''))}
                  />
                </View>
              </View>
              
              <Button
                title="Add to Cart"
                variant="success"
                onPress={handleAddLineItem}
                style={styles.btnAddItem}
              />
            </View>
          )}
        </Card>

        {/* Cart items list */}
        {lineItems.length > 0 && (
          <Card style={styles.sectionCard}>
            <ThemedText style={styles.sectionHeader}>Cart List ({lineItems.length} items)</ThemedText>
            
            {lineItems.map((item) => (
              <View key={item.key} style={[styles.cartItemRow, { borderBottomColor: theme.backgroundSelected }]}>
                <View style={{ flex: 2 }}>
                  <ThemedText style={styles.cartItemName}>{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.quantity} units x ₹{item.unitPrice.toFixed(2)}
                  </ThemedText>
                </View>
                <View style={{ alignItems: 'flex-end', marginRight: Spacing.two }}>
                  <ThemedText style={styles.cartItemTotal}>
                    ₹{(item.quantity * item.unitPrice).toFixed(2)}
                  </ThemedText>
                </View>
                <TouchableOpacity onPress={() => handleRemoveLineItem(item.key)}>
                  <SymbolView name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} size={18} tintColor="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        {/* Calculations & Pricing summary */}
        <Card style={styles.sectionCard}>
          <ThemedText style={styles.sectionHeader}>Invoice Summary</ThemedText>
          
          <View style={styles.calcRow}>
            <ThemedText type="small" themeColor="textSecondary">Subtotal</ThemedText>
            <ThemedText style={styles.calcValue}>₹{subtotal.toFixed(2)}</ThemedText>
          </View>

          <View style={styles.calcRow}>
            <ThemedText type="small" themeColor="textSecondary">Discount Applied (₹)</ThemedText>
            <TextInput
              keyboardType="numeric"
              value={discount}
              onChangeText={(t) => setDiscount(t.replace(/[^0-9.]/g, ''))}
              style={[styles.smallInput, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
            />
          </View>

          <View style={styles.calcRow}>
            <ThemedText type="small" themeColor="textSecondary">GST Tax Rate (%)</ThemedText>
            <TextInput
              keyboardType="numeric"
              value={taxRate}
              onChangeText={(t) => setTaxRate(t.replace(/[^0-9.]/g, ''))}
              style={[styles.smallInput, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
            />
          </View>

          <View style={styles.calcRow}>
            <ThemedText type="small" themeColor="textSecondary">GST Tax Amount (₹)</ThemedText>
            <ThemedText style={[styles.calcValue, { color: theme.warning }]}>₹{taxAmount.toFixed(2)}</ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

          <View style={styles.calcRow}>
            <ThemedText type="subtitle" style={{ fontSize: 16 }}>Total (with GST added)</ThemedText>
            <ThemedText type="subtitle" style={{ color: theme.primary, fontSize: 20 }}>
              ₹{grandTotal.toFixed(2)}
            </ThemedText>
          </View>

          {/* Amount Paid input */}
          <View style={[styles.calcRow, { marginTop: Spacing.two }]}>
            <ThemedText type="smallBold">Amount Paid (₹)</ThemedText>
            <TextInput
              placeholder={grandTotal.toFixed(2)}
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              value={amountPaid}
              onChangeText={(t) => setAmountPaid(t.replace(/[^0-9.]/g, ''))}
              style={[styles.smallInput, { width: 120, color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
            />
          </View>
          
          <View style={styles.balanceNotesRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Unpaid Credit Dues: ₹{(grandTotal - parsedAmountPaid).toFixed(2)}
            </ThemedText>
          </View>

          {/* Payment Method */}
          {parsedAmountPaid > 0 && (
            <View style={{ marginTop: Spacing.two }}>
              <ThemedText style={styles.cardLabel}>Payment Mode</ThemedText>
              <View style={styles.chipRow}>
                {(['cash', 'upi', 'bank', 'credit'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setPaymentMode(mode)}
                    style={[
                      styles.modeChip,
                      { backgroundColor: theme.backgroundElement },
                      paymentMode === mode && { backgroundColor: theme.success },
                    ]}
                  >
                    <Text 
                      style={[
                        styles.modeChipText, 
                        paymentMode === mode && { color: '#FFFFFF', fontWeight: 'bold' }
                      ]}
                    >
                      {mode.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* Transaction notes */}
        <Card style={styles.sectionCard}>
          <Input
            label="Transaction Memo / Notes"
            placeholder="Add invoice reference, PO number, serial numbers..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            style={styles.memoInput}
          />
        </Card>

        {/* Save and cancel */}
        <View style={styles.actionRow}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => router.replace('/transactions')}
            style={{ flex: 1 }}
          />
          <Button
            title="Submit Invoice"
            variant="primary"
            onPress={handleSave}
            loading={isSaving}
            style={{ flex: 1.5 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: Spacing.four,
    paddingBottom: ListPaddingBottom,
  },
  pageTitle: {
    marginBottom: Spacing.three,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },

  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionCard: {
    marginBottom: Spacing.three,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  dropdownList: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  dropdownItem: {
    padding: Spacing.three,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
  },
  btnAddItem: {
    height: 40,
    marginTop: Spacing.one,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  cartItemName: {
    fontWeight: '600',
    fontSize: 14,
  },
  cartItemTotal: {
    fontWeight: '700',
    fontSize: 14,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  calcValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  smallInput: {
    height: 36,
    width: 80,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.two,
  },
  balanceNotesRow: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  modeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginRight: 6,
  },

  modeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  memoInput: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
