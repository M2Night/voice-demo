import { NextResponse } from "next/server";
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from "livekit-server-sdk";

/**
 * GET /api/token
 *
 * Returns a short-lived LiveKit access token for a fresh, ephemeral room.
 * The browser uses this token to join the room via the LiveKit Web SDK.
 *
 * The token also embeds a RoomConfiguration that tells LiveKit Cloud to
 * dispatch our agent (`agent_name=agent`) into this room as soon as it is
 * created. That way the user sees `participants: 2` (self + agent) instead
 * of having to manually trigger a dispatch.
 *
 * Optional query params:
 *   ?identity=alice   – override participant identity (default: random)
 *   ?room=demo-xyz    – override room name (default: random `demo-<short-uuid>`)
 */
export async function GET(request: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_AGENT_NAME } =
    process.env;

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json(
      {
        error:
          "Missing LiveKit env vars. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.",
      },
      { status: 500 },
    );
  }

  // Default agent name matches what `lk agent init` scaffolded:
  // see `agent/src/agent.py` → `@server.rtc_session(agent_name="agent")`.
  const agentName = LIVEKIT_AGENT_NAME ?? "agent";

  const { searchParams } = new URL(request.url);
  const shortId = crypto.randomUUID().slice(0, 8);
  const room = searchParams.get("room") ?? `demo-${shortId}`;
  const identity = searchParams.get("identity") ?? `user-${shortId}`;

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    ttl: "10m", // demo session is short — token expires in 10 minutes
  });

  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  // Auto-dispatch the agent into this room. LiveKit Cloud will look for any
  // worker that registered with this agent name and route a job to it.
  at.roomConfig = new RoomConfiguration({
    agents: [
      new RoomAgentDispatch({
        agentName,
      }),
    ],
  });

  const token = await at.toJwt();

  return NextResponse.json({
    url: LIVEKIT_URL,
    token,
    room,
    identity,
    agentName,
  });
}