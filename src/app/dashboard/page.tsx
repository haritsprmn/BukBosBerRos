import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Transaction } from "@/lib/validation";
import { Dashboard } from "@/components/dashboard";
export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const result = await db.query<Transaction>(
    "SELECT id,type,title,amount::float8 AS amount,category,to_char(date,'YYYY-MM-DD') AS date,note FROM duitku.transactions WHERE user_id=$1 ORDER BY date DESC,created_at DESC",
    [user.id],
  );
  return (
    <Dashboard
      user={user}
      initialTransactions={result.rows}
      initialHideBalance={
        (await cookies()).get("duitku_hide_balance")?.value === "true"
      }
    />
  );
}
