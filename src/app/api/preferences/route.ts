import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser, cookieOptions } from "@/lib/auth";
import { checkOrigin, apiError } from "@/lib/http";
export async function POST(request: Request) {
  const forbidden = checkOrigin(request);
  if (forbidden) return forbidden;
  try {
    if (!(await getUser()))
      return NextResponse.json(
        { error: "Silakan masuk kembali." },
        { status: 401 },
      );
    const { hideBalance } = z
      .object({ hideBalance: z.boolean() })
      .parse(await request.json());
    (await cookies()).set("duitku_hide_balance", String(hideBalance), {
      ...cookieOptions,
      maxAge: 31536000,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
