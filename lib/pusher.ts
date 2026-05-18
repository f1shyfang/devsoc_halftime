import Pusher from "pusher";

declare global {
  var __debateconnect_pusher: Pusher | undefined;
}

export function getPusher(): Pusher {
  if (!global.__debateconnect_pusher) {
    global.__debateconnect_pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    });
  }
  return global.__debateconnect_pusher;
}

export function debateChannel(roomId: string) {
  return `debate-${roomId}`;
}

export function lobbyChannel(sessionId: string) {
  return `lobby-${sessionId}`;
}
