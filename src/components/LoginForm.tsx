"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret }) });
    setBusy(false);
    if (!res.ok) {
      setError("Wrong secret.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-10 flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Shared secret</h1>
      <p className="text-sm text-muted">Set once. Stored in a cookie on this device.</p>
      <input
        type="password"
        autoComplete="current-password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="secret"
        className="rounded-xl border border-line bg-panel px-4 py-3 text-base outline-none focus:border-accent"
      />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button disabled={busy || !secret} className="rounded-xl bg-fg px-4 py-3 font-medium text-bg disabled:opacity-50">
        {busy ? "Checking" : "Continue"}
      </button>
    </form>
  );
}
