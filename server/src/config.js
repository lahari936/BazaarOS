import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const here = path.dirname(fileURLToPath(import.meta.url));
// server/.env first, then repo-root .env (local dev). On Render, real env vars win.
dotenv.config({ path: [path.join(here, '../.env'), path.join(here, '../../.env')], quiet: true });

export const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bazaaros',
  jwtSecret: process.env.JWT_SECRET,
  // Accept both spellings: GNANI_API_KEY (spec) and GNANAI_API_KEY (existing .env).
  gnaniKey: process.env.GNANI_API_KEY || process.env.GNANAI_API_KEY,
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
};

if (!config.jwtSecret) throw new Error('JWT_SECRET is not set');
if (!config.gnaniKey) console.warn('[config] GNANI_API_KEY missing: voice features will fail');

export let supportsTransactions = false;

export async function connectDb(uri = config.mongoUri) {
  // dbName keeps Bazaar OS in its own database even on a cluster shared with other apps.
  await mongoose.connect(uri, { dbName: process.env.MONGO_DB || 'bazaaros' });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  // Multi-document transactions need a replica set (Atlas always is). Standalone local mongod is not.
  supportsTransactions = Boolean(hello.setName || hello.msg === 'isdbgrid');
  console.log(`[db] connected (${supportsTransactions ? 'transactions on' : 'standalone: no multi-doc transactions'})`);
}

/** Run fn inside a MongoDB transaction when supported, otherwise directly. fn receives session (or null). */
export async function withTransaction(fn) {
  if (!supportsTransactions) return fn(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await fn(session); });
    return result;
  } finally {
    await session.endSession();
  }
}
