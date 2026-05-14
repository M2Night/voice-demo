import CallPanel from "./components/CallPanel";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <main className="w-full max-w-2xl">
        {/* Brand */}
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">
            AF
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Acme Finance
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Voice Agent Demo
            </span>
          </div>
        </div>

        {/* Hero */}
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Talk to an AI
          <br />
          debt-collection agent.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          You play the debtor. The agent calls to collect a repayment commitment.
          A real-time voice conversation, built on LiveKit and Fish Audio.
        </p>

        {/* Call controls */}
        <CallPanel />

        {/* Build status */}
        <div className="mt-16 rounded-2xl border border-zinc-200 bg-white p-6 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">
            Build progress
          </h2>
          <ul className="space-y-1.5 text-zinc-600 dark:text-zinc-400">
            <li>
              <span className="mr-2 text-emerald-600 dark:text-emerald-400">✓</span>
              P0 — Static page deployed to the public web
            </li>
            <li>
              <span className="mr-2 text-emerald-600 dark:text-emerald-400">✓</span>
              P1 — Token API
            </li>
            <li>
              <span className="mr-2 text-emerald-600 dark:text-emerald-400">✓</span>
              P2 — Browser joins LiveKit room
            </li>
            <li className="opacity-50">P3 — Agent worker on cloud</li>
            <li className="opacity-50">P4 — Fish Audio TTS</li>
            <li className="opacity-50">P5 — STT + LLM loop</li>
            <li className="opacity-50">P6 — Business state machine</li>
            <li className="opacity-50">P7 — Stability polish</li>
          </ul>
        </div>

        <footer className="mt-12 text-xs text-zinc-400 dark:text-zinc-600">
          Demo only. No real debt, no real customer data.
        </footer>
      </main>
    </div>
  );
}