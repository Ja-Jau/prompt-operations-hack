/**
 * How one play session is laid out: LEVELS_PER_RUN generated levels with rising difficulty.
 * Level 0 uses the run seed as is, so `?seed=1234` (and `?difficulty=D`) replays exactly the level a results
 * screen showed. Later levels derive their seeds from the run seed.
 */
export const LEVELS_PER_RUN = 4;
export const RUN_DIFFICULTY = [1, 2, 4, 5];
export const SPEEDS = [1, 2, 4] as const;

export const levelSeed = (runSeed: number, idx: number, attempt = 0) => runSeed + idx * 7919 + attempt * 104729;

export function levelDifficulty(idx: number, forcedFirst: number | null): number {
  if (idx === 0 && forcedFirst !== null) return forcedFirst;
  return RUN_DIFFICULTY[Math.min(idx, RUN_DIFFICULTY.length - 1)];
}

export type UrlParams = { seed: number | null; difficulty: number | null; debug: boolean };

export function readUrlParams(search: string): UrlParams {
  const q = new URLSearchParams(search);
  const num = (k: string) => {
    const v = q.get(k);
    return v !== null && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
  };
  const d = num("difficulty");
  return {
    seed: num("seed") !== null ? Math.floor(num("seed") as number) : null,
    difficulty: d !== null && d >= 1 && d <= 5 ? Math.round(d) : null,
    debug: q.get("debug") === "1",
  };
}
