import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { currentMonth, dashboardFilterSchema } from "@/lib/dashboard";
import { getDashboardData } from "@/lib/dashboard-data";
import { Dashboard } from "@/components/dashboard";
export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const initialData = await getDashboardData(
    user.id,
    dashboardFilterSchema.parse({ month: currentMonth() }),
  );
  return (
    <Dashboard
      user={user}
      initialData={initialData}
      initialHideBalance={
        (await cookies()).get("duitku_hide_balance")?.value === "true"
      }
    />
  );
}
