"use client";

import { agentsAt, capacity, effectiveError, maxPerStage, queueLen, stageKind, type Game } from "./engine";
import { t } from "./strings";

type Props = {
  g: Game;
  index: number | null;
  selAgent: number | null;
  onPlace: (i: number) => void;
  onBench: (agentId: number) => void;
};

/** Details of the focused stage, plus the tap-based way to place the selected agent (no dragging needed). */
export function StagePanel({ g, index, selAgent, onPlace, onBench }: Props) {
  if (index === null) return <p className="bn-panel bn-muted">{t.stage.pickStage}</p>;
  const def = g.scn.stages[index];
  const st = g.stages[index];
  const here = agentsAt(g, index);
  const full = here.length >= maxPerStage(g.scn);
  const free = g.agents.some((a) => a.at === null);
  const agent = selAgent !== null ? g.agents.find((a) => a.id === selAgent) : null;
  const target = agent ?? g.agents.find((a) => a.at === null) ?? null;
  const cost = st.integrated ? 0 : def.deployCost;
  let reason = "";
  if (!target) reason = free ? "" : t.stage.noAgents;
  else if (full && target.at !== index) reason = t.stage.full;
  else if (!st.integrated && g.budget < def.deployCost) reason = t.stage.noBudget;
  const canPlace = !!target && !reason && target.at !== index && !g.over && !g.done;

  return (
    <div className="bn-panel">
      <div className="bn-panel-head">
        <h3>{def.name}</h3>
        <span className="bn-chip">{t.stage[stageKind(g, index)]}</span>
      </div>
      <p>{def.description}</p>
      <dl className="bn-dl">
        <div><dt>{t.stage.throughput}</dt><dd>{capacity(g, index).toFixed(1)}{t.stage.perSec}</dd></div>
        <div><dt>{t.stage.queue}</dt><dd>{queueLen(g, index)}</dd></div>
        <div><dt>{t.stage.errors}</dt><dd>{Math.round(effectiveError(g, index) * 100)}%</dd></div>
        <div><dt>{t.stage.cost}</dt><dd>{def.costPerItem.toFixed(1)}</dd></div>
      </dl>
      <div className="bn-panel-actions">
        <button type="button" className="btn btn-dark" disabled={!canPlace} onClick={() => onPlace(index)}>
          {agent ? `Move agent ${agent.id + 1} here` : t.stage.placeHere(cost)}
        </button>
        {here.map((a) => (
          <button key={a.id} type="button" className="btn btn-line" onClick={() => onBench(a.id)}>
            {t.agent.toBench} ({a.id + 1})
          </button>
        ))}
      </div>
      {reason && <p className="bn-warn-text">{reason}</p>}
    </div>
  );
}
