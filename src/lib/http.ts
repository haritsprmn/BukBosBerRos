import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
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
