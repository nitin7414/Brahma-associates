import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './client';
import { staffUsers, stockItems, customers, transactions, transactionItems, deletedRecords } from './schema';
import { eq, gt, lte, and, sql } from 'drizzle-orm';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper to initialize PostgreSQL database tables on Neon if they do not exist
async function initializeDatabase() {
  console.log('Initializing Neon PostgreSQL database tables...');
  try {
    // 1. staff_users
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staff_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `);

    // 2. stock_items
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stock_items (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        brand TEXT,
        name TEXT NOT NULL,
        capacity_label TEXT,
        variant TEXT,
        quantity INTEGER NOT NULL DEFAULT 0,
        low_stock_threshold INTEGER NOT NULL DEFAULT 5,
        cost_price DOUBLE PRECISION,
        selling_price DOUBLE PRECISION,
        photo_uri TEXT,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `);

    // 3. customers
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        alt_phone TEXT,
        business_name TEXT,
        address TEXT,
        gst_number TEXT,
        outstanding_balance DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        purchased_scale_name TEXT,
        model TEXT,
        selling_price DOUBLE PRECISION,
        gst_charged DOUBLE PRECISION,
        photo_uri TEXT,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `);

    // 4. transactions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        customer_id TEXT REFERENCES customers(id),
        supplier_name TEXT,
        subtotal DOUBLE PRECISION NOT NULL,
        discount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        tax_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        grand_total DOUBLE PRECISION NOT NULL,
        amount_paid DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        payment_mode TEXT,
        payment_status TEXT NOT NULL,
        created_by_staff_id TEXT,
        notes TEXT,
        created_at BIGINT NOT NULL
      );
    `);

    // 5. transaction_items
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        stock_item_id TEXT NOT NULL REFERENCES stock_items(id),
        quantity INTEGER NOT NULL,
        unit_price DOUBLE PRECISION NOT NULL,
        line_total DOUBLE PRECISION NOT NULL
      );
    `);

    // 6. deleted_records
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deleted_records (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        deleted_at BIGINT NOT NULL
      );
    `);

    // Migration: ensure customers has scale detail columns
    try {
      await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS purchased_scale_name TEXT;`);
      await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS model TEXT;`);
      await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS selling_price DOUBLE PRECISION;`);
      await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS gst_charged DOUBLE PRECISION;`);
      console.log('Migrated Neon PostgreSQL: added customer purchased scale details columns');
    } catch (e) {
      console.warn('PostgreSQL customer migration skipped or failed:', e);
    }

    console.log('Neon database tables successfully initialized/verified!');
  } catch (error) {
    console.error('Failed to initialize Neon database tables:', error);
    process.exit(1);
  }
}

// REST Sync Endpoint
app.post('/api/sync', async (req, res) => {
  try {
    const { lastSyncTimestamp, activeTransactionIds, changes } = req.body;
    const serverTimestamp = Date.now();

    console.log(`Sync request received. Client Last Sync: ${lastSyncTimestamp}`);

    const result = await db.transaction(async (tx) => {
      // --- 1. PROCESS CLIENT CHANGES (Last-Write-Wins / Inserts) ---

      // A. Staff Users
      if (changes.staffUsers && changes.staffUsers.length > 0) {
        for (const user of changes.staffUsers) {
          const [existing] = await tx.select().from(staffUsers).where(eq(staffUsers.id, user.id));
          if (!existing) {
            await tx.insert(staffUsers).values({
              id: user.id,
              name: user.name,
              role: user.role,
              pinHash: user.pinHash,
              isActive: user.isActive,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            });
          } else if (user.updatedAt > existing.updatedAt) {
            await tx.update(staffUsers)
              .set({
                name: user.name,
                role: user.role,
                pinHash: user.pinHash,
                isActive: user.isActive,
                updatedAt: user.updatedAt,
              })
              .where(eq(staffUsers.id, user.id));
          }
        }
      }

      // B. Stock Items
      if (changes.stockItems && changes.stockItems.length > 0) {
        for (const item of changes.stockItems) {
          const [existing] = await tx.select().from(stockItems).where(eq(stockItems.id, item.id));
          if (!existing) {
            await tx.insert(stockItems).values({
              id: item.id,
              category: item.category,
              brand: item.brand,
              name: item.name,
              capacityLabel: item.capacityLabel,
              variant: item.variant,
              quantity: item.quantity,
              lowStockThreshold: item.lowStockThreshold,
              costPrice: item.costPrice,
              sellingPrice: item.sellingPrice,
              photoUri: item.photoUri,
              notes: item.notes,
              isActive: item.isActive,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
            });
          } else if (item.updatedAt > existing.updatedAt) {
            await tx.update(stockItems)
              .set({
                category: item.category,
                brand: item.brand,
                name: item.name,
                capacityLabel: item.capacityLabel,
                variant: item.variant,
                quantity: item.quantity,
                lowStockThreshold: item.lowStockThreshold,
                costPrice: item.costPrice,
                sellingPrice: item.sellingPrice,
                photoUri: item.photoUri,
                notes: item.notes,
                isActive: item.isActive,
                updatedAt: item.updatedAt,
              })
              .where(eq(stockItems.id, item.id));
          }
        }
      }

      // C. Customers
      if (changes.customers && changes.customers.length > 0) {
        for (const customer of changes.customers) {
          const [existing] = await tx.select().from(customers).where(eq(customers.id, customer.id));
          if (!existing) {
            await tx.insert(customers).values({
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              altPhone: customer.altPhone,
              businessName: customer.businessName,
              address: customer.address,
              gstNumber: customer.gstNumber,
              outstandingBalance: customer.outstandingBalance,
              purchasedScaleName: customer.purchasedScaleName,
              model: customer.model,
              sellingPrice: customer.sellingPrice,
              gstCharged: customer.gstCharged,
              photoUri: customer.photoUri,
              notes: customer.notes,
              isActive: customer.isActive,
              createdAt: customer.createdAt,
              updatedAt: customer.updatedAt,
            });
          } else if (customer.updatedAt > existing.updatedAt) {
            await tx.update(customers)
              .set({
                name: customer.name,
                phone: customer.phone,
                altPhone: customer.altPhone,
                businessName: customer.businessName,
                address: customer.address,
                gstNumber: customer.gstNumber,
                outstandingBalance: customer.outstandingBalance,
                purchasedScaleName: customer.purchasedScaleName,
                model: customer.model,
                sellingPrice: customer.sellingPrice,
                gstCharged: customer.gstCharged,
                photoUri: customer.photoUri,
                notes: customer.notes,
                isActive: customer.isActive,
                updatedAt: customer.updatedAt,
              })
              .where(eq(customers.id, customer.id));
          }
        }
      }

      // D. Transactions (Immutable, write-once or delete)
      if (changes.transactions && changes.transactions.length > 0) {
        for (const txData of changes.transactions) {
          const { items, ...txFields } = txData;
          const [existing] = await tx.select().from(transactions).where(eq(transactions.id, txFields.id));
          if (!existing) {
            // Write transaction main record
            await tx.insert(transactions).values({
              id: txFields.id,
              type: txFields.type,
              customerId: txFields.customerId,
              supplierName: txFields.supplierName,
              subtotal: txFields.subtotal,
              discount: txFields.discount,
              taxAmount: txFields.taxAmount,
              grandTotal: txFields.grandTotal,
              amountPaid: txFields.amountPaid,
              paymentMode: txFields.paymentMode,
              paymentStatus: txFields.paymentStatus,
              createdByStaffId: txFields.createdByStaffId,
              notes: txFields.notes,
              createdAt: txFields.createdAt,
            });

            // Write transaction line items
            if (items && items.length > 0) {
              for (const item of items) {
                await tx.insert(transactionItems).values({
                  id: item.id,
                  transactionId: item.transactionId,
                  stockItemId: item.stockItemId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                });
              }
            }
          }
        }
      }

      // --- 2. PROCESS CLIENT DELETIONS (VOIDED TRANSACTIONS) ---
      const activeIds = activeTransactionIds || [];
      // Fetch all transactions currently in Neon that were created BEFORE or AT the client's last sync time
      const existingCandidates = await tx.select({ id: transactions.id })
        .from(transactions)
        .where(lte(transactions.createdAt, lastSyncTimestamp));
      
      const candidateIds = existingCandidates.map(c => c.id);
      // Transactions that are on the server but missing from client's active list are voided!
      const voidedTxIds = candidateIds.filter(id => !activeIds.includes(id));

      if (voidedTxIds.length > 0) {
        console.log(`Detected voided transactions: ${voidedTxIds.join(', ')}`);
        for (const txId of voidedTxIds) {
          // Check if already logged as deleted
          const [alreadyDeleted] = await tx.select().from(deletedRecords).where(eq(deletedRecords.id, txId));
          if (!alreadyDeleted) {
            // Delete from database (foreign key cascade deletes transaction items)
            await tx.delete(transactionItems).where(eq(transactionItems.transactionId, txId));
            await tx.delete(transactions).where(eq(transactions.id, txId));
            
            // Log deletion
            await tx.insert(deletedRecords).values({
              id: txId,
              entityType: 'transaction',
              deletedAt: serverTimestamp,
            });
          }
        }
      }

      // --- 3. FETCH SERVER UPDATES FOR THE CLIENT ---
      // Fetch records updated since the client's lastSyncTimestamp
      const updatedStaff = await tx.select().from(staffUsers).where(gt(staffUsers.updatedAt, lastSyncTimestamp));
      const updatedStock = await tx.select().from(stockItems).where(gt(stockItems.updatedAt, lastSyncTimestamp));
      const updatedCustomers = await tx.select().from(customers).where(gt(customers.updatedAt, lastSyncTimestamp));
      
      // Fetch transactions created since lastSyncTimestamp
      const newTransactions = await tx.select().from(transactions).where(gt(transactions.createdAt, lastSyncTimestamp));
      const transactionsWithItems = [];

      for (const t of newTransactions) {
        const items = await tx.select().from(transactionItems).where(eq(transactionItems.transactionId, t.id));
        transactionsWithItems.push({
          ...t,
          items,
        });
      }

      // Fetch deleted transaction IDs since lastSyncTimestamp
      const newlyDeleted = await tx.select({ id: deletedRecords.id })
        .from(deletedRecords)
        .where(gt(deletedRecords.deletedAt, lastSyncTimestamp));
      
      const deletedTransactionIds = newlyDeleted.map(d => d.id);

      return {
        serverTimestamp,
        updates: {
          staffUsers: updatedStaff,
          stockItems: updatedStock,
          customers: updatedCustomers,
          transactions: transactionsWithItems,
        },
        deletedTransactionIds,
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Database transaction sync error:', error);
    res.status(500).json({ error: error.message || 'Database error occurred during sync.' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', serverTimestamp: Date.now() });
});

// Run server initialization and then start listening
initializeDatabase().then(() => {
  // On Vercel, the listener wrapper is handled by the platform itself, so we skip app.listen
  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`Brahma Associates sync server is running on http://localhost:${PORT}`);
    });
  }
});

export default app;
