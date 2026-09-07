import { redirect } from "next/navigation";
import { isAuthedPage } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function Login() {
  if (await isAuthedPage()) redirect("/");
  return (
    <Shell>
      <LoginForm />
    </Shell>
  );
}
