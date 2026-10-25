/** Shared generator helpers: data types, the difficulty ladder and small seeded-random utilities. */
import themesData from "./themes.json";
import eventsData from "./events.json";
import { nextRandom } from "./rng";
import type { EffectDef, Kind } from "./engine";

export type ThemeStage = { name: string; kind: Kind; description: string };
export type Theme = {
  id: string; title: string; industry: string; processName: string; unit: string; intro: string; stages: ThemeStage[];
};
export type EventTpl = {
  id: string; kind: EffectDef["type"]; target?: "manual" | "automated" | "early" | "any"; onlyManual?: boolean;
  minDifficulty: number; title: string; text: string; value: [number, number]; duration: [number, number];
};

export const THEMES = themesData.themes as Theme[];
export const EVENT_POOL = eventsData.events as EventTpl[];

export type Level = {
  stages: [number, number]; agents: number; perStage: number; seconds: number;
  normal: [number, number]; // capacity of ordinary stages, as a multiple of normal demand
  bn: [number, number]; // capacity of the true bottleneck, same unit (lower = more severe)
  queueK: number; // queue limit scale (lower = overflow sooner)
  events: [number, number]; budgetFactor: number; decoy: boolean;
};
/** Difficulty ladder. Every level has more useful (middle) stages than agents, so placement is always a choice. */
export const LEVELS: Record<number, Level> = {
  1: { stages: [5, 5], agents: 2, perStage: 1, seconds: 30, normal: [2.0, 2.8], bn: [0.5, 0.65], queueK: 0.8, events: [2, 2], budgetFactor: 1.15, decoy: false },
  2: { stages: [6, 6], agents: 3, perStage: 1, seconds: 35, normal: [1.7, 2.3], bn: [0.45, 0.6], queueK: 0.65, events: [2, 3], budgetFactor: 1.0, decoy: false },
  3: { stages: [7, 7], agents: 4, perStage: 1, seconds: 40, normal: [1.3, 1.7], bn: [0.38, 0.52], queueK: 0.5, events: [3, 3], budgetFactor: 0.8, decoy: true },
  4: { stages: [7, 8], agents: 4, perStage: 2, seconds: 45, normal: [1.15, 1.45], bn: [0.32, 0.45], queueK: 0.38, events: [3, 4], budgetFactor: 0.7, decoy: true },
  5: { stages: [8, 8], agents: 5, perStage: 2, seconds: 45, normal: [1.05, 1.3], bn: [0.28, 0.4], queueK: 0.3, events: [4, 4], budgetFactor: 0.6, decoy: true },
};

export type H = { rng: number };
export const mix = (seed: number, a: number, b: number): H => {
  const h = { rng: (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca6b)) | 0 };
  for (let i = 0; i < 4; i++) nextRandom(h);
  return h;
};
export const rnd = (h: H, a: number, b: number) => a + (b - a) * nextRandom(h);
export const rint = (h: H, a: number, b: number) => Math.floor(rnd(h, a, b + 1));
export const r1 = (x: number) => Math.round(x * 10) / 10;
export const r2 = (x: number) => Math.round(x * 100) / 100;
export const round5 = (x: number) => Math.round(x / 5) * 5;
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

export function shuffle<T>(h: H, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(h) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
