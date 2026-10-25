"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DT, benchAgent, createGame, placeAgent, skipToEnd, step, type Game } from "./engine";
import { generate } from "./generate";
import { runBaseline, scoreGame, type Score } from "./score";
import { levelDifficulty, levelSeed, type UrlParams } from "./runPlan";
import { track } from "./analytics";

export type Done = { g: Game; base: Game; score: Score };

/**
 * Owns the running game: a fixed-timestep loop (0.1 s ticks, however fast frames arrive) and a ~10 Hz repaint.
 * Speed changes how many ticks run per frame; pause stops the clock; skip calls the engine's skipToEnd().
 * The engine stays pure; this hook is the only place that touches timers.
 */
export function useRun(url: UrlParams, onAnnounce: (s: string) => void) {
  const gRef = useRef<Game | null>(null);
  const baseRef = useRef<Game | null>(null);
  const runSeed = useRef(0);
  const speedRef = useRef(1);
  const pausedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [level, setLevel] = useState(0);
  const [, force] = useState(0);
  const [tickMs, setTickMs] = useState(0);
  const [done, setDone] = useState<Done | null>(null);
  const [selStage, setSelStage] = useState<number | null>(null);
  const [selAgent, setSelAgent] = useState<number | null>(null);
  const [speed, setSpeedState] = useState(1);
  const [paused, setPausedState] = useState(false);

  const finish = useCallback((g: Game) => {
    const base = baseRef.current as Game;
    setPlaying(false);
    setDone({ g, base, score: scoreGame(g, base) });
  }, []);

  /** Start level `idx` (0-based); a retry gets a fresh seed so the same pipeline is not replayed. */
  const start = useCallback(
    (idx: number, attempt = 0) => {
      if (idx === 0 && attempt === 0) runSeed.current = url.seed ?? Math.floor(Math.random() * 1_000_000_000);
      const seed = levelSeed(runSeed.current, idx, attempt);
      const scn = generate(seed, levelDifficulty(idx, url.difficulty));
      gRef.current = createGame(scn, seed);
      baseRef.current = runBaseline(scn, seed);
      speedRef.current = 1;
      pausedRef.current = false;
      setSpeedState(1);
      setPausedState(false);
      setLevel(idx);
      setSelStage(null);
      setSelAgent(null);
      setDone(null);
      setPlaying(true);
      onAnnounce(`${scn.title}. ${scn.intro}`);
      track("level_generated", { seed, difficulty: scn.meta?.difficulty, theme: scn.meta?.theme, stages: scn.stages.length, attempts: scn.meta?.attempts });
      if (idx === 0 && attempt === 0) track("game_start", { seed: runSeed.current });
    },
    [url.seed, url.difficulty, onAnnounce],
  );

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastPaint = 0;
    let seen = 0;
    const frame = (now: number) => {
      const g = gRef.current;
      if (!g) return;
      const elapsed = Math.min(0.5, (now - last) / 1000);
      last = now;
      let spent = 0;
      if (!pausedRef.current) {
        acc += elapsed * speedRef.current;
        const t0 = performance.now();
        let guard = 0;
        while (acc >= DT && !g.over && !g.done && guard++ < 200) {
          step(g);
          acc -= DT;
        }
        spent = performance.now() - t0;
      }
      if (g.log.length > seen) {
        seen = g.log.length;
        const ev = g.log[seen - 1];
        onAnnounce(`${ev.title}. ${ev.text}`);
      }
      if (g.over || g.done) {
        finish(g);
        return;
      }
      if (now - lastPaint > 100) {
        lastPaint = now;
        setTickMs(spent);
        force((n) => n + 1);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, level, onAnnounce, finish]);

  /** Place a bench agent on a stage, or move an agent between stages. */
  const place = useCallback(
    (agentId: number, stageIndex: number) => {
      const g = gRef.current;
      if (!g) return { ok: false as const, reason: "unknown" as const };
      const before = g.agents.find((a) => a.id === agentId)?.at ?? null;
      const res = placeAgent(g, agentId, stageIndex);
      if (res.ok) {
        const d = g.deploys[g.deploys.length - 1];
        track(before === null ? "agent_deployed" : "agent_moved", {
          scenario: g.scn.id, agent: agentId, stage: d.stage, atSec: Math.round(d.t), bottleneck: d.wasBottleneck,
        });
        const where = g.scn.stages[stageIndex].name;
        onAnnounce(before === null ? `Agent ${agentId + 1} placed at ${where}.` : `Agent ${agentId + 1} moved to ${where}. It re-deploys for a few seconds.`);
        setSelAgent(null);
        force((n) => n + 1);
      }
      return res;
    },
    [onAnnounce],
  );

  const bench = useCallback(
    (agentId: number) => {
      const g = gRef.current;
      if (g && benchAgent(g, agentId).ok) {
        onAnnounce(`Agent ${agentId + 1} sent to the bench.`);
        setSelAgent(null);
        force((n) => n + 1);
      }
    },
    [onAnnounce],
  );

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
    setSpeedState(s);
  }, []);
  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPausedState(pausedRef.current);
  }, []);

  /** Instant skip: run the remaining ticks with the current placement, then show results. */
  const skip = useCallback(() => {
    const g = gRef.current;
    if (!g || g.done || g.over) return;
    track("level_skipped", { scenario: g.scn.id, atSec: Math.round(g.t * 10) / 10 });
    skipToEnd(g);
    finish(g);
  }, [finish]);

  return {
    g: gRef.current, playing, level, done, tickMs, start, place, bench, skip,
    selStage, setSelStage, selAgent, setSelAgent, speed, setSpeed, paused, togglePause,
  };
}
