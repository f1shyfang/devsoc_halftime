"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onCode: (code: string) => void;
  onClose: () => void;
};

/** In-page QR scanner — submits decoded text to the server for validation. */
export function MvpCodeScanner({ onCode, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const firedRef = useRef(false);
  const [cameraErr, setCameraErr] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");

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
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play().catch(() => {});
        }
        scanLoop();
      } catch (e) {
        setCameraErr(e instanceof Error ? e.message : "camera unavailable");
      }
    };
    start();
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
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
          const ctx = c.getContext("2d");
          if (ctx) {
            ctx.drawImage(v, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = jsQR(img.data, w, h);
            if (code?.data) {
              firedRef.current = true;
              onCode(code.data.trim());
              return;
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const submitManual = () => {
    const v = manualInput.trim();
    if (!v) return;
    onCode(v);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#1a1a22] text-white"
      role="dialog"
      aria-label="Scan code"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold">Scan the code</span>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] px-3 text-sm text-white/80"
        >
          Close
        </button>
      </div>

      {cameraErr ? (
        <p className="px-4 py-3 text-sm text-amber-300">{cameraErr}</p>
      ) : (
        <div className="relative flex-1 bg-black">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 border-2 border-white/60 rounded-2xl" />
          </div>
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 border-t border-white/10 bg-[#1a1a22]">
        <p className="text-xs text-white/60">Or type the code from the sticker:</p>
        <input
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-base"
          placeholder="QUEST42"
        />
        <button
          type="button"
          onClick={submitManual}
          className="min-h-[48px] rounded-full bg-[#ef5b3a] font-semibold"
        >
          Submit code
        </button>
      </div>
    </div>
  );
}
