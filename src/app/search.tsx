import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { db } from '@/db/client';
import { stockItems, customers, transactions } from '@/db/schema';
import { like, or, eq, sql } from 'drizzle-orm';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Badge } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SearchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { customersList } = useCustomerStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    stock: any[];
    customers: any[];
    transactions: any[];
  }>({ stock: [], customers: [], transactions: [] });
  const [searching, setSearching] = useState(false);

  // Debounced search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults({ stock: [], customers: [], transactions: [] });
      return;
    }

    setSearching(true);
    const delayDebounce = setTimeout(() => {
      performSearch(query.trim());
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const performSearch = async (searchTerm: string) => {
    try {
      const matchPattern = `%${searchTerm}%`;

      // 1. Query Stock Items
      const stockRes = db
        .select()
        .from(stockItems)
        .where(
          or(
            like(stockItems.name, matchPattern),
            like(stockItems.category, matchPattern),
            like(stockItems.brand, matchPattern),
            like(stockItems.capacityLabel, matchPattern),
            like(stockItems.variant, matchPattern)
          )
        )
        .all();

      // 2. Query Customers
      const custRes = db
        .select()
        .from(customers)
        .where(
          or(
            like(customers.name, matchPattern),
            like(customers.businessName, matchPattern),
            like(customers.phone, matchPattern)
          )
        )
        .all();

      // 3. Query Transactions (by ID, supplier name, or linked customer name)
      // Since SQLite does not easily join and filter dynamically via like on relation inside drizzle-orm-sqlite-core
      // without writing structured query, we can query transactions by ID or supplierName first,
      // and also match customerName locally by looking up the customer list.
      const txResRaw = db
        .select()
        .from(transactions)
        .where(
          or(
            like(transactions.id, matchPattern),
            like(transactions.supplierName, matchPattern)
          )
        )
        .all();

      // Find transactions by linked customer name match
      const matchingCustomerIds = customersList
        .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .map(c => c.id);

      let txRes = [...txResRaw];
      if (matchingCustomerIds.length > 0) {
        const matchingTxs = db
          .select()
          .from(transactions)
          .where(sql`${transactions.customerId} IN (${sql.raw(matchingCustomerIds.map(id => `'${id}'`).join(','))})`)
          .all();
        
        // Merge and deduplicate
        const existingIds = new Set(txRes.map(t => t.id));
        matchingTxs.forEach(t => {
          if (!existingIds.has(t.id)) {
            txRes.push(t);
          }
        });
      }

      setResults({
        stock: stockRes.filter(i => i.isActive === 1),
        customers: custRes.filter(c => c.isActive === 1),
        transactions: txRes,
      });
      setSearching(false);
    } catch (error) {
      console.error('Global search error:', error);
      setSearching(false);
    }
  };

  const handleResultTap = (dest: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(dest as any);
  };

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return 'N/A';
    const c = customersList.find(cust => cust.id === customerId);
    return c ? c.name : 'Unknown Customer';
  };

  const totalResults = results.stock.length + results.customers.length + results.transactions.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Search bar */}
      <View style={styles.searchHeader}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={22}
            tintColor={theme.text}
          />
        </TouchableOpacity>
        
        <View style={[styles.inputContainer, { backgroundColor: theme.backgroundElement }]}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={16} tintColor={theme.textSecondary} />
          <TextInput
            placeholder="Search catalog, clients, or invoice IDs..."
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            style={[styles.input, { color: theme.text }]}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'close' }} size={18} tintColor={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Results scroll */}
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {searching ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">Searching database...</ThemedText>
          </View>
        ) : query.trim() && totalResults === 0 ? (
          <View style={styles.center}>
            <SymbolView name={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }} size={40} tintColor={theme.textSecondary} />
            <ThemedText style={{ marginTop: Spacing.two }} themeColor="textSecondary">
              No results found for "{query}"
            </ThemedText>
          </View>
        ) : !query.trim() ? (
          <View style={styles.center}>
            <SymbolView name={{ ios: 'magnifyingglass.circle.fill', android: 'search', web: 'search' }} size={40} tintColor={theme.textSecondary} />
            <ThemedText style={{ marginTop: Spacing.two, textAlign: 'center', maxWidth: 240 }} themeColor="textSecondary">
              Type name, brand, spec, phone, or invoice code to search.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.resultsWrapper}>
            {/* Stock Catalog Section */}
            {results.stock.length > 0 && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  Inventory Catalog ({results.stock.length})
                </ThemedText>
                {results.stock.map(item => (
                  <Card
                    key={item.id}
                    onPress={() => handleResultTap(`/stock/${item.id}`)}
                    style={styles.resultCard}
                  >
                    <View style={styles.resultRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.resultTitle}>{item.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          Category: {item.category} {item.brand ? `• Brand: ${item.brand}` : ''}
                        </ThemedText>
                      </View>
                      <Badge label={`${item.quantity} Qty`} variant={item.quantity === 0 ? 'danger' : 'neutral'} />
                    </View>
                  </Card>
                ))}
              </View>
            )}

            {/* Customers Section */}
            {results.customers.length > 0 && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  Customer Directory ({results.customers.length})
                </ThemedText>
                {results.customers.map(cust => (
                  <Card
                    key={cust.id}
                    onPress={() => handleResultTap(`/customers/${cust.id}`)}
                    style={styles.resultCard}
                  >
                    <View style={styles.resultRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.resultTitle}>{cust.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {cust.businessName ? `Shop: ${cust.businessName} • ` : ''}Phone: {cust.phone || 'N/A'}
                        </ThemedText>
                      </View>
                      <Badge label={`₹${cust.outstandingBalance.toFixed(0)}`} variant={cust.outstandingBalance > 0 ? 'warning' : 'neutral'} />
                    </View>
                  </Card>
                ))}
              </View>
            )}

            {/* Transactions Section */}
            {results.transactions.length > 0 && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>
                  Invoices & Transactions ({results.transactions.length})
                </ThemedText>
                {results.transactions.map(tx => {
                  const client = tx.type === 'purchase' || tx.type === 'return_out'
                    ? tx.supplierName || 'Supplier'
                    : getCustomerName(tx.customerId);
                  
                  return (
                    <Card
                      key={tx.id}
                      onPress={() => handleResultTap(`/transactions/${tx.id}`)}
                      style={styles.resultCard}
                    >
                      <View style={styles.resultRow}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.resultTitle}>{client}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            Invoice: {tx.id} • {tx.type.toUpperCase()}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.txValue}>₹{tx.grandTotal.toFixed(0)}</ThemedText>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
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
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  backBtn: {
    padding: Spacing.one,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  scrollContainer: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 40,
  },
  center: {
    alignItems: 'center',
    paddingVertical: 120,
  },
  resultsWrapper: {
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginVertical: Spacing.one,
    opacity: 0.7,
  },
  resultCard: {
    marginBottom: 4,
    paddingVertical: Spacing.two,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  txValue: {
    fontWeight: '800',
    color: '#2563EB',
  },
});
