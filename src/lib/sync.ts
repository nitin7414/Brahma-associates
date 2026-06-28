import { db } from '@/db/client';
import { stockItems, customers, transactions, transactionItems, staffUsers, deletedRecords } from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
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

    // Connectivity guard: probe the server before attempting full sync
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s to allow Neon database cold start
      const probe = await fetch(`${backendUrl}/health`, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!probe.ok) {
        console.warn(`[syncWithCloud] Connectivity probe returned non-ok status: ${probe.status}`);
      }
    } catch (probeError: any) {
      console.error('[syncWithCloud] Connectivity probe failed:', probeError);
      const msg = probeError?.message?.toLowerCase() || '';
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('abort')) {
        return { success: false, error: 'No internet connection or server is unreachable. Please check your network and try again.' };
      }
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

    // Fetch local tombstones of deleted transactions
    const localDeleted = db.select().from(deletedRecords).all();
    const deletedTransactionIds = localDeleted.map((d) => d.id);

    // 2. Build sync payload
    const payload = {
      lastSyncTimestamp: settings.lastSyncTimestamp || 0,
      deletedTransactionIds,
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
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SYNC_API_KEY || 'brahma_secure_sync_secret_token_2026_xyz'}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Server error (${response.status}): ${errorText || response.statusText}` };
    }

    const data = await response.json();
    const { serverTimestamp, updates, deletedTransactionIds: serverDeletedTransactionIds } = data;

    let addedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    // 4. Perform atomic local database update
    await db.transaction(async (tx) => {
      // A. Apply Server Deletions
      if (serverDeletedTransactionIds && serverDeletedTransactionIds.length > 0) {
        // Delete transaction items first
        tx.delete(transactionItems)
          .where(inArray(transactionItems.transactionId, serverDeletedTransactionIds))
          .run();
        
        // Delete transactions
        const deleteRes = tx.delete(transactions)
          .where(inArray(transactions.id, serverDeletedTransactionIds))
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

      // F. Mark locally pushed records as synced (isSynced = 1) only if they haven't been updated in the meantime
      if (unsyncedStaff.length > 0) {
        for (const u of unsyncedStaff) {
          tx.update(staffUsers)
            .set({ isSynced: 1 })
            .where(and(eq(staffUsers.id, u.id), eq(staffUsers.updatedAt, u.updatedAt)))
            .run();
        }
      }
      if (unsyncedStock.length > 0) {
        for (const s of unsyncedStock) {
          tx.update(stockItems)
            .set({ isSynced: 1 })
            .where(and(eq(stockItems.id, s.id), eq(stockItems.updatedAt, s.updatedAt)))
            .run();
        }
      }
      if (unsyncedCustomers.length > 0) {
        for (const c of unsyncedCustomers) {
          tx.update(customers)
            .set({ isSynced: 1 })
            .where(and(eq(customers.id, c.id), eq(customers.updatedAt, c.updatedAt)))
            .run();
        }
      }
      if (unsyncedTx.length > 0) {
        for (const t of unsyncedTx) {
          tx.update(transactions)
            .set({ isSynced: 1 })
            .where(and(eq(transactions.id, t.id), eq(transactions.createdAt, t.createdAt)))
            .run();
        }
      }

      // Clear local uploaded tombstones
      if (localDeleted.length > 0) {
        tx.delete(deletedRecords)
          .where(inArray(deletedRecords.id, localDeleted.map((d) => d.id)))
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
