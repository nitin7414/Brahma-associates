import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('WARNING: DATABASE_URL environment variable is not defined in server/.env!');
}

// Enable WebSocket-based driver to support multi-query interactive transactions in Drizzle
const pool = new Pool({ connectionString: databaseUrl || '', webSocketConstructor: ws } as any);
export const db = drizzle(pool, { schema });
