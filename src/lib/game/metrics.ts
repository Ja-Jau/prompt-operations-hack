import type { Company } from "@/types/company";
import { formatEur } from "@/lib/format";
import { revenuePerEmployee } from "./rules";

export type MetricId = "rpe" | "manualAds";

export type Metric = {
  id: MetricId;
  /** Shown under the big number. */
  label: string;
  /** null when the company has no data for this metric. */
  value: (c: Company) => number | null;
  format: (value: number) => string;
  higherLabel: string;
  lowerLabel: string;
  /** Neighbouring cards must be at least this far apart, so no matchup is a coin flip. */
  farEnough: (a: number, b: number) => boolean;
};

export const METRICS: Record<MetricId, Metric> = {
  rpe: {
    id: "rpe",
    label: "revenue per employee",
    value: revenuePerEmployee,
    format: formatEur,
    higherLabel: "Higher",
    lowerLabel: "Lower",
    farEnough: (a, b) => Math.abs(a - b) / Math.min(a, b) >= 0.1,
  },
  manualAds: {
    id: "manualAds",
    label: "of open job ads describe manual work",
    value: manualAdShare,
    format: (v) => `${Math.round(v)}%`,
    higherLabel: "More",
    lowerLabel: "Less",
    farEnough: (a, b) => Math.abs(a - b) >= MIN_SHARE_GAP,
  },
};

/** Fewer ads than this and the percentage means little, so the company sits out Velho rounds. */
const MIN_ADS_CHECKED = 3;
const MIN_SHARE_GAP = 10;

/** Share (0–100) of the company's open job ads that describe manual work. */
export function manualAdShare(c: Company): number | null {
  if (!c.jobAds || c.jobAds.checked < MIN_ADS_CHECKED) return null;
  return (c.jobAds.manual / c.jobAds.checked) * 100;
}

/** Every VELHO_EVERY-th round is a Velho round about manual work in job ads. */
export const VELHO_EVERY = 4;

export function metricForRound(round: number): MetricId {
  return round % VELHO_EVERY === 0 ? "manualAds" : "rpe";
}
