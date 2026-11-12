"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type Code = { svg: string; payload: string; expiresAt: number; serverNow: number; step: number };

export function RotatingQR({ ticketId }: { ticketId: string }) {
  const [code, setCode] = useState<Code | null>(null);
  const [left, setLeft] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [skew, setSkew] = useState(0);

  // Fetch a fresh code, then schedule the next fetch for the moment it expires.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/code`, { cache: "no-store" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Unavailable");
        const c: Code = await res.json();
        if (cancelled) return;
        setSkew(c.serverNow - Date.now());
        setCode(c);
        setError(null);
        timer = setTimeout(run, Math.max(250, c.expiresAt - c.serverNow + 150));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unavailable");
        timer = setTimeout(run, 3000);
      }
    };
    run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ticketId]);

  // Countdown bar
  useEffect(() => {
    const t = setInterval(() => {
      if (code) setLeft(Math.max(0, Math.ceil((code.expiresAt - (Date.now() + skew)) / 1000)));
    }, 250);
    return () => clearInterval(t);
  }, [code, skew]);

  if (error) return <p className="text-center text-sm text-red-700">{error}</p>;

  const pct = (left / 15) * 100;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative rounded-2xl border-4 border-gold p-2">
        {code ? (
          <div key={code.step} className="h-56 w-56 animate-[fadein_.3s_ease]"
            dangerouslySetInnerHTML={{ __html: code.svg }} />
        ) : (
          <div className="h-56 w-56 animate-pulse rounded-lg bg-stone-200" />
        )}
      </div>
      <div className="w-56">
        <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-cardinal transition-[width] duration-200 ease-linear" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm font-medium text-stone-700">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Live code · refreshes in {left}s
        </p>
      </div>
      <p className="max-w-xs text-center text-xs text-stone-500">
        This code changes every 15 seconds and is tied to your account. Screenshots and forwarded images won&apos;t scan.
      </p>
      {code && (
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs"
          onClick={async () => {
            await navigator.clipboard?.writeText(code.payload).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}>
          <Icon name="copy" className="h-4 w-4" />
          {copied ? "Copied!" : "Copy code (for gate demo)"}
        </button>
      )}
      {code && <code className="max-w-full truncate font-mono text-[10px] text-stone-400">{code.payload}</code>}
    </div>
  );
}
