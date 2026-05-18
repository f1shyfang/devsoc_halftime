export function TranscriptSkeleton({ label }: { label: string }) {
  return (
    <div className="magenta-sweep rounded-md border border-border bg-secondary/40 p-3">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-2 space-y-1.5">
        <div className="h-3 w-11/12 rounded bg-muted" />
        <div className="h-3 w-10/12 rounded bg-muted" />
        <div className="h-3 w-8/12 rounded bg-muted" />
      </div>
    </div>
  );
}
