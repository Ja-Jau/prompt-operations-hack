import type { Mode } from "@/types/company";
import { dailyNumber } from "./daily";

/** An endless streak this long counts as a perfect score for the title. */
const ENDLESS_PERFECT_STREAK = 15;

const TITLES = [
  { min: 0.9, title: "Chief Efficiency Officer 🏆" },
  { min: 0.7, title: "Operations Hawk 🦅" },
  { min: 0.5, title: "Process Optimist 📈" },
  { min: 0.3, title: "Spreadsheet Survivor 📊" },
  { min: 0, title: "Still in Manual Mode 🗂️" },
];

export function resultGrid(results: boolean[]): string {
  return results.map((r) => (r ? "🟩" : "🟥")).join("");
}

/** The shareable "what kind of operator are you" title for a finished game. */
export function rankTitle(mode: Mode, results: boolean[]): string {
  const score = results.filter(Boolean).length;
  const ratio =
    mode === "daily" ? score / Math.max(1, results.length) : Math.min(1, score / ENDLESS_PERFECT_STREAK);
  return TITLES.find((t) => ratio >= t.min)!.title;
}

export function shareText(opts: { mode: Mode; results: boolean[]; usedTip: boolean; url: string }): string {
  const score = opts.results.filter(Boolean).length;
  const head =
    opts.mode === "daily"
      ? `Tehokas #${dailyNumber()} 🇫🇮\n${resultGrid(opts.results)} ${score}/${opts.results.length}`
      : `Tehokas endless 🇫🇮\n🔥 streak ${score}`;
  const title = `\n${rankTitle(opts.mode, opts.results)}`;
  const tip = opts.usedTip ? "\n⚡ used a Velho tip" : "";
  return `${head}${title}${tip}\n${opts.url}`;
}
