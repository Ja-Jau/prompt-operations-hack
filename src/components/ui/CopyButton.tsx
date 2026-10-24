"use client";

import { useState } from "react";

/** Copies text to the clipboard, falling back to a prompt where the clipboard is blocked. */
export function CopyButton({ text, label, className = "btn btn-line btn-sm" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          window.prompt("Copy:", text);
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
