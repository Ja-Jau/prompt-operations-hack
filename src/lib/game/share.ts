const TITLES = [
  { min: 5, title: "Chief Efficiency Officer" },
  { min: 4, title: "Operations Hawk" },
  { min: 3, title: "Process Optimist" },
  { min: 2, title: "Spreadsheet Survivor" },
  { min: 0, title: "Still in Manual Mode" },
];

export function rankTitle(score: number): string {
  return TITLES.find((t) => score >= t.min)!.title;
}

export function shareText(opts: { score: number; url: string; mode?: "five" | "endless"; total?: number }): string {
  return `Firmle Higher or Lower${opts.mode === "endless" ? " · Endless" : ""}\nScore ${opts.score}/${opts.mode === "endless" ? opts.total ?? 0 : 5}\n${rankTitle(opts.score)}\n${opts.url}`;
}
