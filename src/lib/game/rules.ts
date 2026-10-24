import type { Company } from "@/types/company";

/** Typical annual working hours for a full-time employee in Finland. */
const WORKING_HOURS_PER_YEAR = 1650;

export function revenuePerEmployee(c: Company): number {
  return (c.revenueEurM * 1_000_000) / c.employees;
}

/** Revenue per employee per working hour: what one hour of someone's time is worth to the company. */
export function revenuePerHour(c: Company): number {
  return revenuePerEmployee(c) / WORKING_HOURS_PER_YEAR;
}
