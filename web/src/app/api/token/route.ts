import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

/**
 * GET /api/token
 *
 * Returns a short-lived LiveKit access token for a fresh, ephemeral room.
 * The browser uses this token to join the room via the LiveKit Web SDK.
 *
 * For P1 we only verify that the token is correctly signed and returns
 * the expected shape. The frontend does not yet connect to LiveKit.
 *
 * Optional query params:
 *   ?identity=alice   – override participant identity (default: random)
 *   ?room=demo-xyz    – override room name (default: random `demo-<short-uuid>`)
 */
export async function GET(request: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;

  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json(
      {
        error:
          "Missing LiveKit env vars. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.",
      },
      { status: 500 },
    );
  }

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

  const token = await at.toJwt();

  return NextResponse.json({
    url: LIVEKIT_URL,
    token,
    room,
    identity,
  });
}