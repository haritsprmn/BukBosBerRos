import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next.js can normalize request.url to its listening hostname. The Host
  // header retains the address actually requested by the browser.
  const url = new URL(request.url);
  const expectedOrigin = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  if (!origin || origin !== expectedOrigin)
    return NextResponse.json(
      { error: "Permintaan tidak diizinkan." },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json(
      { error: "Format permintaan harus JSON." },
      { status: 415 },
    );
  return null;
}
export function apiError(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json(
      { error: "Format data tidak valid." },
      { status: 400 },
    );
  console.error(
    "DUITku request failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return NextResponse.json(
    {
      error:
        "Layanan sedang tidak tersedia. Periksa koneksi database lalu coba lagi.",
    },
    { status: 503 },
  );
}
