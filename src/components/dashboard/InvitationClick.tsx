"use client";

import { useEffect, useState } from "react";
import { recordInvitationClick } from "@/app/respond/[token]/actions";

/** Records a recipient's landing-page visit via POST, never during link prefetching. */
export function InvitationClick({ token, choice }: { token: string; choice: "interested" | "declined" | "game" }) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    recordInvitationClick(token, choice).then((value) => { if (active) setResult(value); }).catch(() => {
      if (active) setResult({ ok: false, message: "Could not save your response. Please try again." });
    });
    return () => { active = false; };
  }, [token, choice, retry]);
  return <div className={`invitation-click-status ${result?.ok ? "is-saved" : ""}`} role="status">
    <p>{result?.message ?? (choice === "game" ? "Opening your game invitation…" : "Saving your response…")}</p>
    {result && !result.ok && <button type="button" onClick={() => { setResult(null); setRetry((value) => value + 1); }}>Try again</button>}
  </div>;
}
