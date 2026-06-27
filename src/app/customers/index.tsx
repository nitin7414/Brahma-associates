import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  Linking,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { useCustomerStore, Customer } from '@/stores/useCustomerStore';
import { ThemedText } from '@/components/themed-text';
import { Card, Badge } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function CustomerListScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { customersList, isLoading, loadCustomers } = useCustomerStore();

  const [search, setSearch] = useState('');
  const [filterDebtors, setFilterDebtors] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleRefresh = () => {
    loadCustomers();
  };

  const handleCall = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = `tel:${phone}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Call function is not supported on this device.');
        }
      })
      .catch((err) => console.error('Error calling customer:', err));
  };

  // Filter & Search Logic
  const filteredCustomers = customersList.filter((cust) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      cust.name.toLowerCase().includes(searchLower) ||
      (cust.phone && cust.phone.includes(searchLower)) ||
      (cust.businessName && cust.businessName.toLowerCase().includes(searchLower));

    const matchesDebtor = !filterDebtors || cust.outstandingBalance > 0;

    return matchesSearch && matchesDebtor;
  }).sort((a, b) => {
    if (filterDebtors) {
      return b.outstandingBalance - a.outstandingBalance;
    }
    return a.name.localeCompare(b.name);
  });

  const renderCustomerItem = ({ item }: { item: Customer }) => {
    const hasBalance = item.outstandingBalance > 0;
    
    return (
      <Card
        onPress={() => router.push(`/customers/${item.id}`)}
        style={[
          styles.custCard,
          hasBalance ? { borderLeftColor: theme.warning, borderLeftWidth: 4 } : null,
        ]}
      >
        <View style={styles.cardRow}>
          {/* Fallback Icon */}
          <View style={[styles.avatar, { backgroundColor: theme.background }]}>
            <SymbolView
              name={{ ios: 'person.crop.circle.fill', android: 'person', web: 'person' }}
              size={28}
              tintColor={theme.textSecondary}
            />
          </View>

          {/* Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.titleRow}>
              <ThemedText style={styles.custName}>{item.name}</ThemedText>
              {item.businessName && (
                <Badge label={item.businessName} variant="neutral" style={styles.businessBadge} />
              )}
            </View>

            {item.phone ? (
              <TouchableOpacity
                onPress={() => handleCall(item.phone!)}
                style={styles.phoneLink}
              >
                <SymbolView
                  name={{ ios: 'phone.fill', android: 'call', web: 'phone' }}
                  size={12}
                  tintColor={theme.primary}
                />
                <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4, fontWeight: '700' }}>
                  {item.phone}
                </ThemedText>
              </TouchableOpacity>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">No Phone Number</ThemedText>
            )}
          </View>

          {/* Outstanding Balance */}
          <View style={styles.balanceContainer}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.balanceLabel}>
              Balance
            </ThemedText>
            <ThemedText 
              style={[
                styles.balanceValue,
                hasBalance ? { color: theme.warning } : { color: theme.textSecondary },
              ]}
            >
              ₹{item.outstandingBalance.toFixed(2)}
            </ThemedText>
            {hasBalance && <Badge label="Due" variant="warning" style={styles.dueBadge} />}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Search and Filters */}
      <View style={[styles.filterSection, { borderColor: theme.backgroundSelected }]}>
        <View style={[styles.searchContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={18}
            tintColor={theme.textSecondary}
          />
          <TextInput
            placeholder="Search name, phone, shop..."
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <SymbolView
                name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'close' }}
                size={18}
                tintColor={theme.textSecondary}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: theme.backgroundElement },
              filterDebtors && { backgroundColor: theme.warning },
            ]}
            onPress={() => setFilterDebtors(!filterDebtors)}
          >
            <SymbolView
              name={{ ios: 'indianrupeesign.circle', android: 'payment', web: 'payment' } as any}
              size={14}
              tintColor={filterDebtors ? '#FFFFFF' : theme.text}
            />
            <ThemedText
              type="small"
              style={[
                styles.filterChipText,
                filterDebtors && { color: '#FFFFFF', fontWeight: '800' },
              ]}
              themeColor={filterDebtors ? 'text' : 'textSecondary'}
            >
              Show Debtors Only
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Customers List */}
      <FlatList
        data={filteredCustomers}
        renderItem={renderCustomerItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} colors={[theme.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <SymbolView
              name={{ ios: 'person.crop.circle.badge.exclamationmark', android: 'group', web: 'group' } as any}
              size={48}
              tintColor={theme.textSecondary}
            />
            <ThemedText style={styles.emptyText} themeColor="textSecondary">
              No customers found.
            </ThemedText>
            <TouchableOpacity
              style={[styles.btnAddFirst, { backgroundColor: theme.primary }]}
              onPress={() => router.push('/customers/edit')}
            >
              <ThemedText style={styles.btnAddFirstText}>Add Customer</ThemedText>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Floating Add Customer Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/customers/edit')}
      >
        <SymbolView
          name={{ ios: 'person.badge.plus', android: 'add', web: 'plus' } as any}
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
  filterSection: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderBottomWidth: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  optionsRow: {
    flexDirection: 'row',
    marginTop: Spacing.one,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContainer: {
    padding: Spacing.three,
    paddingBottom: 88, // FAB padding
  },
  custCard: {
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  custName: {
    fontSize: 16,
    fontWeight: '700',
  },
  businessBadge: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  phoneLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: 90,
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  dueBadge: {
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 4,
    marginTop: 4,
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
    bottom: Spacing.three,
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
});
