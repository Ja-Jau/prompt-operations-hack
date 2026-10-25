import type { ReactNode } from "react";

/** Big centred game title, like a daily word game, in Velho's type. */
export function PageTitle({ eyebrow, title, compact }: { eyebrow: ReactNode; title: ReactNode; compact?: boolean }) {
  return (
    <div className={`text-center ${compact ? "pb-4 pt-5 md:pb-6 md:pt-8" : "pb-6 pt-8 md:pb-10 md:pt-14"}`}>
      <h1
        className={`leading-[0.9] ${
          compact
            ? "text-[clamp(32px,4.6vw,56px)] tracking-[-0.045em]"
            : "text-[clamp(64px,11vw,132px)] font-black tracking-[-0.035em]"
        }`}
      >
        {title}
      </h1>
      <p className="eyebrow mt-4 text-sage-d">{eyebrow}</p>
    </div>
  );
}
