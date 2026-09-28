import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, checkOrigin } from "@/lib/http";
import { budgetMonthSchema, budgetSchema, type BudgetSummary } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
    const month = budgetMonthSchema.parse(new URL(request.url).searchParams.get("month"));
    // Both subqueries are scoped to the session owner and use the same DB snapshot.
    const result = await db.query<{ amount: number | null; expense: number }>(
      `SELECT
        (SELECT amount::float8 FROM duitku.budgets WHERE user_id=$1 AND month=$2::date) AS amount,
        (SELECT COALESCE(SUM(amount),0)::float8 FROM duitku.transactions
          WHERE user_id=$1 AND type='expense' AND date >= $2::date
          AND date < $2::date + interval '1 month') AS expense`,
      [user.id, `${month}-01`],
    );
    const { amount, expense } = result.rows[0];
    const summary: BudgetSummary = {
      month, amount, expense,
      remaining: amount === null ? null : amount - expense,
      percentage: amount === null ? null : (expense / amount) * 100,
      exceeded: amount !== null && expense > amount,
    };
    return NextResponse.json({ summary }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  const forbidden = checkOrigin(request);
  if (forbidden) return forbidden;
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
    const { month, amount } = budgetSchema.parse(await request.json());
    // The composite primary key makes concurrent saves update one budget per month.
    await db.query(
      `INSERT INTO duitku.budgets(user_id,month,amount) VALUES($1,$2,$3)
       ON CONFLICT(user_id,month) DO UPDATE SET amount=EXCLUDED.amount,updated_at=now()`,
      [user.id, `${month}-01`, amount],
    );
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
