import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import { useStockStore, StockItem } from '@/stores/useStockStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { ThemedText } from '@/components/themed-text';
import { Card, Badge } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'scale', label: 'Scales' },
  { value: 'loadcell', label: 'Load Cells' },
  { value: 'pcb', label: 'PCBs' },
  { value: 'display', label: 'Displays' },
  { value: 'spare_part', label: 'Spare Parts' },
];

const BRANDS = ['All', 'ASK', 'Essae', 'MIC', 'Other'];

export default function StockListScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentUser } = useAuthStore();
  const { items, isLoading, loadStock } = useStockStore();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'low_stock'>('name');

  useEffect(() => {
    loadStock();
  }, []);

  const handleRefresh = () => {
    loadStock();
  };

  // Filter & Sort Logic
  const filteredItems = items.filter((item) => {
    // 1. Search Query
    const searchLower = search.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(searchLower) ||
      (item.brand && item.brand.toLowerCase().includes(searchLower)) ||
      (item.capacityLabel && item.capacityLabel.toLowerCase().includes(searchLower));

    // 2. Category Filter
    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;

    // 3. Brand Filter
    let matchesBrand = true;
    if (selectedBrand !== 'All') {
      if (selectedBrand === 'Other') {
        matchesBrand = item.brand === null || (item.brand !== 'ASK' && item.brand !== 'Essae' && item.brand !== 'MIC');
      } else {
        matchesBrand = item.brand === selectedBrand;
      }
    }

    return matchesSearch && matchesCategory && matchesBrand;
  }).sort((a, b) => {
    if (sortBy === 'quantity') {
      return a.quantity - b.quantity; // Low to High
    }
    if (sortBy === 'low_stock') {
      // Items that are below threshold first
      const aIsLow = a.quantity <= a.lowStockThreshold;
      const bIsLow = b.quantity <= b.lowStockThreshold;
      if (aIsLow && !bIsLow) return -1;
      if (!aIsLow && bIsLow) return 1;
      return a.quantity - b.quantity;
    }
    // A-Z sorting by default
    return a.name.localeCompare(b.name);
  });

  const getCategoryLabel = (cat: string) => {
    const found = CATEGORIES.find(c => c.value === cat);
    return found ? found.label.slice(0, -1) : cat; // Singularize
  };

  const renderStockItem = ({ item }: { item: StockItem }) => {
    const isLowStock = item.quantity <= item.lowStockThreshold;
    const isOutOfStock = item.quantity === 0;
    const isOwner = currentUser?.role === 'owner';

    return (
      <Card
        onPress={() => router.push(`/stock/${item.id}`)}
        style={[
          styles.itemCard,
          isOutOfStock 
            ? { borderLeftColor: theme.danger, borderLeftWidth: 4 } 
            : isLowStock 
            ? { borderLeftColor: theme.warning, borderLeftWidth: 4 } 
            : null,
        ]}
      >
        <View style={styles.cardRow}>
          {/* Item image or fallback icon */}
          <View style={[styles.imageContainer, { backgroundColor: theme.background }]}>
            {item.photoUri ? (
              <Image source={{ uri: item.photoUri }} style={styles.thumbnail} />
            ) : (
              <SymbolView
                name={{
                  ios: item.category === 'scale' ? 'scalemass.fill' : 'gearshape.fill',
                  android: item.category === 'scale' ? 'square' : 'settings',
                  web: 'gear',
                } as any}
                size={22}
                tintColor={theme.textSecondary}
              />
            )}
          </View>

          {/* Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.titleRow}>
              <ThemedText style={styles.itemTitle}>{item.name}</ThemedText>
              {item.brand && <Badge label={item.brand} variant="info" style={styles.brandBadge} />}
            </View>

            <ThemedText type="small" themeColor="textSecondary" style={styles.itemMeta}>
              {getCategoryLabel(item.category)}
              {item.capacityLabel ? ` • ${item.capacityLabel}` : ''}
              {item.variant ? ` • ${item.variant}` : ''}
            </ThemedText>

            <View style={styles.priceRow}>
              <ThemedText style={styles.priceLabel} themeColor="textSecondary">
                Sell: <ThemedText style={[styles.priceValue, { color: theme.primary }]}>₹{item.sellingPrice || 0}</ThemedText>
              </ThemedText>
              {isOwner && item.costPrice ? (
                <ThemedText style={[styles.priceLabel, { marginLeft: Spacing.two }]} themeColor="textSecondary">
                  Cost: <ThemedText themeColor="textSecondary" style={{ fontWeight: '600' }}>₹{item.costPrice}</ThemedText>
                </ThemedText>
              ) : null}
            </View>
          </View>

          {/* Qty Badge */}
          <View style={styles.qtyContainer}>
            <ThemedText 
              style={[
                styles.qtyValue, 
                isOutOfStock && { color: theme.danger },
                !isOutOfStock && isLowStock && { color: theme.warning },
              ]}
            >
              {item.quantity}
            </ThemedText>
            <ThemedText type="code" style={styles.qtyLabel} themeColor="textSecondary">
              UNITS
            </ThemedText>
            {isOutOfStock && <Badge label="OUT" variant="danger" style={styles.stockStatusBadge} />}
            {!isOutOfStock && isLowStock && <Badge label="LOW" variant="warning" style={styles.stockStatusBadge} />}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Header Controls */}
      <View style={[styles.filterSection, { borderColor: theme.backgroundSelected }]}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' } as any}
            size={18}
            tintColor={theme.textSecondary}
          />
          <TextInput
            placeholder="Search stock name, brand, spec..."
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

        {/* Categories Selector (Horizontal scroll) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              onPress={() => setSelectedCategory(cat.value)}
              style={[
                styles.categoryChip,
                { backgroundColor: theme.backgroundElement },
                selectedCategory === cat.value && { backgroundColor: theme.primary },
              ]}
            >
              <ThemedText
                type="small"
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat.value && { color: '#FFFFFF', fontWeight: '800' },
                ]}
                themeColor={selectedCategory === cat.value ? 'text' : 'textSecondary'}
              >
                {cat.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Brand & Sort select row */}
        <View style={styles.subFilterRow}>
          <View style={styles.dropdownWrap}>
            <ThemedText type="small" themeColor="textSecondary" style={{ marginRight: 6, fontWeight: '700' }}>Brand: </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {BRANDS.map(brand => (
                <TouchableOpacity
                  key={brand}
                  onPress={() => setSelectedBrand(brand)}
                  style={[
                    styles.subChip,
                    { backgroundColor: theme.backgroundElement },
                    selectedBrand === brand && { backgroundColor: theme.primary }
                  ]}
                >
                  <ThemedText 
                    type="small" 
                    style={[
                      { fontWeight: '600' },
                      selectedBrand === brand && { color: '#ffffff', fontWeight: '800' }
                    ]}
                    themeColor={selectedBrand === brand ? 'text' : 'textSecondary'}
                  >
                    {brand}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sortWrap}>
            <TouchableOpacity
              style={[styles.sortBtn, { backgroundColor: theme.backgroundElement }]}
              onPress={() => {
                if (sortBy === 'name') setSortBy('quantity');
                else if (sortBy === 'quantity') setSortBy('low_stock');
                else setSortBy('name');
              }}
            >
              <SymbolView
                name={{ ios: 'arrow.up.arrow.down', android: 'sort', web: 'sort' } as any}
                size={12}
                tintColor={theme.text}
              />
              <ThemedText type="small" style={styles.sortBtnText}>
                {sortBy === 'name' ? 'A-Z' : sortBy === 'quantity' ? 'Qty' : 'Alerts'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Main Stock List */}
      <FlatList
        data={filteredItems}
        renderItem={renderStockItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} colors={[theme.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <SymbolView
              name={{ ios: 'square.stack.3d.up.slash', android: 'inbox', web: 'inbox' } as any}
              size={48}
              tintColor={theme.textSecondary}
            />
            <ThemedText style={styles.emptyText} themeColor="textSecondary">
              No stock items found.
            </ThemedText>
            <TouchableOpacity
              style={[styles.btnAddFirst, { backgroundColor: theme.primary }]}
              onPress={() => router.push('/stock/edit')}
            >
              <ThemedText style={styles.btnAddFirstText}>Add First Item</ThemedText>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add Stock Floating Action Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/stock/edit')}
      >
        <SymbolView
          name={{ ios: 'plus', android: 'add', web: 'plus' } as any}
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
  categoryScroll: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginRight: Spacing.one,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  subFilterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  dropdownWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 6,
  },
  sortWrap: {
    marginLeft: Spacing.two,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContainer: {
    padding: Spacing.three,
    paddingBottom: 88, // FAB offset
  },
  itemCard: {
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  imageContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  brandBadge: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  priceLabel: {
    fontSize: 12,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  qtyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  qtyValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  qtyLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  stockStatusBadge: {
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
    marginTop: Spacing.one,
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
