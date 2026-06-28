import { create } from 'zustand';
import { db } from '@/db/client';
import { stockItems, transactionItems, transactions, customers } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { syncWithCloud } from '@/lib/sync';

export interface StockItem {
  id: string;
  category: string;
  brand: string | null;
  name: string;
  capacityLabel: string | null;
  variant: string | null;
  quantity: number;
  lowStockThreshold: number;
  costPrice: number | null;
  sellingPrice: number | null;
  photoUri: string | null;
  notes: string | null;
  isActive: number;
  isSynced: number;
  createdAt: number;
  updatedAt: number;
}

export interface LinkedTransaction {
  transactionId: string;
  type: 'sale' | 'purchase' | 'return_in' | 'return_out';
  customerName: string | null;
  supplierName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: number;
}

interface StockState {
  items: StockItem[];
  isLoading: boolean;

  loadStock: () => Promise<void>;
  addStockItem: (item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'isSynced'>) => Promise<boolean>;
  editStockItem: (id: string, updates: Partial<Omit<StockItem, 'id' | 'createdAt' | 'updatedAt' | 'isSynced'>>) => Promise<boolean>;
  deactivateStockItem: (id: string) => Promise<boolean>;
  getItemTransactions: (itemId: string) => Promise<LinkedTransaction[]>;
}

export const useStockStore = create<StockState>((set, get) => ({
  items: [],
  isLoading: false,

  loadStock: async () => {
    try {
      set({ isLoading: true });
      const results = db.select().from(stockItems).where(eq(stockItems.isActive, 1)).all();
      set({ items: results as StockItem[], isLoading: false });
    } catch (error) {
      console.error('Failed to load stock items:', error);
      set({ isLoading: false });
    }
  },

  addStockItem: async (itemData) => {
    try {
      const id = `stock_${Date.now()}`;
      const now = Date.now();
      
      const newItem = {
        ...itemData,
        id,
        quantity: itemData.quantity ?? 0,
        isActive: 1,
        isSynced: 0,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(stockItems).values(newItem).run();
      await get().loadStock();
      syncWithCloud().catch((e) => console.error('[useStockStore] Auto sync error:', e));
      return true;
    } catch (error) {
      console.error('Failed to add stock item:', error);
      return false;
    }
  },

  editStockItem: async (id, updates) => {
    try {
      const now = Date.now();
      await db.update(stockItems)
        .set({
          ...updates,
          isSynced: 0,
          updatedAt: now,
        })
        .where(eq(stockItems.id, id))
        .run();
      await get().loadStock();
      syncWithCloud().catch((e) => console.error('[useStockStore] Auto sync error:', e));
      return true;
    } catch (error) {
      console.error('Failed to update stock item:', error);
      return false;
    }
  },

  deactivateStockItem: async (id) => {
    try {
      await db.update(stockItems)
        .set({
          isActive: 0,
          isSynced: 0,
          updatedAt: Date.now(),
        })
        .where(eq(stockItems.id, id))
        .run();
      await get().loadStock();
      syncWithCloud().catch((e) => console.error('[useStockStore] Auto sync error:', e));
      return true;
    } catch (error) {
      console.error('Failed to soft delete stock item:', error);
      return false;
    }
  },

  getItemTransactions: async (itemId) => {
    try {
      const results = db
        .select({
          transactionId: transactions.id,
          type: transactions.type,
          customerName: customers.name,
          supplierName: transactions.supplierName,
          quantity: transactionItems.quantity,
          unitPrice: transactionItems.unitPrice,
          lineTotal: transactionItems.lineTotal,
          createdAt: transactions.createdAt,
        })
        .from(transactionItems)
        .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
        .leftJoin(customers, eq(transactions.customerId, customers.id))
        .where(eq(transactionItems.stockItemId, itemId))
        .orderBy(desc(transactions.createdAt))
        .all();

      return results as LinkedTransaction[];
    } catch (error) {
      console.error('Failed to fetch item transaction history:', error);
      return [];
    }
  },
}));
