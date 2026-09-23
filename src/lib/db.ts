import "server-only";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as { duitkuPool?: Pool };
export const db =
  globalForDb.duitkuPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
  });
if (!globalForDb.duitkuPool) {
  db.on("error", (error) =>
    console.error("DUITku database pool:", error.message),
  );
}
if (process.env.NODE_ENV !== "production") globalForDb.duitkuPool = db;
