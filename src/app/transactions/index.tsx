import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { useTransactionStore, Transaction } from '@/stores/useTransactionStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { ThemedText } from '@/components/themed-text';
import { Card, Badge } from '@/components/ui/primitives';
import { Spacing, FabBottom, ListPaddingBottom } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { format, isToday, isYesterday, startOfWeek, startOfMonth, isAfter } from 'date-fns';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'sale', label: 'Sales' },
  { value: 'purchase', label: 'Purchases' },
  { value: 'payment', label: 'Payments' },
  { value: 'return_in', label: 'Returns In' },
  { value: 'return_out', label: 'Returns Out' },
];

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'pending', label: 'Pending' },
];

const DATE_RANGES = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

export default function TransactionListScreen() {
  const router = useRouter();
  const theme = useTheme();
  
  const { transactionsList, isLoading, loadTransactions } = useTransactionStore();
  const { customersList, loadCustomers } = useCustomerStore();

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadCustomers();
  }, []);

  const handleRefresh = () => {
    loadTransactions();
  };

  const toggleFiltersPanel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowFilters(!showFilters);
  };

  const resetFilters = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedType('all');
    setSelectedStatus('all');
    setSelectedDateRange('all');
    setSearch('');
  };

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return 'N/A';
    const cust = customersList.find(c => c.id === customerId);
    return cust ? cust.name : 'Unknown Customer';
  };

  // Filter Logic
  const filteredTransactions = transactionsList.filter((tx) => {
    if (search.trim()) {
      const query = search.toLowerCase();
      const clientName = tx.type === 'purchase' || tx.type === 'return_out'
        ? (tx.supplierName || '').toLowerCase()
        : getCustomerName(tx.customerId).toLowerCase();
      const notes = (tx.notes || '').toLowerCase();
      const id = tx.id.toLowerCase();
      const total = tx.grandTotal.toString();

      if (!clientName.includes(query) && !notes.includes(query) && !id.includes(query) && !total.includes(query)) {
        return false;
      }
    }

    if (selectedType !== 'all' && tx.type !== selectedType) return false;
    if (selectedStatus !== 'all' && tx.paymentStatus !== selectedStatus) return false;

    const txDate = new Date(tx.createdAt);
    if (selectedDateRange === 'today') {
      if (!isToday(txDate)) return false;
    } else if (selectedDateRange === 'yesterday') {
      if (!isYesterday(txDate)) return false;
    } else if (selectedDateRange === 'week') {
      const startOfCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
      if (!isAfter(txDate, startOfCurrentWeek)) return false;
    } else if (selectedDateRange === 'month') {
      const startOfCurrentMonth = startOfMonth(new Date());
      if (!isAfter(txDate, startOfCurrentMonth)) return false;
    }

    return true;
  });

  const getTxTypeMeta = (type: string) => {
    switch (type) {
      case 'sale': return { label: 'SALE', variant: 'info' as const, color: theme.primary };
      case 'purchase': return { label: 'BUY', variant: 'success' as const, color: theme.success };
      case 'return_in': return { label: 'RET IN', variant: 'warning' as const, color: theme.warning };
      case 'return_out': return { label: 'RET OUT', variant: 'danger' as const, color: theme.danger };
      case 'payment': return { label: 'PAYMENT', variant: 'success' as const, color: theme.success };
      default: return { label: type.toUpperCase(), variant: 'neutral' as const, color: theme.textSecondary };
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'partial': return 'warning';
      case 'pending': return 'danger';
      default: return 'neutral';
    }
  };

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const typeMeta = getTxTypeMeta(item.type);
    const clientName = item.type === 'purchase' || item.type === 'return_out'
      ? item.supplierName || 'Unknown Supplier'
      : getCustomerName(item.customerId);

    return (
      <Card
        onPress={() => router.push(`/transactions/${item.id}`)}
        style={[
          styles.txCard, 
          { 
            borderLeftWidth: 4, 
            borderLeftColor: typeMeta.color,
            backgroundColor: theme.backgroundElement,
          }
        ]}
      >
        <View style={styles.cardRow}>
          {/* Left info */}
          <View style={styles.leftCol}>
            <View style={styles.badgeRow}>
              <Badge label={typeMeta.label} variant={typeMeta.variant} />
              <Badge label={item.paymentStatus} variant={getStatusBadgeVariant(item.paymentStatus)} />
            </View>

            <ThemedText style={styles.clientName} numberOfLines={1}>{clientName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.txDate}>
              {format(new Date(item.createdAt), 'dd MMM yyyy, hh:mm a')}
            </ThemedText>
          </View>

          {/* Right info */}
          <View style={styles.rightCol}>
            <ThemedText style={[styles.grandTotal, { color: theme.primary }]}>₹{item.grandTotal.toFixed(2)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: 1 }}>
              Paid: ₹{item.amountPaid.toFixed(2)}
            </ThemedText>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={14}
              tintColor={theme.textSecondary}
              style={styles.chevron}
            />
          </View>
        </View>
      </Card>
    );
  };

  // Stats calculations
  const salesTx = filteredTransactions.filter(tx => tx.type === 'sale');
  const paymentTx = filteredTransactions.filter(tx => tx.type === 'payment');
  const returnInTx = filteredTransactions.filter(tx => tx.type === 'return_in');

  const salesTotal = salesTx.reduce((sum, tx) => sum + tx.grandTotal, 0);
  const salesPaidDirect = salesTx.reduce((sum, tx) => sum + tx.amountPaid, 0);
  const repaymentsTotal = paymentTx.reduce((sum, tx) => sum + tx.amountPaid, 0);
  const returnInTotal = returnInTx.reduce((sum, tx) => sum + (tx.grandTotal - tx.amountPaid), 0);

  // Collected: cash paid at time of sale + cash paid as repayments
  const salesPaid = salesPaidDirect + repaymentsTotal;
  
  // Outstanding Dues: (sales total - sales paid direct) - returns - repayments
  const salesDues = Math.max(0, (salesTotal - salesPaidDirect) - returnInTotal - repaymentsTotal);

  const purchaseTx = filteredTransactions.filter(tx => tx.type === 'purchase');
  const purchaseTotal = purchaseTx.reduce((sum, tx) => sum + tx.grandTotal, 0);

  const renderListHeader = () => {
    return (
      <View style={styles.statsContainer}>
        {/* Ledger Role Description Helper */}
        <View style={[styles.ledgerHelperCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
          <SymbolView name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={16} tintColor={theme.primary} />
          <ThemedText type="small" style={styles.ledgerHelperText} themeColor="textSecondary">
            <ThemedText type="smallBold" style={{ color: theme.primary }}>What is Ledger?</ThemedText> A record of all sales, purchases, and returns. Use filters to view specific dates, and see dynamic calculations below.
          </ThemedText>
        </View>

        {/* Financial Summary Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
          <Card style={[styles.statCard, { borderLeftColor: theme.primary, borderLeftWidth: 4, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>Sales Revenue</ThemedText>
            <ThemedText style={[styles.statValue, { color: theme.primary }]}>₹{salesTotal.toFixed(2)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.statSub}>{salesTx.length} Sales</ThemedText>
          </Card>
          
          <Card style={[styles.statCard, { borderLeftColor: theme.success, borderLeftWidth: 4, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>Collected</ThemedText>
            <ThemedText style={[styles.statValue, { color: theme.success }]}>₹{salesPaid.toFixed(2)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.statSub}>Inflow Cash</ThemedText>
          </Card>

          <Card style={[styles.statCard, { borderLeftColor: theme.warning, borderLeftWidth: 4, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>Outstand Dues</ThemedText>
            <ThemedText style={[styles.statValue, { color: theme.warning }]}>₹{salesDues.toFixed(2)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.statSub}>Pending Payments</ThemedText>
          </Card>

          <Card style={[styles.statCard, { borderLeftColor: theme.danger, borderLeftWidth: 4, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>Purchases</ThemedText>
            <ThemedText style={[styles.statValue, { color: theme.danger }]}>₹{purchaseTotal.toFixed(2)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.statSub}>{purchaseTx.length} Purchases</ThemedText>
          </Card>
        </ScrollView>
      </View>
    );
  };

  const hasActiveFilters = selectedType !== 'all' || selectedStatus !== 'all' || selectedDateRange !== 'all';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Search and Collapsible Filter Controls */}
      <View style={[styles.headerSection, { borderBottomColor: theme.backgroundSelected }]}>
        <View style={styles.searchBarRow}>
          <View style={[styles.searchContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              size={18}
              tintColor={theme.textSecondary}
            />
            <TextInput
              placeholder="Search customer, ID, total..."
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'close' }}
                  size={16}
                  tintColor={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.filterToggleBtn,
              { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
              (showFilters || hasActiveFilters) && { backgroundColor: theme.primary, borderColor: theme.primary }
            ]}
            onPress={toggleFiltersPanel}
          >
            <SymbolView
              name={{ ios: 'slider.horizontal.3', android: 'filter_list', web: 'filter' } as any}
              size={18}
              tintColor={(showFilters || hasActiveFilters) ? '#FFFFFF' : theme.text}
            />
            {hasActiveFilters && !showFilters && <View style={[styles.activeDotBadge, { backgroundColor: theme.success, borderColor: theme.backgroundElement }]} />}
          </TouchableOpacity>
        </View>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <View style={[styles.filterPanel, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
            {/* Filter Category: Type */}
            <View style={styles.filterGroup}>
              <ThemedText style={styles.filterGroupLabel}>Transaction Type</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedType(t.value);
                    }}
                    style={[
                      styles.chip,
                      { backgroundColor: theme.background },
                      selectedType === t.value && { backgroundColor: theme.primary },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={[styles.chipText, selectedType === t.value && { color: '#FFFFFF', fontWeight: '800' }]}
                      themeColor={selectedType === t.value ? 'text' : 'textSecondary'}
                    >
                      {t.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Filter Category: Status */}
            <View style={styles.filterGroup}>
              <ThemedText style={styles.filterGroupLabel}>Payment Status</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedStatus(s.value);
                    }}
                    style={[
                      styles.chip,
                      { backgroundColor: theme.background },
                      selectedStatus === s.value && { backgroundColor: theme.success },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={[styles.chipText, selectedStatus === s.value && { color: '#FFFFFF', fontWeight: '800' }]}
                      themeColor={selectedStatus === s.value ? 'text' : 'textSecondary'}
                    >
                      {s.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Filter Category: Date */}
            <View style={styles.filterGroup}>
              <ThemedText style={styles.filterGroupLabel}>Time Period</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {DATE_RANGES.map((d) => (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDateRange(d.value);
                    }}
                    style={[
                      styles.chip,
                      { backgroundColor: theme.background },
                      selectedDateRange === d.value && { backgroundColor: theme.warning },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={[styles.chipText, selectedDateRange === d.value && { color: '#FFFFFF', fontWeight: '800' }]}
                      themeColor={selectedDateRange === d.value ? 'text' : 'textSecondary'}
                    >
                      {d.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Reset Row */}
            {(hasActiveFilters || search.length > 0) && (
              <TouchableOpacity style={[styles.btnReset, { borderColor: theme.danger + '35' }]} onPress={resetFilters}>
                <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' } as any} size={14} tintColor={theme.danger} />
                <ThemedText style={[styles.resetText, { color: theme.danger }]}>Reset All Filters</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Active Filters Summary */}
        {!showFilters && hasActiveFilters && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.activePillsRow}
          >
            {selectedType !== 'all' && (
              <TouchableOpacity 
                style={[styles.activePill, { backgroundColor: theme.primary + '15' }]}
                onPress={() => setSelectedType('all')}
              >
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                  {TYPES.find(t => t.value === selectedType)?.label} ✕
                </ThemedText>
              </TouchableOpacity>
            )}
            {selectedStatus !== 'all' && (
              <TouchableOpacity 
                style={[styles.activePill, { backgroundColor: theme.success + '15' }]}
                onPress={() => setSelectedStatus('all')}
              >
                <ThemedText type="small" style={{ color: theme.success, fontWeight: '700' }}>
                  Status: {STATUSES.find(s => s.value === selectedStatus)?.label} ✕
                </ThemedText>
              </TouchableOpacity>
            )}
            {selectedDateRange !== 'all' && (
              <TouchableOpacity 
                style={[styles.activePill, { backgroundColor: theme.warning + '15' }]}
                onPress={() => setSelectedDateRange('all')}
              >
                <ThemedText type="small" style={{ color: theme.warning, fontWeight: '700' }}>
                  {DATE_RANGES.find(d => d.value === selectedDateRange)?.label} ✕
                </ThemedText>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.activePillClear} onPress={resetFilters}>
              <ThemedText type="small" style={{ color: theme.danger, fontWeight: '800' }}>Clear All</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      <FlatList
        data={filteredTransactions}
        renderItem={renderTransactionItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} colors={[theme.primary]} />
        }
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <SymbolView
              name={{ ios: 'doc.plaintext.fill', android: 'receipt', web: 'receipt' }}
              size={48}
              tintColor={theme.textSecondary}
            />
            <ThemedText style={styles.emptyText} themeColor="textSecondary">
              No transactions found.
            </ThemedText>
            {hasActiveFilters || search.length > 0 ? (
              <TouchableOpacity
                style={[styles.btnAddFirst, { backgroundColor: theme.primary }]}
                onPress={resetFilters}
              >
                <ThemedText style={styles.btnAddFirstText}>Reset All Filters</ThemedText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.btnAddFirst, { backgroundColor: theme.primary }]}
                onPress={() => router.push('/transactions/new')}
              >
                <ThemedText style={styles.btnAddFirstText}>Create New Invoice</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Floating Add Transaction FAB */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/transactions/new')}
      >
        <SymbolView
          name={{ ios: 'plus.rectangle.on.rectangle', android: 'add_shopping_cart', web: 'plus' } as any}
          size={24}
          tintColor="#FFFFFF"
        />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderBottomWidth: 1,
  },
  searchBarRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    flex: 1,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  activeDotBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  filterPanel: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  filterGroup: {
    gap: Spacing.one,
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  btnReset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: Spacing.one,
  },
  resetText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activePillsRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.one,
    gap: Spacing.one,
  },
  activePill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: Spacing.one,
  },
  activePillClear: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: Spacing.three,
    paddingBottom: ListPaddingBottom, // FAB offset
  },
  txCard: {
    paddingVertical: Spacing.three,
    marginBottom: Spacing.two,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftCol: {
    flex: 1.2,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
  },
  txDate: {
    fontSize: 11,
  },
  rightCol: {
    flex: 0.8,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: Spacing.five,
  },
  grandTotal: {
    fontSize: 15,
    fontWeight: '800',
  },
  chevron: {
    position: 'absolute',
    right: -4,
    top: '32%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: Spacing.two,
  },
  emptyText: {
    fontSize: 15,
  },
  btnAddFirst: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 20,
    marginTop: Spacing.two,
  },
  btnAddFirstText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: FabBottom,
    right: Spacing.three,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  statsContainer: {
    marginBottom: Spacing.three,
  },
  ledgerHelperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  ledgerHelperText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  statsScroll: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingRight: Spacing.four,
  },
  statCard: {
    width: 140,
    padding: Spacing.three,
    marginRight: Spacing.one,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 4,
  },
  statSub: {
    fontSize: 10,
  },
});
