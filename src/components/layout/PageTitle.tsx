import type { ReactNode } from "react";

/** Big centred game title, like a daily word game, in Velho's type. */
export function PageTitle({ eyebrow, title, compact }: { eyebrow: ReactNode; title: string; compact?: boolean }) {
  return (
    <div className={`text-center ${compact ? "pb-4 pt-5 md:pb-6 md:pt-8" : "pb-6 pt-8 md:pb-8 md:pt-12"}`}>
      <h1
        className={`leading-none tracking-[-0.045em] ${
          compact ? "text-[clamp(32px,4.6vw,56px)]" : "text-[clamp(38px,6.4vw,80px)]"
        }`}
      >
        {title}
      </h1>
      <p className="eyebrow mt-3 text-sage-d">{eyebrow}</p>
    </div>
  );
}
