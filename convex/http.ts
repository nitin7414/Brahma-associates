import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// CORS Headers Helper for cross-origin sync requests from Web/Mobile
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

http.route({
  path: "/api/sync",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // 1. Handle Options (CORS preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // 2. Authentication Check
    const authHeader = request.headers.get("Authorization");
    const secret = process.env.SYNC_API_SECRET;

    if (!secret) {
      console.error("SYNC_API_SECRET is not defined on the Convex server!");
      return new Response(JSON.stringify({ error: "Sync server authentication is misconfigured." }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized. Bearer token is missing." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.substring(7);
    if (token !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized. Invalid bearer token." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 3. Process Sync Mutation
    try {
      const payload = await request.json();
      
      const result = await ctx.runMutation(api.sync.sync, {
        lastSyncTimestamp: payload.lastSyncTimestamp,
        deletedTransactionIds: payload.deletedTransactionIds,
        changes: payload.changes,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (error: any) {
      console.error("Convex HTTP sync error:", error);
      return new Response(JSON.stringify({ error: "Internal database synchronization error.", details: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }),
});

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    return new Response(JSON.stringify({ status: "ok", database: "convex", serverTimestamp: Date.now() }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

export default http;
