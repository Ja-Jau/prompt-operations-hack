import { CEO_SCENARIOS, type CeoScenario } from "./scenarios";
import { shuffled, type CeoDecision } from "./game";

export const OFFICE_DAY_SECONDS = 300;
export const OFFICE_DECISION_SECONDS = 20;
export type Point = { x: number; z: number };
export type DayEncounter = {
  id: string; at: number; until: number; time: string;
  person: string; role: string; room: string; position: Point;
  objective: string; message: string; scenario: CeoScenario;
};

const itinerary = [
  { id: "arrival", scenario: "onboarding", at: 0, time: "09:00", person: "Alex", role: "Office manager", room: "Reception", position: { x: -2.5, z: 7 }, objective: "Check in with Alex", message: "Morning, CEO. There’s one thing before you start." },
  { id: "finance", scenario: "billing", at: 40, time: "10:00", person: "Emma", role: "Accountant", room: "Finance", position: { x: -8, z: 8 }, objective: "Meet Emma in Finance", message: "Sales are up. The invoice queue is growing faster." },
  { id: "operations", scenario: "orders", at: 80, time: "11:00", person: "Noah", role: "Head of operations", room: "Operations", position: { x: 9, z: -1 }, objective: "Check on order intake", message: "We’ve got another order error. Can you come over?" },
  { id: "lunch", scenario: "reporting", at: 120, time: "12:30", person: "Sofia", role: "CFO", room: "Café", position: { x: 9, z: 8 }, objective: "Join Sofia for lunch", message: "Grab a coffee. We need to talk about the numbers." },
  { id: "inventory", scenario: "stock", at: 165, time: "14:00", person: "Noah", role: "Head of operations", room: "Operations", position: { x: 13, z: -3.5 }, objective: "Review stock with Noah", message: "The warehouse is full. Somehow, we’re still out of bestsellers." },
  { id: "approvals", scenario: "supplier-invoices", at: 215, time: "15:30", person: "Emma", role: "Accountant", room: "Finance", position: { x: -8, z: 8 }, objective: "Resolve the payment backlog", message: "A supplier is on hold. Their payment hasn’t been approved." },
  { id: "board", scenario: "quotes", at: 265, time: "17:00", person: "Sofia", role: "CFO", room: "Boardroom", position: { x: 6.5, z: -10 }, objective: "Make your final call in the boardroom", message: "The board is ready. How do we scale from here?" },
] as const;

export function buildOfficeDay(random: () => number = Math.random): DayEncounter[] {
  return itinerary.map((event, i) => {
    const scenario = CEO_SCENARIOS.find((item) => item.id === event.scenario)!;
    return { ...event, position: { ...event.position }, until: itinerary[i + 1]?.at ?? OFFICE_DAY_SECONDS,
      scenario: { ...scenario, choices: shuffled(scenario.choices, random) as CeoScenario["choices"] } };
  });
}

export function currentEncounter(day: DayEncounter[], decisions: readonly CeoDecision[], elapsed: number) {
  const answered = new Set(decisions.map((decision) => decision.scenarioId));
  return day.find((event) => elapsed >= event.at && elapsed < event.until && !answered.has(event.scenario.id)) ?? null;
}

export function missedEncounters(day: DayEncounter[], decisions: readonly CeoDecision[], elapsed: number) {
  const answered = new Set(decisions.map((decision) => decision.scenarioId));
  return day.filter((event) => elapsed >= event.until && !answered.has(event.scenario.id));
}

export function officeClock(elapsed: number) {
  const minutes = 9 * 60 + Math.min(1, Math.max(0, elapsed / OFFICE_DAY_SECONDS)) * 8 * 60;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.floor(minutes % 60)).padStart(2, "0")}`;
}

export function officeZone({ x, z }: Point) {
  if (Math.abs(x) <= 4) return z > 6 ? "Reception" : "The corridor";
  if (x < -4) return z > 3 ? "Finance" : z > -6 ? "The studio" : "Quiet lounge";
  return z > 3 ? "Café" : z > -6 ? "Operations" : "Boardroom";
}

/** Frame-rate independent acceleration, shared by keyboard and touch input. */
export function approachVelocity(current: number, target: number, seconds: number) {
  return current + (target - current) * (1 - Math.exp(-12 * seconds));
}
