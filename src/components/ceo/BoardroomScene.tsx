import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/** A focused, site-themed workspace for the CEO decision cards. */
export function BoardroomScene({ children, stage }: {
  children: ReactNode;
  stage: "intro" | "playing" | "results";
}) {
  return (
    <main className="boardroom-scene" data-stage={stage} aria-label="CEO decision game">
      <header className="ceo-stage-header">
        <span className="ceo-stage-label">{stage === "intro" ? "The leadership challenge" : stage === "results" ? "Your results" : "POV: You are the CEO"}</span>

      </header>
      <div className="boardroom-stage">{children}</div>
    </main>
  );
}

export function ProjectorScreen({ children, label, progress = 0, className = "" }: { children: ReactNode; label: string; progress?: number; className?: string }) {
  return (
    <section className={`boardroom-projector ${className}`} aria-label="CEO decision card">
      <div className="boardroom-projector-rail">
        <span className="boardroom-projector-brand"><Icon name="spark" /> Velho</span>
        <span className="boardroom-slide-label">{label}</span>
        <span className="boardroom-slide-progress" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < progress ? "is-complete" : ""} />)}</span>
      </div>
      <div key={label} className="boardroom-projector-content">{children}</div>
    </section>
  );
}
