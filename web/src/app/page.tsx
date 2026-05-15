import CallPanel from "./components/CallPanel";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-6 py-16 dark:from-zinc-950 dark:to-zinc-900">
      <main className="w-full max-w-2xl">
        {/* Brand */}
        <div className="mb-12 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-base font-bold text-white shadow-lg">
            AF
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Acme Finance
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Accounts Receivable
            </span>
          </div>
        </div>

        {/* Hero */}
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          We need to discuss
          <br />
          <span className="text-blue-600 dark:text-blue-400">your account</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          You have an overdue balance that requires your attention.
          Our representative is ready to discuss payment options with you.
        </p>

        {/* Call controls */}
        <CallPanel />

        <footer className="mt-16 text-xs text-zinc-400 dark:text-zinc-600">
          This is a practice simulation. No actual debt collection will occur.
        </footer>
      </main>
    </div>
  );
}