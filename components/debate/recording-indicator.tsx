export function RecordingIndicator({
  secondsLeft,
  isRecording,
}: {
  secondsLeft: number;
  isRecording: boolean;
}) {
  const min = Math.floor(secondsLeft / 60);
  const sec = secondsLeft % 60;
  const label = `${min}:${sec.toString().padStart(2, "0")}`;
  return (
    <div className="flex items-center gap-3">
      {isRecording ? (
        <span className="record-pulse h-2.5 w-2.5 rounded-full bg-primary" />
      ) : (
        <span className="h-2.5 w-2.5 rounded-full bg-muted" />
      )}
      <span className="font-mono-num text-4xl font-semibold tabular-nums">
        {label}
      </span>
    </div>
  );
}
