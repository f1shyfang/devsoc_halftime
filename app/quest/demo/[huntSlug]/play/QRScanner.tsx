"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  expectedPayload: string;
  locationName: string | null;
  onMatch: () => void;
  onClose: () => void;
};

/**
 * Full-screen QR scanner overlay. Uses jsQR (dynamic import) to decode the
 * rear-camera stream frame by frame; calls `onMatch` exactly once when the
 * decoded text equals `expectedPayload`. Falls back to a manual code-entry
 * input when camera access is denied or the codes are torn down.
 *
 * Per PRD §6.5: QR is a standalone verification path (no GPS prereq). The
 * physical placement of the laminated code is what enforces "you must be
 * here" — so we don't gate on geofence.
 */
export function QRScanner({ expectedPayload, locationName, onMatch, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const firedRef = useRef(false);
  const [cameraErr, setCameraErr] = useState<string | null>(null);
  const [seenPayload, setSeenPayload] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [manualMismatch, setManualMismatch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Required for iOS to actually start playback under autoplay rules.
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play().catch(() => {});
        }
        scanLoop();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "camera unavailable";
        setCameraErr(msg);
      }
    };
    start();
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanLoop = async () => {
    const { default: jsQR } = await import("jsqr");
    const tick = () => {
      if (firedRef.current) return;
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.readyState >= v.HAVE_ENOUGH_DATA) {
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (w && h) {
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(v, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
            if (code?.data) {
              setSeenPayload(code.data);
              if (code.data === expectedPayload) {
                firedRef.current = true;
                onMatch();
                return;
              }
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const submitManual = () => {
    const trimmed = manualInput.trim();
    if (trimmed === expectedPayload) {
      firedRef.current = true;
      onMatch();
    } else {
      setManualMismatch(true);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,26,34,0.92)",
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        color: "white",
      }}
    >
      <header
        style={{
          padding: "16px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div className="label" style={{ color: "var(--accent)" }}>SCAN QR CODE</div>
          <div className="hand" style={{ fontSize: 22, lineHeight: 1.05, marginTop: 2 }}>
            {locationName ? `Look around the ${locationName}` : "Find the laminated code"}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close scanner"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 999,
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </header>

      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {cameraErr ? (
          <div style={{ padding: 24, textAlign: "center", maxWidth: 360 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📷</div>
            <div className="hand" style={{ fontSize: 22, marginBottom: 8 }}>
              Camera unavailable
            </div>
            <div className="muted small" style={{ color: "rgba(255,255,255,0.7)", marginBottom: 16 }}>
              {cameraErr}. You can still enter the code shown on the laminated card below.
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                background: "black",
              }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            {/* Reticle */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: "min(70vw, 320px)",
                height: "min(70vw, 320px)",
                transform: "translate(-50%, -50%)",
                border: "3px solid var(--accent)",
                borderRadius: 24,
                boxShadow: "0 0 0 9999px rgba(26,26,34,0.45)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 18,
                textAlign: "center",
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {seenPayload && seenPayload !== expectedPayload
                ? "Not the right code — keep scanning"
                : "Point the camera at the laminated QR code"}
            </div>
          </>
        )}
      </div>

      {/* Manual entry — both as fallback and as the only path when camera is denied. */}
      <div
        style={{
          padding: 18,
          borderTop: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(0,0,0,0.35)",
        }}
      >
        <div className="label" style={{ color: "rgba(255,255,255,0.8)", marginBottom: 6 }}>
          OR ENTER THE CODE
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={manualInput}
            onChange={(e) => {
              setManualInput(e.target.value);
              setManualMismatch(false);
            }}
            placeholder="QUEST_v1_…"
            style={{
              flex: 1,
              minWidth: 0,
              border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: 12,
              padding: "10px 12px",
              fontFamily: "var(--mono)",
              fontSize: 13,
              background: "rgba(255,255,255,0.06)",
              color: "white",
            }}
          />
          <button
            onClick={submitManual}
            disabled={!manualInput.trim()}
            style={{
              background: "var(--accent)",
              color: "white",
              border: "1px solid var(--accent)",
              borderRadius: 12,
              padding: "10px 16px",
              fontWeight: 600,
              cursor: manualInput.trim() ? "pointer" : "not-allowed",
              opacity: manualInput.trim() ? 1 : 0.6,
            }}
          >
            Submit
          </button>
        </div>
        {manualMismatch ? (
          <div className="small" style={{ color: "var(--bad)", marginTop: 6, textAlign: "center" }}>
            That code doesn&apos;t match this clue.
          </div>
        ) : null}
      </div>
    </div>
  );
}
