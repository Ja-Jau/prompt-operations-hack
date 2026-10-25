"use client";

import type { Tier } from "@/lib/outreach/targets";

const slices: { id: Tier; label: string; color: string }[] = [
  { id: "hot", label: "High", color: "#0a1b34" },
  { id: "warm", label: "Medium", color: "#7aa3d6" },
  { id: "watch", label: "Watch", color: "#d9d1bf" },
];

/** All slices count companies; the other summary metrics remain separate counts. */
export function PriorityChart({ counts, selected, onSelect }: {
  counts: Record<Tier, number>; selected: Tier | "all"; onSelect: (tier: Tier | "all") => void;
}) {
  const total = counts.hot + counts.warm + counts.watch;
  const circumference = 2 * Math.PI * 48;
  let offset = 0;
  const arcs = slices.map((slice) => {
    const length = total ? counts[slice.id] / total * circumference : 0;
    const arc = { ...slice, length, offset };
    offset += length;
    return arc;
  });
  return <div className="marketing-pie-summary">
    <div className="marketing-pie">
      <svg viewBox="0 0 120 120" role="img" aria-label={`Company priorities: ${counts.hot} high, ${counts.warm} medium, ${counts.watch} watch.`}>
        <circle cx="60" cy="60" r="48" fill="none" stroke="#f0ede5" strokeWidth="16" />
        {arcs.filter((arc) => arc.length > 0).map((arc) => <circle key={arc.id} cx="60" cy="60" r="48" fill="none" stroke={arc.color} strokeWidth="16" strokeDasharray={`${arc.length} ${circumference - arc.length}`} strokeDashoffset={-arc.offset} transform="rotate(-90 60 60)" opacity={selected === "all" || selected === arc.id ? 1 : 0.2} />)}
      </svg>
      <button aria-label="Show all company priorities" onClick={() => onSelect("all")}><strong>{total}</strong><span>candidates</span></button>
    </div>
    <div className="marketing-pie-legend"><h2>Priority mix</h2>{slices.map((slice) => <button key={slice.id} aria-pressed={selected === slice.id} onClick={() => onSelect(selected === slice.id ? "all" : slice.id)}><i style={{ background: slice.color }} /><span>{slice.label}</span><strong>{counts[slice.id]}</strong><small>{total ? Math.round(counts[slice.id] / total * 100) : 0}%</small></button>)}</div>
  </div>;
}
