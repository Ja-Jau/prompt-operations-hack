"use client";

import type { GameCompany } from "@/types/company";
import { VELHO_URL } from "@/lib/velho";
import { LeadForm } from "@/components/leads/LeadForm";
import { Icon } from "@/components/ui/Icon";

type Props = {
  /** The last company shown, whose photo sits behind the score. */
  last?: GameCompany;
  score: number;
  total: number;
  best: number;
  mode: "five" | "endless";
  copied: boolean;
  onPlayAgain: () => void;
  onShare: () => void;
  onPlayFirmle: () => void;
};

/** The end of a run, laid out like the Firmle reveal: the result, then the way to Velho. */
export function RunResult({ last, score, total, best, mode, copied, onPlayAgain, onShare, onPlayFirmle }: Props) {
  const accuracy = total ? Math.round((score / total) * 100) : 0;

  return (
    <div>
      {/* The score, on the last company's photo with Velho's navy shade */}
      <section className="relative isolate overflow-hidden bg-navy text-center text-ivory">
        {last?.image && (
          // eslint-disable-next-line @next/next/no-img-element -- full-bleed background photo
          <img src={last.image} alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgb(10_27_52/0.96)_0%,rgb(10_27_52/0.82)_60%,rgb(10_27_52/0.7)_100%)]" />
        <div className="animate-rise mx-auto max-w-[760px] px-4 py-12 md:py-16">
          <p className="eyebrow text-sky">
            Higher or lower · {mode === "five" ? "5 rounds" : "Endless"} · Best {Math.max(best, score)}
          </p>
          <h1 className="mt-5 font-semibold leading-none tracking-[-0.04em]" aria-label={`${score} correct out of ${total}`}>
            <span className="text-[clamp(52px,7vw,76px)]">{score}</span>
            <span className="text-[clamp(24px,3vw,32px)] text-sky">/{total}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg text-on-dark">
            You called <span className="font-semibold text-sky">{accuracy}%</span> of the comparisons right, using figures
            from real annual reports and job ads.
          </p>
          <a href="#your-company" className="btn btn-light mt-8">
            See how your company ranks <Icon name="arrowRight" />
          </a>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button onClick={onPlayAgain} className="btn btn-line-dark">
              Play again
            </button>
            <button onClick={onShare} className="btn btn-line-dark">
              {copied ? "Copied" : "Share result"}
            </button>
          </div>
        </div>
        {last?.imageCredit && (
          <a
            href={last.imageCredit.url}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-2 right-3 text-[10px] text-on-dark-2 hover:text-ivory"
          >
            Photo: {last.imageCredit.author} / {last.imageCredit.source}
          </a>
        )}
      </section>

      <main className="mx-auto flex max-w-[760px] flex-col gap-8 px-4 py-10 md:py-14">
        {/* The way to Velho, framed by the game itself */}
        <section id="your-company" className="scroll-mt-24 rounded-[14px] bg-navy p-7 text-ivory md:p-9">
          <p className="eyebrow text-sky">Your company</p>
          <h2 className="mt-3 text-[clamp(26px,3vw,38px)] tracking-[-0.03em]">See how your company ranks</h2>
          <p className="mt-3 max-w-lg text-on-dark">
            Velho reads your annual report and open job ads, sends a one-page note on how you compare with the
            companies in this game, and suggests 30 minutes to find the first opportunity.
          </p>
          <div className="mt-6">
            <LeadForm source="higher-lower-result" />
          </div>
          <a
            href={VELHO_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-on-dark hover:text-ivory"
          >
            Or go to velho.io <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </a>
        </section>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <button onClick={onPlayFirmle} className="text-navy-3 hover:text-ink">
            Play today&apos;s Firmle
          </button>
        </div>

        <p className="text-center text-xs text-ink-3">
          Figures from the companies&apos; annual reports and sampled job ads. Tap Sources during a round for each one.
        </p>
      </main>
    </div>
  );
}
