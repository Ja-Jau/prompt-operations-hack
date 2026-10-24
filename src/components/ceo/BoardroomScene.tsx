import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/** The room stays in place while the projected slides and presenter captions change. */
export function BoardroomScene({ children, confidence, stage }: {
  children: ReactNode;
  confidence: number;
  stage: "intro" | "playing" | "results";
}) {
  return (
    <main className="boardroom-scene" data-stage={stage} aria-label="First-person view from the CEO’s seat in a boardroom">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative game environment */}
      <img src="/images/ceo/boardroom.webp" alt="" aria-hidden="true" className="boardroom-environment" fetchPriority="high" />
      <div className="boardroom-vignette" aria-hidden="true" />
      <div className="boardroom-projector-beam" aria-hidden="true" />
      <div className="boardroom-pressure" aria-hidden="true" />
      {stage !== "intro" && <aside className="boardroom-confidence" aria-label={`Board confidence: ${confidence} percent`}>
        <div><Icon name="target" /><span>Board confidence</span><strong>{confidence}%</strong></div>
        <div className="boardroom-confidence-track"><span style={{ width: `${confidence}%` }} /></div>
      </aside>}
      {children}
    </main>
  );
}

export function ProjectorScreen({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return (
    <section className={`boardroom-projector ${className}`} aria-label="Projected presentation">
      <div className="boardroom-projector-rail"><span><i /> Velho</span><span>{label}</span></div>
      <div className="boardroom-projector-content">{children}</div>
    </section>
  );
}
