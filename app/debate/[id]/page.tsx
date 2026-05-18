import { Suspense } from "react";
import { DebateRoom } from "@/components/debate/debate-room";

async function DebateRoomServer({ idPromise }: { idPromise: Promise<string> }) {
  const id = await idPromise;
  return <DebateRoom roomId={id} />;
}

export default async function DebatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const idPromise = params.then((p) => p.id);
  return (
    <Suspense fallback={<DebateRoomFallback />}>
      <DebateRoomServer idPromise={idPromise} />
    </Suspense>
  );
}

function DebateRoomFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-background">
      <div className="text-sm text-muted-foreground">Loading debate…</div>
    </main>
  );
}
