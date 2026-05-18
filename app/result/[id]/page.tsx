import { Suspense } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ResultCard } from "@/components/debate/result-card";

async function getResult(roomId: string) {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = host ? `${proto}://${host}` : "";
  const resp = await fetch(`${base}/api/room-state?roomId=${roomId}`, {
    cache: "no-store",
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function ResultLoader({ idPromise }: { idPromise: Promise<string> }) {
  const id = await idPromise;
  const data = await getResult(id);
  if (!data) notFound();
  return <ResultCard data={data} />;
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const idPromise = params.then((p) => p.id);
  return (
    <Suspense fallback={<ResultFallback />}>
      <ResultLoader idPromise={idPromise} />
    </Suspense>
  );
}

function ResultFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-background">
      <div className="text-sm text-muted-foreground">Loading result…</div>
    </main>
  );
}
