import { create } from 'zustand';
import { db } from '@/db/client';
import { transactions, transactionItems, stockItems, customers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { useStockStore } from './useStockStore';
import { useCustomerStore } from './useCustomerStore';

export interface TransactionItemInput {
  stockItemId: string;
  quantity: number;
  unitPrice: number;
}

export interface Transaction {
  id: string;
  type: 'sale' | 'purchase' | 'return_in' | 'return_out' | 'payment';
  customerId: string | null;
  supplierName: string | null;
  subtotal: number;
  discount: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid: number;
  paymentMode: 'cash' | 'upi' | 'bank' | 'credit' | null;
  paymentStatus: 'paid' | 'partial' | 'pending';
  createdByStaffId: string | null;
  notes: string | null;
  isSynced: number;
  createdAt: number;
}

export interface FullTransactionItem {
  id: string;
  transactionId: string;
  stockItemId: string;
  name: string;
  category: string;
  brand: string | null;
  capacityLabel: string | null;
  variant: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface TransactionState {
  transactionsList: Transaction[];
  isLoading: boolean;

  loadTransactions: () => Promise<void>;
  createTransaction: (data: {
    type: 'sale' | 'purchase' | 'return_in' | 'return_out';
    customerId: string | null;
    supplierName: string | null;
    subtotal: number;
    discount: number;
    taxAmount: number;
    grandTotal: number;
    amountPaid: number;
    paymentMode: 'cash' | 'upi' | 'bank' | 'credit' | null;
    paymentStatus: 'paid' | 'partial' | 'pending';
    createdByStaffId: string | null;
    notes: string | null;
    items: TransactionItemInput[];
  }) => Promise<{ success: boolean; error?: string }>;
  getTransactionDetails: (transactionId: string) => Promise<{
    transaction: Transaction;
    items: FullTransactionItem[];
  } | null>;
  voidTransaction: (id: string) => Promise<boolean>;
  createRepayment: (data: {
    customerId: string;
    amount: number;
    paymentMode: 'cash' | 'upi' | 'bank';
    createdByStaffId: string | null;
    notes?: string | null;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactionsList: [],
  isLoading: false,

  loadTransactions: async () => {
    try {
      set({ isLoading: true });
      const results = db.select().from(transactions).orderBy(desc(transactions.createdAt)).all();
      set({ transactionsList: results as Transaction[], isLoading: false });
    } catch (error) {
      console.error('Failed to load transactions:', error);
      set({ isLoading: false });
    }
  },

  createTransaction: async (data) => {
    const txId = `tx_${Date.now()}`;
    const now = Date.now();

    try {
      await db.transaction(async (tx) => {
        // 1. Double check and update stock levels
        for (const item of data.items) {
          const currentItem = tx
            .select()
            .from(stockItems)
            .where(eq(stockItems.id, item.stockItemId))
            .get();

          if (!currentItem) {
            throw new Error(`Stock item with ID ${item.stockItemId} not found.`);
          }

          let newQty = currentItem.quantity;
          if (data.type === 'sale' || data.type === 'return_out') {
            newQty -= item.quantity;
            if (newQty < 0) {
              throw new Error(`Insufficient stock for "${currentItem.name}". Current stock is ${currentItem.quantity}, requested ${item.quantity}.`);
            }
          } else if (data.type === 'purchase' || data.type === 'return_in') {
            newQty += item.quantity;
          }

          await tx.update(stockItems)
            .set({ quantity: newQty, updatedAt: now, isSynced: 0 })
            .where(eq(stockItems.id, item.stockItemId))
            .run();
        }

        // 2. If Sale or Return-In with customer, update Customer Outstanding Balance
        if (data.customerId) {
          const customer = tx
            .select()
            .from(customers)
            .where(eq(customers.id, data.customerId))
            .get();

          if (!customer) {
            throw new Error(`Customer with ID ${data.customerId} not found.`);
          }

          const creditAmount = data.grandTotal - data.amountPaid;
          let newBalance = customer.outstandingBalance;

          if (data.type === 'sale') {
            newBalance += creditAmount;
          } else if (data.type === 'return_in') {
            newBalance -= creditAmount;
          }

          await tx.update(customers)
            .set({ outstandingBalance: newBalance, updatedAt: now, isSynced: 0 })
            .where(eq(customers.id, data.customerId))
            .run();
        }

        // 3. Insert transaction record
        await tx.insert(transactions)
          .values({
            id: txId,
            type: data.type,
            customerId: data.customerId,
            supplierName: data.supplierName,
            subtotal: data.subtotal,
            discount: data.discount,
            taxAmount: data.taxAmount,
            grandTotal: data.grandTotal,
            amountPaid: data.amountPaid,
            paymentMode: data.paymentMode,
            paymentStatus: data.paymentStatus,
            createdByStaffId: data.createdByStaffId,
            notes: data.notes,
            isSynced: 0,
            createdAt: now,
          })
          .run();

        // 4. Insert transaction line items
        for (let idx = 0; idx < data.items.length; idx++) {
          const item = data.items[idx];
          await tx.insert(transactionItems)
            .values({
              id: `${txId}_item_${idx}`,
              transactionId: txId,
              stockItemId: item.stockItemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.quantity * item.unitPrice,
            })
            .run();
        }
      });

      await get().loadTransactions();
      useStockStore.getState().loadStock();
      if (data.customerId) {
        useCustomerStore.getState().loadCustomers();
      }

      return { success: true };
    } catch (error: any) {
      console.error('Transaction creation failed, rolling back:', error);
      return { success: false, error: error.message || 'Database error occurred' };
    }
  },

  getTransactionDetails: async (transactionId) => {
    try {
      const transaction = db
        .select()
        .from(transactions)
        .where(eq(transactions.id, transactionId))
        .get();

      if (!transaction) return null;

      const items = db
        .select({
          id: transactionItems.id,
          transactionId: transactionItems.transactionId,
          stockItemId: transactionItems.stockItemId,
          name: stockItems.name,
          category: stockItems.category,
          brand: stockItems.brand,
          capacityLabel: stockItems.capacityLabel,
          variant: stockItems.variant,
          quantity: transactionItems.quantity,
          unitPrice: transactionItems.unitPrice,
          lineTotal: transactionItems.lineTotal,
        })
        .from(transactionItems)
        .innerJoin(stockItems, eq(transactionItems.stockItemId, stockItems.id))
        .where(eq(transactionItems.transactionId, transactionId))
        .all();

      return {
        transaction: transaction as Transaction,
        items: items as FullTransactionItem[],
      };
    } catch (error) {
      console.error('Failed to get transaction details:', error);
      return null;
    }
  },

  voidTransaction: async (id) => {
    try {
      const details = await get().getTransactionDetails(id);
      if (!details) return false;

      const { transaction, items } = details;
      const now = Date.now();

      await db.transaction(async (tx) => {
        // 1. Reverse stock quantities
        for (const item of items) {
          const stock = tx.select().from(stockItems).where(eq(stockItems.id, item.stockItemId)).get();
          if (stock) {
            let reversedQty = stock.quantity;
            if (transaction.type === 'sale' || transaction.type === 'return_out') {
              reversedQty += item.quantity;
            } else if (transaction.type === 'purchase' || transaction.type === 'return_in') {
              reversedQty -= item.quantity;
              if (reversedQty < 0) {
                throw new Error(`Cannot void this transaction. Voiding it would cause stock of "${stock.name}" to drop below 0.`);
              }
            }
            await tx.update(stockItems).set({ quantity: reversedQty, updatedAt: now, isSynced: 0 }).where(eq(stockItems.id, item.stockItemId)).run();
          }
        }

        // 2. Reverse customer balance changes
        if (transaction.customerId) {
          const customer = tx.select().from(customers).where(eq(customers.id, transaction.customerId)).get();
          if (customer) {
            const creditAmount = transaction.grandTotal - transaction.amountPaid;
            let reversedBalance = customer.outstandingBalance;

            if (transaction.type === 'sale') {
              reversedBalance -= creditAmount;
            } else if (transaction.type === 'return_in') {
              reversedBalance += creditAmount;
            }

            await tx.update(customers).set({ outstandingBalance: reversedBalance, updatedAt: now, isSynced: 0 }).where(eq(customers.id, transaction.customerId)).run();
          }
        }

        // 3. Mark transaction as voided in cloud sync by updating status/setting isSynced=0 (or delete locally, and server will delete it)
        // Since we delete locally, the client will push the deletion or the sync server will delete transactions that no longer exist.
        // For standard sync, we can soft-delete transactions as well by setting a status, or delete it and sync.
        // Let's delete it locally and we can push the transaction deletion as a synced event. Or simple: we delete the row locally,
        // and during sync, client sends list of active transaction IDs so server deletes any orphaned transaction in Neon. This is clean and automatic!
        await tx.delete(transactionItems).where(eq(transactionItems.transactionId, id)).run();
        await tx.delete(transactions).where(eq(transactions.id, id)).run();
      });

      await get().loadTransactions();
      useStockStore.getState().loadStock();
      if (transaction.customerId) {
        useCustomerStore.getState().loadCustomers();
      }

      return true;
    } catch (error) {
      console.error('Failed to void transaction:', error);
      return false;
    }
  },
  createRepayment: async (data) => {
    const txId = `tx_${Date.now()}`;
    const now = Date.now();

    try {
      await db.transaction(async (tx) => {
        // 1. Fetch customer
        const customer = tx
          .select()
          .from(customers)
          .where(eq(customers.id, data.customerId))
          .get();

        if (!customer) {
          throw new Error(`Customer with ID ${data.customerId} not found.`);
        }

        // 2. Calculate new outstanding balance
        const newBalance = Math.max(0, customer.outstandingBalance - data.amount);

        // 3. Update customer outstanding balance
        await tx.update(customers)
          .set({ outstandingBalance: newBalance, updatedAt: now, isSynced: 0 })
          .where(eq(customers.id, data.customerId))
          .run();

        // 4. Insert transaction record (no items since it's just a payment)
        await tx.insert(transactions)
          .values({
            id: txId,
            type: 'payment',
            customerId: data.customerId,
            supplierName: null,
            subtotal: data.amount,
            discount: 0,
            taxAmount: 0,
            grandTotal: data.amount,
            amountPaid: data.amount,
            paymentMode: data.paymentMode,
            paymentStatus: 'paid',
            createdByStaffId: data.createdByStaffId,
            notes: data.notes || `Repayment of outstanding balance`,
            isSynced: 0,
            createdAt: now,
          })
          .run();
      });

      // Reload lists
      await get().loadTransactions();
      useCustomerStore.getState().loadCustomers();

      return { success: true };
    } catch (error: any) {
      console.error('Repayment creation failed, rolling back:', error);
      return { success: false, error: error.message || 'Database error occurred' };
    }
  },
}));
