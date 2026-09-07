import Link from "next/link";

export function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-5 flex items-center justify-between">
        <Link href="/" className="display text-xl font-medium">
          cardpick
        </Link>
        {right}
      </header>
      {children}
    </main>
  );
}
