import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { staffUserValidator } from "./types";

// Get staff user by client ID
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("staff_users")
      .withIndex("by_client_id", (q) => q.eq("id", args.id))
      .unique();
  },
});

// List all active staff users
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("staff_users")
      .filter((q) => q.eq(q.field("isActive"), 1))
      .collect();
  },
});

// Upsert a staff user record (insert or patch based on clientId)
export const upsert = mutation({
  args: staffUserValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("staff_users")
      .withIndex("by_client_id", (q) => q.eq("id", args.id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        role: args.role,
        pinHash: args.pinHash,
        isActive: args.isActive,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("staff_users", {
        id: args.id,
        name: args.name,
        role: args.role,
        pinHash: args.pinHash,
        isActive: args.isActive,
        createdAt: args.createdAt,
        updatedAt: args.updatedAt,
      });
    }
  },
});
