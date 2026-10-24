export function formatEur(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  return `€${Math.round(value / 1000)}k`;
}
