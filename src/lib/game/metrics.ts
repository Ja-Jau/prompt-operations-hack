import type { GameCompany as Company, EfficiencyMetricId, EfficiencyObservation } from "@/types/company";

export type MetricId = EfficiencyMetricId;
export type Metric = {
  id: MetricId;
  title: string;
  label: string;
  question: string;
  explanation: string;
  opportunity: string;
  value: (c: Company) => number | null;
  format: (value: number) => string;
  higherLabel: string;
  lowerLabel: string;
  farEnough: (a: number, b: number) => boolean;
};

export function metricObservation(company: Company, id: MetricId): EfficiencyObservation | null {
  const observation = company.efficiency?.[id];
  if (!observation || !Number.isFinite(observation.value) || observation.sources.length === 0) return null;
  return observation;
}

const valueFor = (id: MetricId) => (company: Company) => metricObservation(company, id)?.value ?? null;
const percent = (v: number) => `${v.toFixed(1)}%`;
const euros = (v: number) => (v >= 1e9 ? `€${(v / 1e9).toFixed(1)}B` : `€${Math.round(v / 1e6)}M`);

export const METRICS: Record<MetricId, Metric> = {
  revenue: {
    id: "revenue",
    title: "Annual revenue",
    label: "revenue last financial year",
    question: "Higher or lower revenue than",
    explanation: "Total revenue from the company's audited annual report.",
    opportunity: "Velho helps teams grow revenue without growing the routine work at the same pace.",
    value: valueFor("revenue"),
    format: euros,
    higherLabel: "Higher",
    lowerLabel: "Lower",
    farEnough: (a, b) => Math.max(a, b) / Math.min(a, b) >= 1.15,
  },
  revenueGrowth: {
    id: "revenueGrowth",
    title: "Revenue growth",
    label: "revenue change on the year before",
    question: "Higher or lower growth than",
    explanation: "How much revenue changed from the year before, from the company's annual report.",
    opportunity: "Velho helps growing teams take on more work without hiring for every manual step.",
    value: valueFor("revenueGrowth"),
    format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`,
    higherLabel: "Higher",
    lowerLabel: "Lower",
    farEnough: (a, b) => Math.abs(a - b) >= 1,
  },
  growthGap: {
    id: "growthGap",
    title: "Growth vs headcount",
    label: "revenue growth − employee growth",
    question: "Higher or lower growth gap than",
    explanation: "Year-on-year revenue growth minus employee growth. A positive gap means sales grew faster than headcount.",
    opportunity: "Velho helps teams handle growth without adding the same amount of routine work.",
    value: valueFor("growthGap"),
    format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} pp`,
    higherLabel: "Higher gap",
    lowerLabel: "Lower gap",
    farEnough: (a, b) => Math.abs(a - b) >= 1,
  },
  manualAds: {
    id: "manualAds",
    title: "Repetitive tasks in job ads",
    label: "sampled ads mentioning repetitive tasks",
    question: "Higher or lower share than",
    explanation: "Every sampled ad is checked against the same explicit-task rules. Software names alone do not count.",
    opportunity: "Velho starts with the task: less copying, reconciling and updating by hand.",
    value: valueFor("manualAds"),
    format: percent,
    higherLabel: "Higher share",
    lowerLabel: "Lower share",
    farEnough: (a, b) => Math.abs(a - b) >= 5,
  },
  adminRatio: {
    id: "adminRatio",
    title: "Administrative expenses",
    label: "revenue spent on administration",
    question: "Higher or lower admin share than",
    explanation: "Separately reported administrative expenses divided by revenue. Combined selling and administrative costs are excluded.",
    opportunity: "Velho looks for repeatable admin steps that teams can simplify or automate.",
    value: valueFor("adminRatio"),
    format: percent,
    higherLabel: "Higher share",
    lowerLabel: "Lower share",
    farEnough: (a, b) => Math.abs(a - b) >= 0.5,
  },
  inventoryDays: {
    id: "inventoryDays",
    title: "Time holding stock",
    label: "estimated time holding stock",
    question: "More or fewer inventory days than",
    explanation: "Average opening and closing inventory divided by annual cost of sales, multiplied by days in the year.",
    opportunity: "Velho connects purchasing, stock data and planning so people can act sooner.",
    value: valueFor("inventoryDays"),
    format: (v) => `${Math.round(v)} days`,
    higherLabel: "More days",
    lowerLabel: "Fewer days",
    farEnough: (a, b) => Math.abs(a - b) >= 5,
  },
};

export const METRIC_IDS = Object.keys(METRICS) as MetricId[];

/** Compare the same year, scope and definition; never mix average and closing headcount. */
export function comparable(a: Company, b: Company, id: MetricId): boolean {
  const left = metricObservation(a, id);
  const right = metricObservation(b, id);
  if (!left || !right || a.id === b.id) return false;
  if (left.scope !== right.scope || left.definition !== right.definition || left.year !== right.year) return false;
  if (id === "manualAds" && Math.abs(Date.parse(left.fetchedAt) - Date.parse(right.fetchedAt)) > 30 * 86_400_000) return false;
  return METRICS[id].farEnough(left.value, right.value);
}
