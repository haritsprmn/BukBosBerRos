import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
export default async function RegisterPage() {
  if (await getUser()) redirect("/dashboard");
  return <AuthForm register />;
}
