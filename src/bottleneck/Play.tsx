"use client";

import { bottleneckIndex, costTotal, lossPerMin, lostTotal, queueLen, type Game } from "./engine";
import { Bench, Pipeline } from "./Pipeline";
import { StagePanel } from "./StagePanel";
import { SPEEDS } from "./runPlan";
import { useDrag, type DropTarget } from "./useDrag";
import { t } from "./strings";

const eur = (n: number) => Math.round(n).toLocaleString("en-US").replace(/,/g, " ");

type Props = {
  g: Game;
  level: number;
  levels: number;
  selStage: number | null;
  selAgent: number | null;
  setSelStage: (i: number | null) => void;
  setSelAgent: (i: number | null) => void;
  place: (agent: number, stage: number) => unknown;
  bench: (agent: number) => void;
  speed: number;
  setSpeed: (s: number) => void;
  paused: boolean;
  togglePause: () => void;
  skip: () => void;
  debug: boolean;
  tickMs: number;
};

/** The playing screen: HUD, controls, pipeline, bench, latest event, stage panel, optional debug panel. */
export function Play(p: Props) {
  const { g, selStage, selAgent } = p;
  const left = Math.max(0, Math.ceil(g.scn.durationSeconds - g.t));
  const ev = g.log.length ? g.log[g.log.length - 1] : null;

  const onDrop = (agent: number, target: DropTarget) => {
    if (!target) return;
    if (target.kind === "bench") p.bench(agent);
    else p.place(agent, target.index);
  };
  // Tap flow: first tap selects an agent; a second tap on the same agent clears it.
  const onTap = (agent: number) => p.setSelAgent(p.selAgent === agent ? null : agent);
  const { drag, bind } = useDrag(onDrop, onTap);

  const onStage = (i: number) => {
    if (p.selAgent !== null) p.place(p.selAgent, i);
    p.setSelStage(i);
  };

  return (
    <section aria-label={g.scn.title} className="bn-play">
      <p className="eyebrow">{t.levelLabel(p.level + 1, p.levels)} · {g.scn.title}</p>
      <p className="bn-sub">{g.scn.intro}</p>

      <div className="bn-hud">
        <div><small>{t.hud.time}</small><strong aria-label={`${t.a11y.timer}: ${left}`}>{p.paused ? t.hud.paused : `${left}s`}</strong></div>
        <div className="bn-loss"><small>{t.hud.lostPerMin}</small><strong>€{eur(lossPerMin(g))}</strong></div>
        <div className="bn-loss"><small>{t.hud.lostTotal}</small><strong>€{eur(lostTotal(g))}</strong></div>
        <div><small>{t.hud.budget}</small><strong>€{eur(g.budget)}</strong></div>
        <div className="bn-timer" role="presentation">
          <i style={{ transform: `scaleX(${Math.max(0, 1 - g.t / g.scn.durationSeconds)})` }} />
        </div>
      </div>

      <div className="bn-controls" role="group" aria-label="Playback">
        <button type="button" className="btn btn-line btn-sm" onClick={p.togglePause} aria-pressed={p.paused}>
          {p.paused ? t.ctl.resume : t.ctl.pause}
        </button>
        <span className="bn-speeds" role="group" aria-label={t.ctl.speed}>
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={`btn btn-sm ${p.speed === s ? "btn-dark" : "btn-line"}`} aria-pressed={p.speed === s} onClick={() => p.setSpeed(s)}>
              {s}x
            </button>
          ))}
        </span>
        <button type="button" className="btn btn-dark bn-skip" onClick={p.skip}>{t.ctl.skip} <span aria-hidden="true">»</span></button>
      </div>

      <Bench g={g} selAgent={selAgent} drag={drag} bind={bind} onBench={() => selAgent !== null && p.bench(selAgent)} />
      <Pipeline g={g} selStage={selStage} selAgent={selAgent} drag={drag} bind={bind} onStage={onStage} />

      {ev && g.t - ev.at < 8 && (
        <div className="bn-event" key={ev.id}>
          <b>{t.eventLabel}: {ev.title}</b>
          <span>{ev.text}</span>
        </div>
      )}
      <StagePanel g={g} index={selStage} selAgent={selAgent} onPlace={(i) => p.place(selAgent ?? (g.agents.find((a) => a.at === null)?.id ?? 0), i)} onBench={p.bench} />
      <p className="bn-note">{t.hud.simNote}. {t.a11y.stageHint}</p>

      {drag && (
        <div className="bn-ghost" style={{ transform: `translate(${drag.x - 24}px, ${drag.y - 24}px)` }} aria-hidden="true">
          <span>◆</span><b>{drag.agent + 1}</b>
        </div>
      )}

      {p.debug && (
        <div className="bn-debug" aria-label={t.debug}>
          {`seed=${g.seed} diff=${g.scn.meta?.difficulty} theme=${g.scn.meta?.theme} tries=${g.scn.meta?.attempts} solvable=${g.scn.meta?.solvable}\n`}
          {`tick ${g.tick} t=${g.t.toFixed(1)} sim=${p.tickMs.toFixed(2)}ms cost=${costTotal(g).toFixed(0)} moves=${g.moves}\n`}
          {`true bottleneck: ${g.scn.meta?.trueBottleneck}  decoy: ${g.scn.meta?.decoy ?? "-"}\n`}
          {`solver best: [${g.scn.meta?.solver?.best.join(", ")}] score ${g.scn.meta?.solver?.bestScore} (${g.scn.meta?.solver?.bestCut}% cut)\n`}
          {g.scn.stages
            .map((s, i) => `${s.id.padEnd(30)} q=${String(queueLen(g, i)).padStart(2)} rate=${s.rate.toFixed(1)}${i === bottleneckIndex(g) ? "  <- bottleneck now" : ""}`)
            .join("\n")}
        </div>
      )}
    </section>
  );
}
