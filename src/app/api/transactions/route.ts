import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { transactionSchema } from "@/lib/validation";
import { checkOrigin, apiError } from "@/lib/http";

export async function GET() {
  try {
    const user = await getUser();
    if (!user)
      return NextResponse.json(
        { error: "Silakan masuk kembali." },
        { status: 401 },
      );
    const result = await db.query(
      "SELECT id,type,title,amount::float8 AS amount,category,to_char(date,'YYYY-MM-DD') AS date,note FROM duitku.transactions WHERE user_id=$1 ORDER BY date DESC,created_at DESC",
      [user.id],
    );
    return NextResponse.json(
      { transactions: result.rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  const forbidden = checkOrigin(request);
  if (forbidden) return forbidden;
  try {
    const user = await getUser();
    if (!user)
      return NextResponse.json(
        { error: "Silakan masuk kembali." },
        { status: 401 },
      );
    const t = transactionSchema.parse(await request.json());
    const id = randomUUID();
    await db.query(
      "INSERT INTO duitku.transactions(id,user_id,type,title,amount,category,date,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, user.id, t.type, t.title, t.amount, t.category, t.date, t.note],
    );
    return NextResponse.json({ transaction: { id, ...t } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
