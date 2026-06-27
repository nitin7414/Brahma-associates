import { db } from '@/db/client';
import { stockItems, customers, transactions, transactionItems, staffUsers } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useStockStore } from '@/stores/useStockStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useAuthStore } from '@/stores/useAuthStore';

export interface SyncResult {
  success: boolean;
  error?: string;
  addedCount?: number;
  updatedCount?: number;
  deletedCount?: number;
}

export async function syncWithCloud(): Promise<SyncResult> {
  try {
    const { settings, updateSettings } = useSettingsStore.getState();
    const backendUrl = settings.backendUrl;

    if (!backendUrl) {
      return { success: false, error: 'Cloud Sync URL is not configured in settings.' };
    }

    // 1. Fetch unsynced local changes (isSynced = 0)
    const unsyncedStaff = db.select().from(staffUsers).where(eq(staffUsers.isSynced, 0)).all();
    const unsyncedStock = db.select().from(stockItems).where(eq(stockItems.isSynced, 0)).all();
    const unsyncedCustomers = db.select().from(customers).where(eq(customers.isSynced, 0)).all();
    const unsyncedTx = db.select().from(transactions).where(eq(transactions.isSynced, 0)).all();

    // Fetch line items for unsynced transactions
    const unsyncedTransactionsWithItems = unsyncedTx.map((tx) => {
      const items = db.select().from(transactionItems).where(eq(transactionItems.transactionId, tx.id)).all();
      return {
        ...tx,
        items,
      };
    });

    // Get all active transaction IDs to help the server find voided ones
    const activeTx = db.select({ id: transactions.id }).from(transactions).all();
    const activeTransactionIds = activeTx.map((t) => t.id);

    // 2. Build sync payload
    const payload = {
      lastSyncTimestamp: settings.lastSyncTimestamp || 0,
      activeTransactionIds,
      changes: {
        staffUsers: unsyncedStaff,
        stockItems: unsyncedStock,
        customers: unsyncedCustomers,
        transactions: unsyncedTransactionsWithItems,
      },
    };

    // 3. Send payload to backend
    const response = await fetch(`${backendUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Server error (${response.status}): ${errorText || response.statusText}` };
    }

    const data = await response.json();
    const { serverTimestamp, updates, deletedTransactionIds } = data;

    let addedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    // 4. Perform atomic local database update
    await db.transaction(async (tx) => {
      // A. Apply Server Deletions
      if (deletedTransactionIds && deletedTransactionIds.length > 0) {
        // Delete transaction items first
        tx.delete(transactionItems)
          .where(inArray(transactionItems.transactionId, deletedTransactionIds))
          .run();
        
        // Delete transactions
        const deleteRes = tx.delete(transactions)
          .where(inArray(transactions.id, deletedTransactionIds))
          .run();
        
        deletedCount += deleteRes.changes;
      }

      // B. Apply Server Updates (Staff Users)
      if (updates.staffUsers && updates.staffUsers.length > 0) {
        for (const user of updates.staffUsers) {
          const record = { ...user, isSynced: 1 };
          const existing = tx.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.id, user.id)).get();
          if (existing) {
            tx.update(staffUsers).set(record).where(eq(staffUsers.id, user.id)).run();
            updatedCount++;
          } else {
            tx.insert(staffUsers).values(record).run();
            addedCount++;
          }
        }
      }

      // C. Apply Server Updates (Stock Items)
      if (updates.stockItems && updates.stockItems.length > 0) {
        for (const item of updates.stockItems) {
          const record = { ...item, isSynced: 1 };
          const existing = tx.select({ id: stockItems.id }).from(stockItems).where(eq(stockItems.id, item.id)).get();
          if (existing) {
            tx.update(stockItems).set(record).where(eq(stockItems.id, item.id)).run();
            updatedCount++;
          } else {
            tx.insert(stockItems).values(record).run();
            addedCount++;
          }
        }
      }

      // D. Apply Server Updates (Customers)
      if (updates.customers && updates.customers.length > 0) {
        for (const customer of updates.customers) {
          const record = { ...customer, isSynced: 1 };
          const existing = tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customer.id)).get();
          if (existing) {
            tx.update(customers).set(record).where(eq(customers.id, customer.id)).run();
            updatedCount++;
          } else {
            tx.insert(customers).values(record).run();
            addedCount++;
          }
        }
      }

      // E. Apply Server Updates (Transactions & Items)
      if (updates.transactions && updates.transactions.length > 0) {
        for (const txDataWithItems of updates.transactions) {
          const { items, ...txData } = txDataWithItems;
          const record = { ...txData, isSynced: 1 };
          
          const existing = tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, txData.id)).get();
          if (existing) {
            tx.update(transactions).set(record).where(eq(transactions.id, txData.id)).run();
            updatedCount++;
          } else {
            tx.insert(transactions).values(record).run();
            addedCount++;
          }

          // Replace items
          tx.delete(transactionItems).where(eq(transactionItems.transactionId, txData.id)).run();
          for (const item of items) {
            tx.insert(transactionItems).values(item).run();
          }
        }
      }

      // F. Mark locally pushed records as synced (isSynced = 1)
      if (unsyncedStaff.length > 0) {
        tx.update(staffUsers)
          .set({ isSynced: 1 })
          .where(inArray(staffUsers.id, unsyncedStaff.map((u) => u.id)))
          .run();
      }
      if (unsyncedStock.length > 0) {
        tx.update(stockItems)
          .set({ isSynced: 1 })
          .where(inArray(stockItems.id, unsyncedStock.map((s) => s.id)))
          .run();
      }
      if (unsyncedCustomers.length > 0) {
        tx.update(customers)
          .set({ isSynced: 1 })
          .where(inArray(customers.id, unsyncedCustomers.map((c) => c.id)))
          .run();
      }
      if (unsyncedTx.length > 0) {
        tx.update(transactions)
          .set({ isSynced: 1 })
          .where(inArray(transactions.id, unsyncedTx.map((t) => t.id)))
          .run();
      }
    });

    // 5. Update local sync timestamp in settings store
    await updateSettings({
      lastSyncTimestamp: serverTimestamp,
    });

    // 6. Reload all stores to sync the UI state
    await useStockStore.getState().loadStock();
    await useCustomerStore.getState().loadCustomers();
    await useTransactionStore.getState().loadTransactions();
    await useAuthStore.getState().initializeAuth();

    return {
      success: true,
      addedCount,
      updatedCount,
      deletedCount,
    };
  } catch (error: any) {
    console.error('Cloud Sync failed:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred during sync.',
    };
  }
}
