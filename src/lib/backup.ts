import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { db } from '@/db/client';
import { stockItems, customers, transactions, transactionItems, staffUsers } from '@/db/schema';
import { useStockStore } from '@/stores/useStockStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface BackupData {
  version: number;
  timestamp: number;
  data: {
    stockItems: any[];
    customers: any[];
    transactions: any[];
    transactionItems: any[];
    staffUsers: any[];
  };
}

/**
 * Exports all database tables to a JSON file and opens the native Share Sheet.
 */
export async function exportDatabaseBackup(): Promise<boolean> {
  try {
    // 1. Fetch all data from SQLite
    const allStock = db.select().from(stockItems).all();
    const allCustomers = db.select().from(customers).all();
    const allTransactions = db.select().from(transactions).all();
    const allItems = db.select().from(transactionItems).all();
    const allStaff = db.select().from(staffUsers).all();

    const backupPayload: BackupData = {
      version: 1,
      timestamp: Date.now(),
      data: {
        stockItems: allStock,
        customers: allCustomers,
        transactions: allTransactions,
        transactionItems: allItems,
        staffUsers: allStaff,
      },
    };

    // 2. Write to a temporary file
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `brahma_backup_${dateStr}.json`;
    const fileUri = `${(FileSystem as any).documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupPayload, null, 2), {
      encoding: 'utf8',
    });

    // 3. Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Brahma Associates Backup',
        UTI: 'public.json',
      });
      
      // Update last backup date in settings
      await useSettingsStore.getState().updateBackupDate();
      return true;
    } else {
      console.warn('Sharing is not available on this platform');
      return false;
    }
  } catch (error) {
    console.error('Failed to export backup:', error);
    return false;
  }
}

/**
 * Imports database data from a JSON file URI, overwriting the current database.
 */
export async function importDatabaseBackup(fileUri: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Read and parse JSON content
    const content = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'utf8',
    });
    
    const backup: BackupData = JSON.parse(content);

    // Basic structure validation
    if (!backup || backup.version !== 1 || !backup.data) {
      return { success: false, error: 'Invalid backup file format' };
    }

    const { stockItems: backupStock, customers: backupCustomers, transactions: backupTransactions, transactionItems: backupItems, staffUsers: backupStaff } = backup.data;

    if (!backupStock || !backupCustomers || !backupTransactions || !backupItems || !backupStaff) {
      return { success: false, error: 'Backup is missing required tables' };
    }

    // 2. Perform restore inside a transaction to prevent partial corruptions
    await db.transaction(async (tx) => {
      // Clear all existing data
      tx.delete(transactionItems).run();
      tx.delete(transactions).run();
      tx.delete(stockItems).run();
      tx.delete(customers).run();
      tx.delete(staffUsers).run();

      // Repopulate staffUsers
      for (const row of backupStaff) {
        tx.insert(staffUsers).values(row).run();
      }

      // Repopulate customers
      for (const row of backupCustomers) {
        tx.insert(customers).values(row).run();
      }

      // Repopulate stockItems
      for (const row of backupStock) {
        tx.insert(stockItems).values(row).run();
      }

      // Repopulate transactions
      for (const row of backupTransactions) {
        tx.insert(transactions).values(row).run();
      }

      // Repopulate transactionItems
      for (const row of backupItems) {
        tx.insert(transactionItems).values(row).run();
      }
    });

    // 3. Reload all Zustand stores to reflect restored data
    await useAuthStore.getState().initializeAuth();
    await useStockStore.getState().loadStock();
    await useCustomerStore.getState().loadCustomers();
    await useTransactionStore.getState().loadTransactions();

    return { success: true };
  } catch (error: any) {
    console.error('Failed to import backup:', error);
    return { success: false, error: error.message || 'Error parsing backup file' };
  }
}
