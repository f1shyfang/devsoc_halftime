export function CreditPill({
  credits,
  className = "",
}: {
  credits: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 text-sm ${className}`}
    >
      <span className="text-primary">¢</span>
      <span className="font-mono-num font-semibold">{credits}</span>
    </span>
  );
}
