"use client";
import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/money";

export function TimerClock({ startedAt }: { startedAt: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    tick(); const id = window.setInterval(tick, 1000); return () => window.clearInterval(id);
  }, [startedAt]);
  return <span className="timer-clock">{formatDuration(seconds)}<span className="muted" style={{fontSize:14}}>:{String(seconds % 60).padStart(2,"0")}</span></span>;
}
