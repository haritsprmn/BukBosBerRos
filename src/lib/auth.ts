import "server-only";
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db } from "./db";
import type { User } from "./validation";

const scrypt = promisify(scryptCallback);
export const sessionCookie = "duitku_session";
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: "lax" as const,
  path: "/",
};
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(expected, "hex");
  return (
    expectedBuffer.length === actual.length &&
    timingSafeEqual(actual, expectedBuffer)
  );
}
export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const result = await db.query<User>(
    `SELECT u.id,u.name,u.email FROM duitku.sessions s JOIN duitku.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [hash(token)],
  );
  return result.rows[0] ?? null;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO duitku.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [hash(token), userId],
  );
  (await cookies()).set(sessionCookie, token, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 7,
  });
}
export async function rateLimit(email: string) {
  const result = await db.query(
    `INSERT INTO duitku.auth_attempts(key,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN duitku.auth_attempts.reset_at<now() THEN 1 ELSE duitku.auth_attempts.attempts+1 END, reset_at=CASE WHEN duitku.auth_attempts.reset_at<now() THEN now()+interval '15 minutes' ELSE duitku.auth_attempts.reset_at END RETURNING attempts`,
    [hash(email)],
  );
  return result.rows[0].attempts <= 15;
}
