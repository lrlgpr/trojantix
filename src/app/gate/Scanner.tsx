"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import jsQR from "jsqr";
import { validateScanAction, type ScanResult } from "@/app/actions/gate";

const look = {
  VALID: { bg: "bg-emerald-600", title: "VALID", icon: "✓" },
  INVALID: { bg: "bg-red-700", title: "INVALID", icon: "✕" },
  ALREADY_USED: { bg: "bg-amber-500", title: "ALREADY USED", icon: "!" },
};

export function Scanner() {
  const [code, setCode] = useState("");
  const [res, setRes] = useState<ScanResult | null>(null);
  const [pending, start] = useTransition();
  const [camOn, setCamOn] = useState(false);
  const [camErr, setCamErr] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const busy = useRef(false);

  const check = (payload: string) => {
    if (!payload.trim()) return;
    busy.current = true;
    start(async () => {
      setRes(await validateScanAction(payload));
      setTimeout(() => { busy.current = false; }, 2500);
    });
  };

  useEffect(() => {
    if (!camOn) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (stopped) return;
          const c = canvas.current!;
          if (v.readyState === v.HAVE_ENOUGH_DATA && !busy.current) {
            c.width = v.videoWidth; c.height = v.videoHeight;
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, c.width, c.height);
            const qr = jsQR(img.data, img.width, img.height);
            if (qr?.data) { setCode(qr.data); check(qr.data); }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setCamErr("Camera unavailable. Paste the code instead.");
        setCamOn(false);
      }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [camOn]);

  const r = res ? look[res.result] : null;
  return (
    <div className="space-y-4">
      {res && r && (
        <div className={`${r.bg} rounded-3xl p-6 text-center text-white shadow-lg`} role="status" aria-live="assertive">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/20 text-4xl font-black">{r.icon}</div>
          <p className="mt-2 text-3xl font-black tracking-wide">{r.title}</p>
          <p className="mt-1 text-sm text-white/90">{res.reason}</p>
          {res.game && <p className="mt-3 font-semibold">{res.game}</p>}
          {res.seat && <p className="text-sm">{res.seat}</p>}
          {res.studentIdLast4 && <p className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">Student ID ends in {res.studentIdLast4}</p>}
          {res.usedAt && <p className="mt-2 text-sm">Scanned {new Date(res.usedAt).toLocaleTimeString()}</p>}
        </div>
      )}

      <div className="card space-y-3">
        {camOn ? (
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={video} className="aspect-square w-full object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-10 rounded-2xl border-4 border-gold/80" />
          </div>
        ) : (
          <button type="button" className="btn-gold w-full" onClick={() => { setCamErr(null); setCamOn(true); }}>
            Scan with camera
          </button>
        )}
        {camOn && <button type="button" className="btn-ghost w-full" onClick={() => setCamOn(false)}>Stop camera</button>}
        {camErr && <p className="text-sm text-red-700">{camErr}</p>}
        <canvas ref={canvas} className="hidden" />

        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); check(code); }}>
          <label className="label" htmlFor="code">Or paste a ticket code</label>
          <input id="code" className="input font-mono text-sm" placeholder="TTX1.…" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn-primary w-full" disabled={pending || !code.trim()}>{pending ? "Checking…" : "Validate"}</button>
        </form>
      </div>
    </div>
  );
}
