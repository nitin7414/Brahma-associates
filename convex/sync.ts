import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  staffUserValidator,
  stockItemValidator,
  customerValidator,
  transactionValidator,
} from "./types";

export const sync = mutation({
  args: {
    lastSyncTimestamp: v.float64(),
    deletedTransactionIds: v.optional(v.array(v.string())),
    changes: v.object({
      staffUsers: v.optional(v.array(staffUserValidator)),
      stockItems: v.optional(v.array(stockItemValidator)),
      customers: v.optional(v.array(customerValidator)),
      transactions: v.optional(v.array(transactionValidator)),
    }),
  },
  handler: async (ctx, args) => {
    const { lastSyncTimestamp, deletedTransactionIds, changes } = args;
    const serverTimestamp = Date.now();

    // 1. Process client changes
    // A. Staff Users (upsert newer records based on updatedAt)
    if (changes.staffUsers) {
      for (const user of changes.staffUsers) {
        const existing = await ctx.db
          .query("staff_users")
          .withIndex("by_client_id", (q) => q.eq("id", user.id))
          .unique();

        if (existing) {
          if (user.updatedAt > existing.updatedAt) {
            await ctx.db.patch(existing._id, {
              name: user.name,
              role: user.role,
              pinHash: user.pinHash,
              isActive: user.isActive,
              updatedAt: user.updatedAt,
            });
          }
        } else {
          await ctx.db.insert("staff_users", {
            id: user.id,
            name: user.name,
            role: user.role,
            pinHash: user.pinHash,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          });
        }
      }
    }

    // B. Stock Items (upsert newer records based on updatedAt)
    if (changes.stockItems) {
      for (const item of changes.stockItems) {
        const existing = await ctx.db
          .query("stock_items")
          .withIndex("by_client_id", (q) => q.eq("id", item.id))
          .unique();

        if (existing) {
          if (item.updatedAt > existing.updatedAt) {
            await ctx.db.patch(existing._id, {
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
            });
          }
        } else {
          await ctx.db.insert("stock_items", {
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
        }
      }
    }

    // C. Customers (upsert newer records based on updatedAt)
    if (changes.customers) {
      for (const customer of changes.customers) {
        const existing = await ctx.db
          .query("customers")
          .withIndex("by_client_id", (q) => q.eq("id", customer.id))
          .unique();

        if (existing) {
          if (customer.updatedAt > existing.updatedAt) {
            await ctx.db.patch(existing._id, {
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
            });
          }
        } else {
          await ctx.db.insert("customers", {
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
        }
      }
    }

    // D. Transactions (Immutable ledger records, write once)
    if (changes.transactions) {
      for (const t of changes.transactions) {
        const existing = await ctx.db
          .query("transactions")
          .withIndex("by_client_id", (q) => q.eq("id", t.id))
          .unique();

        if (!existing) {
          await ctx.db.insert("transactions", {
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
          });

          // Write line items (write once)
          if (t.items) {
            for (const item of t.items) {
              const existingItem = await ctx.db
                .query("transaction_items")
                .withIndex("by_client_id", (q) => q.eq("id", item.id))
                .unique();
              
              if (!existingItem) {
                await ctx.db.insert("transaction_items", {
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
    }

    // 2. Process deletions (voids)
    const deletedIds = deletedTransactionIds || [];
    if (deletedIds.length > 0) {
      for (const txId of deletedIds) {
        // Cascade delete transaction items
        const items = await ctx.db
          .query("transaction_items")
          .withIndex("by_transactionId", (q) => q.eq("transactionId", txId))
          .collect();
        for (const item of items) {
          await ctx.db.delete(item._id);
        }

        // Delete main transaction
        const existingTx = await ctx.db
          .query("transactions")
          .withIndex("by_client_id", (q) => q.eq("id", txId))
          .unique();
        if (existingTx) {
          await ctx.db.delete(existingTx._id);
        }

        // Log deletion tombstone on server so other devices pull it
        const alreadyDeleted = await ctx.db
          .query("deleted_records")
          .withIndex("by_client_id", (q) => q.eq("id", txId))
          .unique();
        if (!alreadyDeleted) {
          await ctx.db.insert("deleted_records", {
            id: txId,
            entityType: "transaction",
            deletedAt: serverTimestamp,
          });
        }
      }
    }

    // 3. Fetch server updates for the client
    const updatedStaff = await ctx.db
      .query("staff_users")
      .withIndex("by_updatedAt", (q) => q.gt("updatedAt", lastSyncTimestamp))
      .collect();

    const updatedStock = await ctx.db
      .query("stock_items")
      .withIndex("by_updatedAt", (q) => q.gt("updatedAt", lastSyncTimestamp))
      .collect();

    const updatedCustomers = await ctx.db
      .query("customers")
      .withIndex("by_updatedAt", (q) => q.gt("updatedAt", lastSyncTimestamp))
      .collect();

    const newTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", lastSyncTimestamp))
      .collect();

    const transactionsWithItems = [];
    for (const t of newTransactions) {
      const items = await ctx.db
        .query("transaction_items")
        .withIndex("by_transactionId", (q) => q.eq("transactionId", t.id))
        .collect();
      
      transactionsWithItems.push({
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
        items: items.map((item) => ({
          id: item.id,
          transactionId: item.transactionId,
          stockItemId: item.stockItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      });
    }

    const newlyDeleted = await ctx.db
      .query("deleted_records")
      .withIndex("by_deletedAt", (q) => q.gt("deletedAt", lastSyncTimestamp))
      .collect();
    
    const serverDeletedTransactionIds = newlyDeleted.map((d) => d.id);

    return {
      serverTimestamp,
      updates: {
        staffUsers: updatedStaff.map((u) => ({
          id: u.id,
          name: u.name,
          role: u.role,
          pinHash: u.pinHash,
          isActive: u.isActive,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        })),
        stockItems: updatedStock.map((item) => ({
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
        })),
        customers: updatedCustomers.map((c) => ({
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
        })),
        transactions: transactionsWithItems,
      },
      deletedTransactionIds: serverDeletedTransactionIds,
    };
  },
});
