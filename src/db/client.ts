import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { seedInitialCatalog } from './seed';
import * as SecureStore from 'expo-secure-store';

const expoDb = openDatabaseSync('brahma_associates.db');
export const db = drizzle(expoDb, { schema });

export async function initializeDatabase() {
  try {
    // Enable foreign keys
    expoDb.execSync('PRAGMA foreign_keys = ON;');

    // Enable Write-Ahead Logging (WAL) for safety and concurrent performance
    expoDb.execSync('PRAGMA journal_mode = WAL;');

    // Check if tables already exist by checking sqlite_master
    const tablesCheck = expoDb.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='stock_items';"
    );

    if (tablesCheck.length === 0) {
      console.log('Database tables not found. Initializing schema...');

      // Create staff_users table first
      expoDb.execSync(`
        CREATE TABLE IF NOT EXISTS staff_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          pin_hash TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          is_synced INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Create stock_items table
      expoDb.execSync(`
        CREATE TABLE IF NOT EXISTS stock_items (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          brand TEXT,
          name TEXT NOT NULL,
          capacity_label TEXT,
          variant TEXT,
          quantity INTEGER NOT NULL DEFAULT 0,
          low_stock_threshold INTEGER NOT NULL DEFAULT 5,
          cost_price REAL,
          selling_price REAL,
          photo_uri TEXT,
          notes TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          is_synced INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Create customers table
      expoDb.execSync(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT,
          alt_phone TEXT,
          business_name TEXT,
          address TEXT,
          gst_number TEXT,
          outstanding_balance REAL NOT NULL DEFAULT 0.0,
          purchased_scale_name TEXT,
          model TEXT,
          selling_price REAL,
          gst_charged REAL,
          photo_uri TEXT,
          notes TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          is_synced INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Create transactions table
      expoDb.execSync(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          customer_id TEXT,
          supplier_name TEXT,
          subtotal REAL NOT NULL,
          discount REAL NOT NULL DEFAULT 0.0,
          tax_amount REAL NOT NULL DEFAULT 0.0,
          grand_total REAL NOT NULL,
          amount_paid REAL NOT NULL DEFAULT 0.0,
          payment_mode TEXT,
          payment_status TEXT NOT NULL,
          created_by_staff_id TEXT,
          notes TEXT,
          is_synced INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
      `);

      // Create transaction_items table
      expoDb.execSync(`
        CREATE TABLE IF NOT EXISTS transaction_items (
          id TEXT PRIMARY KEY,
          transaction_id TEXT NOT NULL,
          stock_item_id TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          line_total REAL NOT NULL,
          FOREIGN KEY (transaction_id) REFERENCES transactions(id),
          FOREIGN KEY (stock_item_id) REFERENCES stock_items(id)
        );
      `);

      // Create deleted_records table
      expoDb.execSync(`
        CREATE TABLE IF NOT EXISTS deleted_records (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          deleted_at INTEGER NOT NULL
        );
      `);

      console.log('Database tables created successfully. Seeding initial catalog skipped.');
      // await seedInitialCatalog(db);
      console.log('Database seeding completed!');
    } else {
      console.log('Database tables already exist. Skipping initialization.');
    }

    // One-time migration to clear auto-seeded initial stock items so user starts from scratch
    const hasCleanedStock = await SecureStore.getItemAsync('has_cleaned_initial_stock_v3');
    if (!hasCleanedStock) {
      console.log('[Migration] Cleaning initial stock items table for fresh start...');
      expoDb.execSync('DELETE FROM stock_items;');
      await SecureStore.setItemAsync('has_cleaned_initial_stock_v3', 'true');
      console.log('[Migration] Cleaned initial stock items table!');
    }

    // Migration: ensure staff_users has updated_at column
    try {
      expoDb.execSync('ALTER TABLE staff_users ADD COLUMN updated_at INTEGER;');
      expoDb.execSync('UPDATE staff_users SET updated_at = created_at WHERE updated_at IS NULL;');
      console.log('Migrated staff_users: added updated_at column');
    } catch (e) {
      // Column already exists, ignore
    }

    // Migration: ensure customers has scale detail columns
    try {
      expoDb.execSync('ALTER TABLE customers ADD COLUMN purchased_scale_name TEXT;');
    } catch (e) {}
    try {
      expoDb.execSync('ALTER TABLE customers ADD COLUMN model TEXT;');
    } catch (e) {}
    try {
      expoDb.execSync('ALTER TABLE customers ADD COLUMN selling_price REAL;');
    } catch (e) {}
    try {
      expoDb.execSync('ALTER TABLE customers ADD COLUMN gst_charged REAL;');
      console.log('Migrated customers: added purchased scale detail columns');
    } catch (e) {}

    // Migration: ensure deleted_records table exists
    try {
      expoDb.execSync(`
        CREATE TABLE IF NOT EXISTS deleted_records (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          deleted_at INTEGER NOT NULL
        );
      `);
      console.log('Migrated: ensured deleted_records table exists');
    } catch (e) {}
  } catch (error) {
    console.error('Failed to initialize local SQLite database:', error);
    throw error;
  }
}
