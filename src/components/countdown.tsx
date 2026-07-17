"use client";
import { useCallback, useEffect, useState } from "react";

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const calculate = useCallback(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()), [expiresAt]);
  const [remaining, setRemaining] = useState(calculate);
  useEffect(() => {
    const id = window.setInterval(() => setRemaining(calculate()), 1000);
    return () => window.clearInterval(id);
  }, [calculate]);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return <span className="countdown" aria-live="polite">{remaining ? `${minutes}:${seconds.toString().padStart(2, "0")} remaining` : "Hold expired"}</span>;
}
