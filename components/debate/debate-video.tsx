"use client";

export function DebateVideo({ roomId }: { roomId: string }) {
  const subdomain = process.env.NEXT_PUBLIC_DAILY_SUBDOMAIN;
  if (!subdomain) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
        Video unavailable — set NEXT_PUBLIC_DAILY_SUBDOMAIN.
      </div>
    );
  }
  const url = `https://${subdomain}.daily.co/${roomId}?embed=true`;
  return (
    <iframe
      src={url}
      allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
      title={`Debate video ${roomId}`}
      className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black"
    />
  );
}
