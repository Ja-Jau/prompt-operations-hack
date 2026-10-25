"use client";

import { agentsAt, isHot, queueLen, stageKind, type Agent, type Game } from "./engine";
import type { DragState } from "./useDrag";
import { t } from "./strings";

const MAX_BLOCKS = 24;

/** Wide-screen columns per row: 3-4 stages in one row, 5-6 in rows of 3, 7-8 in rows of 4. */
export const columnsFor = (n: number) => (n <= 4 ? n : n <= 6 ? 3 : 4);

/** Snake position: even rows run left to right, odd rows right to left, so the flow never jumps across the grid. */
export function snake(i: number, n: number) {
  const cols = columnsFor(n);
  const row = Math.floor(i / cols);
  const pos = i % cols;
  const col = row % 2 === 0 ? pos + 1 : cols - pos;
  const lastInRow = pos === cols - 1;
  const arrow = i === n - 1 ? "" : lastInRow ? "↓" : row % 2 === 0 ? "→" : "←";
  return { col, row: row + 1, arrow, cols };
}

type TokenProps = {
  g: Game;
  agent: Agent;
  selected: boolean;
  dragging: boolean;
  bind: (id: number) => Record<string, unknown>;
};

/** One agent. A big (48 px) draggable button; state shown with text and an icon, not colour alone. */
export function AgentToken({ g, agent, selected, dragging, bind }: TokenProps) {
  const waiting = agent.at !== null && g.t < agent.readyAt;
  const state = agent.at === null ? t.agent.onBench : waiting ? t.agent.redeploying : t.agent.working;
  const cls = ["bn-token", selected ? "bn-token-sel" : "", waiting ? "bn-token-wait" : "", dragging ? "bn-token-drag" : ""];
  return (
    <button
      type="button"
      className={cls.join(" ")}
      aria-pressed={selected}
      aria-label={`${t.agent.token(agent.id + 1)}, ${state}. ${selected ? "Selected." : ""}`}
      {...bind(agent.id)}
    >
      <span aria-hidden="true">◆</span>
      <b>{agent.id + 1}</b>
      {waiting && <i className="bn-token-ring" aria-hidden="true" />}
    </button>
  );
}

type Props = {
  g: Game;
  selStage: number | null;
  selAgent: number | null;
  drag: DragState;
  bind: (id: number) => Record<string, unknown>;
  onStage: (i: number) => void;
};

/** Stages as a responsive grid (a snake on wide screens, one column on phones). Each cell is also a drop zone. */
export function Pipeline({ g, selStage, selAgent, drag, bind, onStage }: Props) {
  const n = g.scn.stages.length;
  return (
    <ol className="bn-pipeline" data-count={n} style={{ ["--cols" as string]: columnsFor(n) }} aria-label="Workflow steps">
      {g.scn.stages.map((def, i) => {
        const q = queueLen(g, i);
        const hot = isHot(g, i);
        const kind = stageKind(g, i);
        const here = agentsAt(g, i);
        const over = drag?.over === `s${i}`;
        const targetable = selAgent !== null || drag !== null;
        const cls = ["bn-stage", `bn-${kind}`, hot ? "bn-hot" : "", here.length ? "bn-agent" : "", selStage === i ? "bn-selected" : "", over ? "bn-drop" : "", targetable ? "bn-targetable" : ""];
        const blocks = Math.min(q, MAX_BLOCKS);
        const pos = snake(i, n);
        return (
          <li key={def.id} className="bn-cell" data-drop="stage" data-index={i} data-arrow={pos.arrow} style={{ ["--c" as string]: pos.col, ["--r" as string]: pos.row }}>
            <div
              className={cls.join(" ")}
              role="button"
              tabIndex={0}
              aria-pressed={selStage === i}
              aria-label={`${i + 1}. ${def.name}. ${t.stage[kind]}. ${q} ${t.stage.queue.toLowerCase()}.${hot ? " " + t.stage.hotHint : ""}${here.length ? ` ${here.length} agent${here.length > 1 ? "s" : ""} here.` : ""}`}
              onClick={() => onStage(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onStage(i);
                }
              }}
            >
              <span className="bn-stage-top">
                <span className="bn-num">{i + 1}</span>
                <span className="bn-name" title={def.name}>{def.name}</span>
              </span>
              <span className="bn-chip"><span aria-hidden="true">{kind === "manual" ? "✋" : kind === "semi" ? "◐" : "⚙"}</span> {t.stage[kind]}</span>
              <span className="bn-queue" aria-hidden="true">
                {Array.from({ length: blocks }, (_, k) => <span key={k} className="bn-block" />)}
              </span>
              <span className="bn-count">{q} {t.stage.queue.toLowerCase()}{q > MAX_BLOCKS ? " +" : ""}</span>
              <span className="bn-status">
                {hot
                  ? <b className="bn-warn"><span aria-hidden="true">▲</span> {t.stage.queueBuilding}</b>
                  : <span className="bn-ok"><span aria-hidden="true">✓</span> {t.stage.healthy}</span>}
              </span>
              <span className="bn-slots">
                {here.map((a) => (
                  <AgentToken key={a.id} g={g} agent={a} selected={selAgent === a.id} dragging={drag?.agent === a.id} bind={bind} />
                ))}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The bench: unassigned agents. Also a drop zone, so dragging an agent here takes it off its stage for free. */
export function Bench({ g, selAgent, drag, bind, onBench }: Omit<Props, "selStage" | "onStage"> & { onBench: () => void }) {
  const free = g.agents.filter((a) => a.at === null);
  const over = drag?.over === "bench";
  return (
    <div
      className={`bn-bench ${over ? "bn-drop" : ""}`}
      data-drop="bench"
      role="group"
      aria-label={`${t.agent.bench}. ${free.length} agent${free.length === 1 ? "" : "s"}.`}
      onClick={(e) => {
        if (e.target === e.currentTarget && selAgent !== null) onBench();
      }}
    >
      <span className="bn-bench-label">{t.agent.bench}</span>
      <span className="bn-bench-row">
        {free.length === 0 && <span className="bn-muted">{t.agent.benchEmpty}</span>}
        {free.map((a) => (
          <AgentToken key={a.id} g={g} agent={a} selected={selAgent === a.id} dragging={drag?.agent === a.id} bind={bind} />
        ))}
      </span>
    </div>
  );
}
