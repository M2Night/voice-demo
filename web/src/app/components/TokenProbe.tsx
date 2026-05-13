"use client";

import { useState } from "react";

type TokenResponse = {
  url: string;
  token: string;
  room: string;
  identity: string;
};

type TokenError = { error: string };

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: TokenResponse }
  | { status: "error"; message: string };

export default function TokenProbe() {
  const [state, setState] = useState<FetchState>({ status: "idle" });

  async function fetchToken() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/token");
      const body = (await res.json()) as TokenResponse | TokenError;
      if (!res.ok) {
        const message = "error" in body ? body.error : `HTTP ${res.status}`;
        setState({ status: "error", message });
        return;
      }
      setState({ status: "success", data: body as TokenResponse });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <div className="mt-10 flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={fetchToken}
        disabled={state.status === "loading"}
        className="rounded-full bg-zinc-900 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {state.status === "loading" ? "Requesting…" : "Get LiveKit token"}
      </button>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        P1 sanity check — calls <code className="font-mono">/api/token</code>.
      </span>

      {state.status === "success" && (
        <div className="mt-2 w-full max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="mb-2 font-medium text-emerald-700 dark:text-emerald-300">
            ✓ Token issued
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs text-zinc-700 dark:text-zinc-300">
            <dt className="text-zinc-500">url</dt>
            <dd className="break-all">{state.data.url}</dd>
            <dt className="text-zinc-500">room</dt>
            <dd>{state.data.room}</dd>
            <dt className="text-zinc-500">identity</dt>
            <dd>{state.data.identity}</dd>
            <dt className="text-zinc-500">token</dt>
            <dd className="break-all">
              {state.data.token.slice(0, 32)}…
              <span className="text-zinc-400">
                {" "}
                ({state.data.token.length} chars)
              </span>
            </dd>
          </dl>
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-2 w-full max-w-xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm dark:border-rose-900 dark:bg-rose-950/30">
          <div className="mb-1 font-medium text-rose-700 dark:text-rose-300">
            ✗ Failed
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-rose-800 dark:text-rose-200">
            {state.message}
          </pre>
        </div>
      )}
    </div>
  );
}