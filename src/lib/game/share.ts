import type { Mode } from "@/types/company";
import { dailyNumber } from "./daily";

const TITLES = [
  { min: 15, title: "Chief Efficiency Officer" },
  { min: 10, title: "Operations Hawk" },
  { min: 6, title: "Process Optimist" },
  { min: 3, title: "Spreadsheet Survivor" },
  { min: 0, title: "Still in Manual Mode" },
];

/** The shareable "what kind of operator are you" title for a finished streak. */
export function rankTitle(streak: number): string {
  return TITLES.find((t) => streak >= t.min)!.title;
}

export function shareText(opts: { mode: Mode; streak: number; savedByVelho: boolean; url: string }): string {
  const head = opts.mode === "daily" ? `Tehokas Higher or Lower No. ${dailyNumber()}` : "Tehokas Higher or Lower, endless";
  const save = opts.savedByVelho ? " (saved once by Velho)" : "";
  return `${head}\nStreak ${opts.streak}${save}\n${rankTitle(opts.streak)}\n${opts.url}`;
}
