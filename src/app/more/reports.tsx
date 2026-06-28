import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useStockStore } from '@/stores/useStockStore';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Badge } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { db } from '@/db/client';
import { transactions, transactionItems, stockItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

const { width } = Dimensions.get('window');

interface DailyTrend {
  label: string;
  value: number;
  dateStr: string;
}

interface CatSales {
  category: string;
  total: number;
  percentage: number;
}

interface TopProduct {
  name: string;
  qtySold: number;
  revenue: number;
  category: string;
}

export default function ReportsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const { transactionsList } = useTransactionStore();
  const { items: stockList } = useStockStore();

  const [loading, setLoading] = useState(true);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [categorySales, setCategorySales] = useState<CatSales[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [selectedBar, setSelectedBar] = useState<DailyTrend | null>(null);

  useEffect(() => {
    generateReports();
  }, [transactionsList, stockList]);

  const generateReports = async () => {
    setLoading(true);
    try {
      // 1. Calculate Daily Trend (Past 7 Days)
      const salesTx = transactionsList.filter(t => t.type === 'sale');
      const trend: DailyTrend[] = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayStart = startOfDay(date).getTime();
        const dayEnd = endOfDay(date).getTime();

        const dailyTotal = salesTx
          .filter(t => t.createdAt >= dayStart && t.createdAt <= dayEnd)
          .reduce((sum, t) => sum + t.grandTotal, 0);

        trend.push({
          label: format(date, 'EEE'),
          value: dailyTotal,
          dateStr: format(date, 'dd MMM'),
        });
      }
      setDailyTrend(trend);
      if (trend.length > 0) {
        setSelectedBar(trend[trend.length - 1]); // default to today
      }

      // 2. Query Category Distribution & Top Selling Products
      // We can query Drizzle SQLite for line items sold
      const itemsSold = db
        .select({
          qty: transactionItems.quantity,
          unitPrice: transactionItems.unitPrice,
          lineTotal: transactionItems.lineTotal,
          category: stockItems.category,
          name: stockItems.name,
          itemId: stockItems.id,
        })
        .from(transactionItems)
        .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
        .innerJoin(stockItems, eq(transactionItems.stockItemId, stockItems.id))
        .where(eq(transactions.type, 'sale'))
        .all();

      // Aggregate Category Sales
      const catMap: Record<string, number> = {
        scale: 0,
        loadcell: 0,
        pcb: 0,
        display: 0,
        spare_part: 0,
      };

      // Aggregate Product Leaderboard
      const prodMap: Record<string, { qty: number; rev: number; cat: string }> = {};

      itemsSold.forEach(item => {
        catMap[item.category] = (catMap[item.category] || 0) + item.lineTotal;
        
        if (!prodMap[item.name]) {
          prodMap[item.name] = { qty: 0, rev: 0, cat: item.category };
        }
        prodMap[item.name].qty += item.qty;
        prodMap[item.name].rev += item.lineTotal;
      });

      // Format Categories
      const totalRevenue = Object.values(catMap).reduce((s, v) => s + v, 0);
      const catList: CatSales[] = Object.keys(catMap).map(cat => ({
        category: cat,
        total: catMap[cat],
        percentage: totalRevenue > 0 ? (catMap[cat] / totalRevenue) * 100 : 0,
      })).sort((a, b) => b.total - a.total);
      
      setCategorySales(catList);

      // Format Top Products
      const topList: TopProduct[] = Object.keys(prodMap).map(name => ({
        name,
        qtySold: prodMap[name].qty,
        revenue: prodMap[name].rev,
        category: prodMap[name].cat,
      })).sort((a, b) => b.qtySold - a.qtySold).slice(0, 5);

      setTopProducts(topList);
    } catch (error) {
      console.error('Failed to generate reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'scale': return theme.primary; // Royal Blue
      case 'loadcell': return theme.success; // Emerald
      case 'pcb': return '#8B5CF6'; // Violet
      case 'display': return '#EC4899'; // Pink
      default: return '#64748B'; // Slate
    }
  };

  const getMaxDailyValue = () => {
    const max = Math.max(...dailyTrend.map(d => d.value));
    return max > 0 ? max : 1000;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={{ marginTop: Spacing.two }}>Compiling report diagnostics...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const maxVal = getMaxDailyValue();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={22} tintColor={theme.text} />
          </TouchableOpacity>
          <ThemedText type="subtitle" style={styles.pageTitle}>Revenue Reports</ThemedText>
        </View>

        {/* 1. Daily Sales Trend Chart (Pure React Native Proportional Bar Chart) */}
        <Card style={styles.chartCard}>
          <ThemedText style={styles.sectionHeader}>Daily Sales Revenue (Past 7 Days)</ThemedText>
          
          <View style={styles.chartWrapper}>
            {dailyTrend.map((d, index) => {
              const heightPct = (d.value / maxVal) * 100;
              const barHeight = Math.max(8, (heightPct / 100) * 140); // clamp min height
              const isSelected = selectedBar?.label === d.label;

              return (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.8}
                  style={styles.barColumn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedBar(d);
                  }}
                >
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: barHeight,
                          backgroundColor: isSelected ? theme.primary : theme.backgroundSelected,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText 
                    type="small" 
                    style={[
                      styles.barLabel,
                      isSelected && { color: theme.primary, fontWeight: 'bold' }
                    ]}
                  >
                    {d.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected Tooltip detail */}
          {selectedBar && (
            <View style={[styles.tooltipCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Sales Statement for {selectedBar.dateStr}:
              </ThemedText>
              <ThemedText style={[styles.tooltipRevenue, { color: theme.primary }]}>
                ₹{selectedBar.value.toLocaleString('en-IN')}
              </ThemedText>
            </View>
          )}
        </Card>

        {/* 2. Category Distribution */}
        <Card style={styles.categoryCard}>
          <ThemedText style={styles.sectionHeader}>Category Distribution</ThemedText>
          
          {categorySales.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">No sales data recorded.</ThemedText>
          ) : (
            <View style={styles.catDistributionList}>
              {categorySales.map((cat) => (
                <View key={cat.category} style={styles.catDistributionRow}>
                  <View style={styles.catInfoRow}>
                    <ThemedText style={styles.catName}>
                      {cat.category.toUpperCase().replace('_', ' ')}
                    </ThemedText>
                    <ThemedText style={styles.catValue}>
                      ₹{cat.total.toLocaleString('en-IN')} ({cat.percentage.toFixed(1)}%)
                    </ThemedText>
                  </View>
                  {/* Progress Line */}
                  <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${cat.percentage}%`,
                          backgroundColor: getCategoryColor(cat.category),
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* 3. Product Leaderboard */}
        <Card style={styles.leaderboardCard}>
          <ThemedText style={styles.sectionHeader}>Top Selling Products</ThemedText>
          
          {topProducts.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', paddingVertical: Spacing.two }}>
              No product items sold yet.
            </ThemedText>
          ) : (
            <View style={styles.leaderboardList}>
              {topProducts.map((prod, idx) => (
                <View key={prod.name} style={[styles.leaderboardItem, { borderBottomColor: theme.backgroundSelected }]}>
                  <View style={styles.rankCol}>
                    <ThemedText style={[styles.rankText, { color: theme.primary }]}>#{idx + 1}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.prodName}>{prod.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Qty Sold: <ThemedText type="smallBold">{prod.qtySold} units</ThemedText>
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <ThemedText style={[styles.prodRev, { color: theme.success }]}>₹{prod.revenue.toFixed(0)}</ThemedText>
                    <Badge label={prod.category} variant="neutral" style={{ paddingVertical: 1, paddingHorizontal: 4, borderRadius: 3, marginTop: 2 }} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
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
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backBtn: {
    padding: 4,
  },
  pageTitle: {
    fontWeight: '800',
  },
  chartCard: {
    padding: Spacing.three,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.three,
  },
  chartWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 170,
    paddingHorizontal: Spacing.one,
    marginBottom: Spacing.three,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    height: 140,
    width: 22,
    borderRadius: 11,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 11,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
  tooltipCard: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    alignItems: 'center',
    gap: 2,
  },
  tooltipRevenue: {
    fontSize: 22,
    fontWeight: '900',
  },
  categoryCard: {
    padding: Spacing.three,
  },
  catDistributionList: {
    gap: Spacing.two,
  },
  catDistributionRow: {
    gap: 6,
  },
  catInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catName: {
    fontSize: 12,
    fontWeight: '700',
  },
  catValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  leaderboardCard: {
    padding: Spacing.three,
  },
  leaderboardList: {
    gap: Spacing.one,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    gap: Spacing.two,
  },
  rankCol: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '800',
  },
  prodName: {
    fontSize: 14,
    fontWeight: '700',
  },
  prodRev: {
    fontSize: 14,
    fontWeight: '800',
  },
});
