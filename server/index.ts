import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './client';
import { staffUsers, stockItems, customers, transactions, transactionItems, deletedRecords } from './schema';
import { eq, gt, lte, and, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';

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

// Authentication Middleware for API sync endpoint
const authenticateSync = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  const secret = process.env.SYNC_API_SECRET;

  if (!secret) {
    console.error('CRITICAL ERROR: SYNC_API_SECRET environment variable is not defined on the server!');
    return res.status(500).json({ error: 'Sync server authentication is misconfigured.' });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Bearer token is missing.' });
  }

  const token = authHeader.substring(7);
  if (token !== secret) {
    return res.status(401).json({ error: 'Unauthorized. Invalid bearer token.' });
  }

  next();
};

// Zod validation schemas for request validation
const staffUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  pinHash: z.string(),
  isActive: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

const stockItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  brand: z.string().nullable().optional(),
  name: z.string(),
  capacityLabel: z.string().nullable().optional(),
  variant: z.string().nullable().optional(),
  quantity: z.number().int(),
  lowStockThreshold: z.number().int(),
  costPrice: z.number().nullable().optional(),
  sellingPrice: z.number().nullable().optional(),
  photoUri: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  altPhone: z.string().nullable().optional(),
  businessName: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  gstNumber: z.string().nullable().optional(),
  outstandingBalance: z.number(),
  purchasedScaleName: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  sellingPrice: z.number().nullable().optional(),
  gstCharged: z.number().nullable().optional(),
  photoUri: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

const transactionItemSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  stockItemId: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  lineTotal: z.number(),
});

const transactionSchema = z.object({
  id: z.string(),
  type: z.string(),
  customerId: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  subtotal: z.number(),
  discount: z.number(),
  taxAmount: z.number(),
  grandTotal: z.number(),
  amountPaid: z.number(),
  paymentMode: z.string().nullable().optional(),
  paymentStatus: z.string(),
  createdByStaffId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.number().int(),
  items: z.array(transactionItemSchema).optional(),
});

const syncRequestSchema = z.object({
  lastSyncTimestamp: z.number().int(),
  deletedTransactionIds: z.array(z.string()).optional(),
  changes: z.object({
    staffUsers: z.array(staffUserSchema).optional(),
    stockItems: z.array(stockItemSchema).optional(),
    customers: z.array(customerSchema).optional(),
    transactions: z.array(transactionSchema).optional(),
  }),
});

// REST Sync Endpoint
app.post('/api/sync', authenticateSync, async (req, res) => {
  try {
    // Validate request payload structure
    const parsed = syncRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn('Sync validation failed:', parsed.error.format());
      return res.status(400).json({ error: 'Invalid sync payload structure.', details: parsed.error.format() });
    }

    const { lastSyncTimestamp, deletedTransactionIds, changes } = parsed.data;
    const serverTimestamp = Date.now();

    console.log(`Sync request received. Client Last Sync: ${lastSyncTimestamp}`);

    const result = await db.transaction(async (tx) => {
      // --- 1. PROCESS CLIENT CHANGES (BULK UPSERTS) ---

      // A. Staff Users (upsert newer records based on updatedAt)
      if (changes.staffUsers && changes.staffUsers.length > 0) {
        await tx.insert(staffUsers)
          .values(changes.staffUsers.map(user => ({
            id: user.id,
            name: user.name,
            role: user.role,
            pinHash: user.pinHash,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          })))
          .onConflictDoUpdate({
            target: staffUsers.id,
            set: {
              name: sql`EXCLUDED.name`,
              role: sql`EXCLUDED.role`,
              pinHash: sql`EXCLUDED.pin_hash`,
              isActive: sql`EXCLUDED.is_active`,
              updatedAt: sql`EXCLUDED.updated_at`,
            },
            where: sql`EXCLUDED.updated_at > staff_users.updated_at`,
          });
      }

      // B. Stock Items (upsert newer records based on updatedAt)
      if (changes.stockItems && changes.stockItems.length > 0) {
        await tx.insert(stockItems)
          .values(changes.stockItems.map(item => ({
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
          })))
          .onConflictDoUpdate({
            target: stockItems.id,
            set: {
              category: sql`EXCLUDED.category`,
              brand: sql`EXCLUDED.brand`,
              name: sql`EXCLUDED.name`,
              capacityLabel: sql`EXCLUDED.capacity_label`,
              variant: sql`EXCLUDED.variant`,
              quantity: sql`EXCLUDED.quantity`,
              lowStockThreshold: sql`EXCLUDED.low_stock_threshold`,
              costPrice: sql`EXCLUDED.cost_price`,
              sellingPrice: sql`EXCLUDED.selling_price`,
              photoUri: sql`EXCLUDED.photo_uri`,
              notes: sql`EXCLUDED.notes`,
              isActive: sql`EXCLUDED.is_active`,
              updatedAt: sql`EXCLUDED.updated_at`,
            },
            where: sql`EXCLUDED.updated_at > stock_items.updated_at`,
          });
      }

      // C. Customers (upsert newer records based on updatedAt)
      if (changes.customers && changes.customers.length > 0) {
        await tx.insert(customers)
          .values(changes.customers.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            altPhone: c.altPhone,
            businessName: c.businessName,
            address: c.address,
            gstNumber: c.gstNumber,
            outstandingBalance: c.outstandingBalance,
            purchasedScaleName: c.purchasedScaleName,
            model: c.model,
            sellingPrice: c.sellingPrice,
            gstCharged: c.gstCharged,
            photoUri: c.photoUri,
            notes: c.notes,
            isActive: c.isActive,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          })))
          .onConflictDoUpdate({
            target: customers.id,
            set: {
              name: sql`EXCLUDED.name`,
              phone: sql`EXCLUDED.phone`,
              altPhone: sql`EXCLUDED.alt_phone`,
              businessName: sql`EXCLUDED.business_name`,
              address: sql`EXCLUDED.address`,
              gstNumber: sql`EXCLUDED.gst_number`,
              outstandingBalance: sql`EXCLUDED.outstanding_balance`,
              purchasedScaleName: sql`EXCLUDED.purchased_scale_name`,
              model: sql`EXCLUDED.model`,
              sellingPrice: sql`EXCLUDED.selling_price`,
              gstCharged: sql`EXCLUDED.gst_charged`,
              photoUri: sql`EXCLUDED.photo_uri`,
              notes: sql`EXCLUDED.notes`,
              isActive: sql`EXCLUDED.is_active`,
              updatedAt: sql`EXCLUDED.updated_at`,
            },
            where: sql`EXCLUDED.updated_at > customers.updated_at`,
          });
      }

      // D. Transactions (Immutable ledger records, write once)
      if (changes.transactions && changes.transactions.length > 0) {
        await tx.insert(transactions)
          .values(changes.transactions.map(t => ({
            id: t.id,
            type: t.type,
            customerId: t.customerId,
            supplierName: t.supplierName,
            subtotal: t.subtotal,
            discount: t.discount,
            taxAmount: t.taxAmount,
            grandTotal: t.grandTotal,
            amountPaid: t.amountPaid,
            paymentMode: t.paymentMode,
            paymentStatus: t.paymentStatus,
            createdByStaffId: t.createdByStaffId,
            notes: t.notes,
            createdAt: t.createdAt,
          })))
          .onConflictDoNothing();

        // Write line items (write once)
        const lineItems = changes.transactions.flatMap(t => t.items || []);
        if (lineItems.length > 0) {
          await tx.insert(transactionItems)
            .values(lineItems.map(item => ({
              id: item.id,
              transactionId: item.transactionId,
              stockItemId: item.stockItemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            })))
            .onConflictDoNothing();
        }
      }

      // --- 2. PROCESS CLIENT DELETIONS (VOIDS) ---
      const deletedIds = deletedTransactionIds || [];
      if (deletedIds.length > 0) {
        console.log(`Processing voided transactions: ${deletedIds.join(', ')}`);
        
        // Execute cascade delete
        await tx.delete(transactionItems).where(inArray(transactionItems.transactionId, deletedIds));
        await tx.delete(transactions).where(inArray(transactions.id, deletedIds));

        for (const txId of deletedIds) {
          // Log deletion tombstone on server so other devices pull it
          const [alreadyDeleted] = await tx.select().from(deletedRecords).where(eq(deletedRecords.id, txId));
          if (!alreadyDeleted) {
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

      // Fetch deleted transaction IDs logged since lastSyncTimestamp
      const newlyDeleted = await tx.select({ id: deletedRecords.id })
        .from(deletedRecords)
        .where(gt(deletedRecords.deletedAt, lastSyncTimestamp));

      const serverDeletedTransactionIds = newlyDeleted.map(d => d.id);

      return {
        serverTimestamp,
        updates: {
          staffUsers: updatedStaff,
          stockItems: updatedStock,
          customers: updatedCustomers,
          transactions: transactionsWithItems,
        },
        deletedTransactionIds: serverDeletedTransactionIds,
      };
    });

    res.json(result);
  } catch (error: any) {
    // Log detailed internal details securely on server, do not leak to client
    console.error('Database transaction sync error:', error);
    res.status(500).json({ error: 'Internal database synchronization error. Please check server logs.' });
  }
});

// Health check endpoint (also pings database to wake up Neon compute and verify connection)
app.get('/health', async (req, res) => {
  try {
    await db.execute(sql`SELECT 1;`);
    res.json({ status: 'ok', database: 'connected', serverTimestamp: Date.now() });
  } catch (error: any) {
    console.error('Health check database query failed:', error);
    res.status(500).json({ status: 'error', database: 'disconnected', details: error.message });
  }
});

// Run server initialization only if not on Vercel or explicitly requested
if (!process.env.VERCEL || process.env.RUN_DB_INIT === 'true') {
  initializeDatabase().then(() => {
    if (!process.env.VERCEL) {
      app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`Brahma Associates sync server is running on port ${PORT} (bound to 0.0.0.0, network accessible)`);
      });
    }
  });
}

export default app;
