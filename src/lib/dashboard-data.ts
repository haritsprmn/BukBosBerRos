import "server-only";
import { db } from "./db";
import { buildDashboard, type DashboardFilters } from "./dashboard";
import type { Transaction } from "./validation";

export async function getDashboardData(userId: string, filters: DashboardFilters) {
  const result = await db.query<Transaction>(
    "SELECT id,type,title,amount::float8 AS amount,category,to_char(date,'YYYY-MM-DD') AS date,note FROM duitku.transactions WHERE user_id=$1 ORDER BY date DESC,created_at DESC,id DESC",
    [userId],
  );
  return buildDashboard(result.rows, filters);
}
