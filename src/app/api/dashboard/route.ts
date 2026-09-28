import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { dashboardFilterSchema } from "@/lib/dashboard";
import { getDashboardData } from "@/lib/dashboard-data";
import { apiError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
    }
    const filters = dashboardFilterSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return NextResponse.json(await getDashboardData(user.id, filters), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
