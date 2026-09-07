import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthedPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { artworkMap } from "@/lib/artwork";
import { Ask } from "@/components/Ask";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isAuthedPage())) redirect("/login");
  const settings = await getSettings();
  return (
    <Shell
      right={
        <Link href="/settings" className="text-sm text-muted underline-offset-4 hover:underline">
          Settings
        </Link>
      }
    >
      <Ask defaultExpensed={settings.defaultExpensed} artwork={artworkMap()} />
    </Shell>
  );
}
