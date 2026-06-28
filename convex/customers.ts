import { query, mutation } from "./_generated/server";
import { customerValidator } from "./types";

// List all customers
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("customers").collect();
  },
});

// Upsert a customer record (insert or patch based on clientId)
export const upsert = mutation({
  args: customerValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_client_id", (q) => q.eq("id", args.id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        phone: args.phone,
        altPhone: args.altPhone,
        businessName: args.businessName,
        address: args.address,
        gstNumber: args.gstNumber,
        outstandingBalance: args.outstandingBalance,
        purchasedScaleName: args.purchasedScaleName,
        model: args.model,
        sellingPrice: args.sellingPrice,
        gstCharged: args.gstCharged,
        photoUri: args.photoUri,
        notes: args.notes,
        isActive: args.isActive,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("customers", {
        id: args.id,
        name: args.name,
        phone: args.phone,
        altPhone: args.altPhone,
        businessName: args.businessName,
        address: args.address,
        gstNumber: args.gstNumber,
        outstandingBalance: args.outstandingBalance,
        purchasedScaleName: args.purchasedScaleName,
        model: args.model,
        sellingPrice: args.sellingPrice,
        gstCharged: args.gstCharged,
        photoUri: args.photoUri,
        notes: args.notes,
        isActive: args.isActive,
        createdAt: args.createdAt,
        updatedAt: args.updatedAt,
      });
    }
  },
});
