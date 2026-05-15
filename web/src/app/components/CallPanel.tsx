"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  ConnectionState,
  Track,
  type RemoteTrack,
} from "livekit-client";

type TokenResponse = {
  url: string;
  token: string;
  room: string;
  identity: string;
};

type Commitment = {
  amount: string;
  date: string;
};

type UiState =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "connected"; room: string; identity: string; participants: number; commitment?: Commitment }
  | { kind: "error"; message: string };

export default function CallPanel() {
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ui, setUi] = useState<UiState>({ kind: "idle" });

  // Keep the participant count fresh while connected.
  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    setUi({
      kind: "connected",
      room: room.name,
      identity: room.localParticipant.identity,
      participants: room.remoteParticipants.size + 1,
    });
  }, []);

  // Handle data channel messages from agent
  const handleDataMessage = useCallback((payload: Uint8Array) => {
    try {
      const text = new TextDecoder().decode(payload);
      const msg = JSON.parse(text) as { type: string; [key: string]: unknown };
      if (msg.type === "commitment_reached") {
        setUi((prev) => {
          if (prev.kind !== "connected") return prev;
          return {
            ...prev,
            commitment: {
              amount: String(msg.amount),
              date: String(msg.date),
            },
          };
        });
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  async function startCall() {
    setUi({ kind: "connecting" });

    try {
      // 1. Fetch a fresh token from our /api/token route.
      const res = await fetch("/api/token");
      const body = (await res.json()) as TokenResponse | { error: string };
      if (!res.ok || "error" in body) {
        const msg = "error" in body ? body.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const { url, token } = body;

      // 2. Create the Room and wire up events BEFORE connecting,
      //    so we don't miss the initial state transitions.
      const room = new Room({
        // Echo cancellation + noise suppression — better demo audio.
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        // Adaptive stream + dynacast keep bandwidth low; harmless for audio-only.
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room
        .on(RoomEvent.ParticipantConnected, refreshParticipants)
        .on(RoomEvent.ParticipantDisconnected, refreshParticipants)
        .on(RoomEvent.Disconnected, () => {
          setUi({ kind: "idle" });
          roomRef.current = null;
        })
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Audio && audioRef.current) {
            track.attach(audioRef.current);
          }
        })
        .on(RoomEvent.DataReceived, ({ payload }) => {
          handleDataMessage(payload);
        });

      // 3. Connect, then publish the microphone.
      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      refreshParticipants();
    } catch (err) {
      // Clean up any half-created room.
      await roomRef.current?.disconnect();
      roomRef.current = null;
      setUi({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function endCall() {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setUi({ kind: "idle" });
  }

  // Ensure we always disconnect when the component unmounts (page nav, HMR).
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect().catch(() => {});
      roomRef.current = null;
    };
  }, []);

  const isBusy = ui.kind === "connecting";
  const isConnected = ui.kind === "connected";

  return (
    <div className="mt-10 flex flex-col items-start gap-3">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={startCall}
          disabled={isBusy || isConnected}
          className="rounded-full bg-zinc-900 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {ui.kind === "connecting" ? "Connecting…" : "Start call"}
        </button>
        <button
          type="button"
          onClick={endCall}
          disabled={!isConnected}
          className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-base font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          End call
        </button>
      </div>

      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        Click Start call to speak with our representative.
      </span>

      {/* Status / debug panel */}
      {ui.kind === "connected" && (
        <div className="mt-2 w-full max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="mb-2 flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Connected
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs text-zinc-700 dark:text-zinc-300">
            <dt className="text-zinc-500">room</dt>
            <dd>{ui.room}</dd>
            <dt className="text-zinc-500">identity</dt>
            <dd>{ui.identity}</dd>
            <dt className="text-zinc-500">participants</dt>
            <dd>{ui.participants}</dd>
          </dl>
        </div>
      )}

      {/* Commitment reached */}
      {ui.kind === "connected" && ui.commitment && (
        <div className="w-full max-w-xl rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
          <div className="mb-1 flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Payment Commitment Received
          </div>
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            You agreed to pay <strong>{ui.commitment.amount}</strong> on{" "}
            <strong>{ui.commitment.date}</strong>.
          </p>
        </div>
      )}

      {ui.kind === "connecting" && (
        <div className="mt-2 w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Requesting microphone permission and joining the room…
        </div>
      )}

      {ui.kind === "error" && (
        <div className="mt-2 w-full max-w-xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm dark:border-rose-900 dark:bg-rose-950/30">
          <div className="mb-1 font-medium text-rose-700 dark:text-rose-300">
            ✗ Failed
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-rose-800 dark:text-rose-200">
            {ui.message}
          </pre>
        </div>
      )}

      {/* Hidden audio sink for future remote agent audio. */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
    </div>
  );
}