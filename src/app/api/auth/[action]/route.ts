import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSession,
  hash,
  hashPassword,
  verifyPassword,
  rateLimit,
  sessionCookie,
  cookieOptions,
} from "@/lib/auth";
import { loginSchema, registerSchema } from "@/lib/validation";
import { apiError, checkOrigin } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const forbidden = checkOrigin(request);
  if (forbidden) return forbidden;
  try {
    const { action } = await params;
    if (action === "logout") {
      const jar = await cookies();
      const token = jar.get(sessionCookie)?.value;
      if (token)
        await db.query("DELETE FROM duitku.sessions WHERE token_hash=$1", [
          hash(token),
        ]);
      jar.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
      return NextResponse.json({ ok: true });
    }
    if (action !== "login" && action !== "register")
      return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
    const body = await request.json();
    const input = (action === "register" ? registerSchema : loginSchema).parse(
      body,
    );
    if (!(await rateLimit(input.email)))
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." },
        { status: 429 },
      );
    let userId: string;
    if (action === "register") {
      const data = registerSchema.parse(body);
      userId = randomUUID();
      const result = await db.query(
        "INSERT INTO duitku.users(id,name,email,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING id",
        [userId, data.name, data.email, await hashPassword(data.password)],
      );
      if (!result.rowCount)
        return NextResponse.json(
          { error: "Email sudah terdaftar. Silakan masuk." },
          { status: 409 },
        );
    } else {
      const result = await db.query(
        "SELECT id,password_hash FROM duitku.users WHERE email=$1",
        [input.email],
      );
      const user = result.rows[0];
      const valid = await verifyPassword(
        input.password,
        user?.password_hash ?? `${"0".repeat(32)}:${"0".repeat(128)}`,
      );
      if (!user || !valid)
        return NextResponse.json(
          { error: "Email atau kata sandi salah." },
          { status: 401 },
        );
      userId = user.id;
    }
    await createSession(userId);
    return NextResponse.json(
      { ok: true },
      { status: action === "register" ? 201 : 200 },
    );
  } catch (error) {
    return apiError(error);
  }
}
