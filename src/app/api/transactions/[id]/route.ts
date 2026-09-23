import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { transactionSchema } from "@/lib/validation";
import { checkOrigin, apiError } from "@/lib/http";

async function mutate(
  request: Request,
  params: Promise<{ id: string }>,
  remove = false,
) {
  const forbidden = checkOrigin(request);
  if (forbidden) return forbidden;
  try {
    const user = await getUser();
    if (!user)
      return NextResponse.json(
        { error: "Silakan masuk kembali." },
        { status: 401 },
      );
    const id = z
      .string()
      .uuid()
      .parse((await params).id);
    if (remove) {
      const result = await db.query(
        "DELETE FROM duitku.transactions WHERE id=$1 AND user_id=$2",
        [id, user.id],
      );
      if (!result.rowCount)
        return NextResponse.json(
          { error: "Transaksi tidak ditemukan." },
          { status: 404 },
        );
      return NextResponse.json({ ok: true });
    }
    const t = transactionSchema.parse(await request.json());
    const result = await db.query(
      "UPDATE duitku.transactions SET type=$3,title=$4,amount=$5,category=$6,date=$7,note=$8 WHERE id=$1 AND user_id=$2",
      [id, user.id, t.type, t.title, t.amount, t.category, t.date, t.note],
    );
    if (!result.rowCount)
      return NextResponse.json(
        { error: "Transaksi tidak ditemukan." },
        { status: 404 },
      );
    return NextResponse.json({ transaction: { id, ...t } });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return mutate(request, params);
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return mutate(request, params, true);
}
