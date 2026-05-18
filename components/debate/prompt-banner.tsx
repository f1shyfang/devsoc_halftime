export function PromptBanner({ prompt }: { prompt: string }) {
  return (
    <div className="border-l-4 border-primary bg-secondary/30 px-6 py-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">
        Debate
      </div>
      <h2 className="font-display mt-1 text-2xl font-bold leading-tight md:text-3xl">
        “{prompt}”
      </h2>
    </div>
  );
}
