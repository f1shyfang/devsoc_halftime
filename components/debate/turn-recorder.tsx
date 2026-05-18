"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RecordingIndicator } from "./recording-indicator";
import { TURN_DURATION_SEC } from "@/lib/config";
import { fetchWithSession } from "@/lib/fetch-with-session";

export type TurnRecorderState =
  | "idle"
  | "recording"
  | "transcribing"
  | "submitted"
  | "error";

export function TurnRecorder({
  roomId,
  turnIndex,
  onTranscribingChange,
  onTurnSubmitted,
  disabled,
}: {
  roomId: string;
  turnIndex: number;
  onTranscribingChange: (transcribing: boolean) => void;
  onTurnSubmitted: () => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<TurnRecorderState>("idle");
  const [secondsLeft, setSecondsLeft] = useState(TURN_DURATION_SEC);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    setState("idle");
    setSecondsLeft(TURN_DURATION_SEC);
    setError(null);
  }, [turnIndex]);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  const submitBlob = useCallback(
    async (blob: Blob, durationMs: number) => {
      setState("transcribing");
      onTranscribingChange(true);
      try {
        const form = new FormData();
        form.append("audio", blob, "turn.webm");
        const tResp = await fetch("/api/transcribe", {
          method: "POST",
          body: form,
        });
        if (!tResp.ok) throw new Error("transcribe failed");
        const tData = (await tResp.json()) as { transcript?: string };
        const transcript = (tData.transcript ?? "").trim();
        const sResp = await fetchWithSession("/api/submit-turn", {
          method: "POST",
          body: JSON.stringify({
            roomId,
            turn_index: turnIndex,
            transcript,
            audio_duration_ms: durationMs,
          }),
        });
        if (!sResp.ok) throw new Error("submit failed");
        setState("submitted");
        onTurnSubmitted();
      } catch (err) {
        setError(err instanceof Error ? err.message : "error");
        setState("error");
      } finally {
        onTranscribingChange(false);
      }
    },
    [roomId, turnIndex, onTranscribingChange, onTurnSubmitted]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    setSecondsLeft(TURN_DURATION_SEC);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const durationMs = Date.now() - startedAtRef.current;
        cleanup();
        void submitBlob(blob, durationMs);
      };
      startedAtRef.current = Date.now();
      recorder.start();
      setState("recording");
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            // Auto-stop on expiry.
            if (
              recorderRef.current &&
              recorderRef.current.state === "recording"
            ) {
              recorderRef.current.stop();
            }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Mic permission denied — ${err.message}`
          : "Mic permission denied"
      );
      setState("error");
    }
  }, [cleanup, submitBlob]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  if (state === "submitted") {
    return (
      <div className="rounded-md border border-border bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
        Turn submitted.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-border bg-card p-5">
      <RecordingIndicator
        secondsLeft={secondsLeft}
        isRecording={state === "recording"}
      />
      {state === "idle" || state === "error" ? (
        <button
          onClick={startRecording}
          disabled={disabled}
          className="rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          Start Turn
        </button>
      ) : null}
      {state === "recording" ? (
        <button
          onClick={stopRecording}
          className="rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
        >
          ⏺ Stop &amp; Submit
        </button>
      ) : null}
      {state === "transcribing" ? (
        <div className="text-sm text-muted-foreground">Transcribing…</div>
      ) : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
    </div>
  );
}
