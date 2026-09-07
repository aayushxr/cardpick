import { redirect } from "next/navigation";
import { isAuthedPage } from "@/lib/auth";
import { getFxRates } from "@/lib/fx-rates";
import { kv } from "@/lib/kv";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/SettingsForm";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await isAuthedPage())) redirect("/login");
  const [settings, fx] = await Promise.all([getSettings(), getFxRates()]);
  return (
    <Shell>
      <SettingsForm initial={settings} fx={fx} persistent={kv().persistent} />
    </Shell>
  );
}
