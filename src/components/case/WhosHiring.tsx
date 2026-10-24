"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HiringCompany } from "@/types/company";
import { MAX_GUESSES, caseClues, caseCompanies, closenessRanks, compare, dailyCase } from "@/lib/case/cases";
import { dailyNumber } from "@/lib/game/daily";
import { TopBar, type GameId } from "@/components/layout/TopBar";
import { PageTitle } from "@/components/layout/PageTitle";
import { Icon } from "@/components/ui/Icon";
import { CaseReveal } from "./CaseReveal";
import { Evidence } from "./Evidence";
import { GuessBar } from "./GuessBar";
import { GuessInput } from "./GuessInput";
import { HowToPlay } from "./HowToPlay";

type Saved = { guesses: string[]; fixChoice: number | null; tipUsed: boolean; gaveUp: boolean };
const EMPTY: Saved = { guesses: [], fixChoice: null, tipUsed: false, gaveUp: false };
const SEEN_HELP_KEY = "tehokas-seen-help";

/** Per day and per case, so a new data import starts a fresh game. */
function storageKey(caseId: string) {
  return `tehokas-case-${dailyNumber()}-${caseId}`;
}

function load(caseId: string): Saved {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(storageKey(caseId)) ?? "{}") };
  } catch {
    return EMPTY;
  }
}

function persist(caseId: string, saved: Saved) {
  try {
    localStorage.setItem(storageKey(caseId), JSON.stringify(saved));
  } catch {
    // Private mode or blocked storage: today's progress just isn't remembered.
  }
}

function seenHelp(): boolean {
  try {
    return localStorage.getItem(SEEN_HELP_KEY) === "1";
  } catch {
    return true;
  }
}

function markHelpSeen() {
  try {
    localStorage.setItem(SEEN_HELP_KEY, "1");
  } catch {
    // Without storage the rules just show again next time.
  }
}

type Props = {
  /** Every company with open job ads; the ones with enough quotes become cases. */
  companies: HiringCompany[];
  onGameChange: (game: GameId) => void;
};

/**
 * The daily case: guess which company is hiring for the manual work in the job-ad quotes.
 * After (or instead of) the daily case, players can run practice cases as often as they like;
 * those are picked at random and never saved.
 */
export function WhosHiring({ companies, onGameChange }: Props) {
  const [dailyTarget, setDailyTarget] = useState<HiringCompany | null | undefined>(undefined);
  const [dailySaved, setDailySaved] = useState<Saved>(EMPTY);
  const [practiceTarget, setPracticeTarget] = useState<HiringCompany | null>(null);
  const [practiceSaved, setPracticeSaved] = useState<Saved>(EMPTY);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Today's case and saved progress depend on the date and localStorage: client only.
  useEffect(() => {
    const today = dailyCase(companies);
    setDailyTarget(today);
    if (today) setDailySaved(load(today.id));
    setHelpOpen(!seenHelp());
  }, [companies]);

  const target = practiceTarget ?? dailyTarget;
  const isPractice = practiceTarget !== null;
  const saved = isPractice ? practiceSaved : dailySaved;

  const casePool = useMemo(() => caseCompanies(companies), [companies]);
  const byId = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const ranks = useMemo(
    () => (target ? closenessRanks(companies, target) : new Map<string, number>()),
    [companies, target],
  );

  const update = (next: Partial<Saved>) => {
    if (isPractice) {
      setPracticeSaved((prev) => ({ ...prev, ...next }));
      return;
    }
    if (!dailyTarget) return;
    setDailySaved((prev) => {
      const merged = { ...prev, ...next };
      persist(dailyTarget.id, merged);
      return merged;
    });
  };

  const playAnother = () => {
    const options = casePool.filter((c) => c.id !== target?.id);
    const next = options[Math.floor(Math.random() * options.length)] ?? casePool[0];
    setPracticeTarget(next);
    setPracticeSaved(EMPTY);
    setMenuOpen(false);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const backToDaily = () => {
    setPracticeTarget(null);
    setMenuOpen(false);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const closeHelp = () => {
    setHelpOpen(false);
    markHelpSeen();
  };

  const label = isPractice ? "Practice case" : `Case No. ${dailyNumber()}`;

  const header = (status?: string) => (
    <TopBar game="case" onGameChange={onGameChange} status={status} onHelp={() => setHelpOpen(true)} />
  );

  if (target === undefined) return <div className="flex-1">{header()}</div>;

  if (target === null) {
    return (
      <div className="flex-1 overflow-y-auto">
        {header()}
        <div className="mx-auto mt-10 max-w-md px-4">
          <div className="card p-8">
            <p className="eyebrow text-sage-d">Daily case</p>
            <h2 className="mt-3 text-3xl">No case today yet</h2>
            <p className="mt-3 text-ink-2">
              No company has enough verified job-ad quotes yet. Run{" "}
              <code className="font-mono text-sm text-clay">pipeline/import_jobs.py</code>.
            </p>
            <button onClick={() => onGameChange("higherLower")} className="btn btn-dark mt-6">
              Play higher or lower <Icon name="arrowRight" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const feedback = saved.guesses.flatMap((id) => {
    const company = byId.get(id);
    return company ? [compare(company, target, ranks)] : [];
  });
  const solved = feedback.some((f) => f.correct);
  const over = solved || saved.gaveUp || feedback.length >= MAX_GUESSES;
  const clues = caseClues(target);

  if (over) {
    return (
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {header(label)}
        {helpOpen && <HowToPlay onClose={closeHelp} />}
        <CaseReveal
          key={target.id}
          company={target}
          label={label}
          feedback={feedback}
          solved={solved}
          fixChoice={saved.fixChoice}
          onFixChoice={(i) => update({ fixChoice: i })}
          onPlayAnother={playAnother}
          onBackToDaily={isPractice ? backToDaily : undefined}
          onPlayHigherLower={() => onGameChange("higherLower")}
        />
      </div>
    );
  }

  const latest = feedback[feedback.length - 1];
  const sorted = [...feedback].sort((a, b) => a.rank - b.rank);
  // One clue per wrong guess, plus one free clue from the analyst lifeline.
  const revealed = Math.min(feedback.length + 1 + (saved.tipUsed ? 1 : 0), clues.length);
  const askAnalyst = () => {
    update({ tipUsed: true });
    setMenuOpen(false);
  };
  const menuItem = "flex w-full items-center gap-2 rounded-[7px] px-3 py-2.5 text-left font-medium hover:bg-sand";

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      {header(`${label} · ${MAX_GUESSES - feedback.length} guesses left`)}
      {helpOpen && <HowToPlay onClose={closeHelp} />}

      <main className="mx-auto max-w-[760px] px-4 pb-20 pl-8 md:pl-4">
        <PageTitle title="Who's hiring?" eyebrow={`${label} · Someone is hiring for this. Who?`} />

        <Evidence key={target.id} clues={clues} revealed={revealed} company={target} />
        {!saved.tipUsed && revealed < clues.length && (
          <button onClick={askAnalyst} className="btn btn-line btn-sm mt-3">
            <Icon name="spark" /> Ask a Velho analyst: unlock the next clue for free
          </button>
        )}

        <div className="relative mt-8 flex gap-3">
          <div className="flex-1">
            <GuessInput
              companies={companies}
              excluded={new Set(saved.guesses)}
              counter={`${feedback.length}/${MAX_GUESSES}`}
              onGuess={(c) => update({ guesses: [...saved.guesses, c.id] })}
            />
          </div>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More options"
            className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[9px] border border-sand-2 bg-white text-ink transition hover:border-navy-3"
          >
            <Icon name="more" className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="card animate-rise absolute right-0 top-[68px] z-30 w-64 overflow-hidden p-1.5 shadow-[0_18px_40px_-20px_rgb(10_27_52/0.35)]">
              <button
                disabled={saved.tipUsed || revealed >= clues.length}
                onClick={askAnalyst}
                className={`${menuItem} disabled:opacity-40 disabled:hover:bg-transparent`}
              >
                <Icon name="spark" /> {saved.tipUsed ? "Free clue used" : "Ask a Velho analyst"}
              </button>
              <button onClick={playAnother} className={menuItem}>
                <Icon name="swap" /> Play a different case
              </button>
              {isPractice && (
                <button onClick={backToDaily} className={menuItem}>
                  <Icon name="calendar" /> Back to today&apos;s case
                </button>
              )}
              <button
                onClick={() => {
                  setHelpOpen(true);
                  setMenuOpen(false);
                }}
                className={menuItem}
              >
                <Icon name="help" /> How to play
              </button>
              <button
                onClick={() => {
                  update({ gaveUp: true });
                  setMenuOpen(false);
                }}
                className={`${menuItem} text-clay`}
              >
                <Icon name="cross" /> Give up and reveal
              </button>
            </div>
          )}
        </div>

        {latest && (
          <div className="mt-8">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="eyebrow text-sage-d">Your guesses, hottest first</p>
              <p className="font-mono text-xs text-ink-3">Rank 1 = the answer</p>
            </div>
            <div className="flex flex-col gap-3">
              {sorted.map((f) => (
                <GuessBar key={f.company.id} feedback={f} latest={f === latest} />
              ))}
            </div>
          </div>
        )}

        {!latest && (
          <p className="mt-8 text-center text-sm text-ink-3">
            Your guesses appear here, ranked by how close they are. 1 is the answer.
          </p>
        )}
      </main>
    </div>
  );
}
