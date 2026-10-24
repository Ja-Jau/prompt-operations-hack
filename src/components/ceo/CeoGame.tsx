"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TopBar, type GameId } from "@/components/layout/TopBar";
import { Icon } from "@/components/ui/Icon";
import { VELHO_URL } from "@/lib/velho";
import { boardConfidence, buildCeoRun, CEO_ROUND_MS, CEO_ROUNDS, evaluateDecision, remainingTime, type CeoDecision } from "@/lib/ceo/game";
import type { CeoScenario } from "@/lib/ceo/scenarios";
import { BoardroomScene, ProjectorScreen } from "./BoardroomScene";
import "./boardroom.css";

type Props = { onGameChange: (game: GameId) => void };
const BEST_KEY = "tehokas-ceo-best";

function readBest(): number {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

function TimedDecision({ scenario, number, onAnswer, onNext, last }: {
  scenario: CeoScenario;
  number: number;
  onAnswer: (decision: CeoDecision) => void;
  onNext: () => void;
  last: boolean;
}) {
  const [remaining, setRemaining] = useState(CEO_ROUND_MS);
  const [decision, setDecision] = useState<CeoDecision | null>(null);
  const deadline = useRef<number | null>(null);
  const settled = useRef(false);
  const nextButton = useRef<HTMLButtonElement>(null);

  const choose = useCallback((choiceId: string | null) => {
    if (settled.current || deadline.current === null) return;
    settled.current = true;
    const left = remainingTime(deadline.current, performance.now());
    const result = evaluateDecision(scenario, choiceId, left);
    setRemaining(result.timedOut ? 0 : left);
    setDecision(result);
    onAnswer(result);
  }, [scenario, onAnswer]);

  useEffect(() => {
    deadline.current = performance.now() + CEO_ROUND_MS;
    const tick = () => {
      if (settled.current) return;
      const left = remainingTime(deadline.current!, performance.now());
      setRemaining(left);
      if (left <= 0) choose(null);
    };
    const interval = window.setInterval(tick, 50);
    const timeout = window.setTimeout(() => choose(null), CEO_ROUND_MS);
    return () => { window.clearInterval(interval); window.clearTimeout(timeout); };
  }, [choose]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.matches("input, textarea, select")) return;
      const option = scenario.choices[Number(event.key) - 1];
      if (option && /^[123]$/.test(event.key)) {
        event.preventDefault();
        choose(option.id);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [choose, scenario]);

  useEffect(() => {
    if (decision) nextButton.current?.focus({ preventScroll: true });
  }, [decision]);

  const seconds = Math.ceil(remaining / 1000);
  const urgent = !decision && remaining <= 10_000;
  const selected = scenario.choices.find((choice) => choice.id === decision?.choiceId);
  const correct = scenario.choices.find((choice) => choice.correct)!;

  return (
    <div className="ceo-decision" data-urgent={urgent} data-outcome={decision ? decision.correct ? "correct" : "wrong" : "waiting"}>
      <ProjectorScreen label={`${number}/${CEO_ROUNDS} · ${scenario.topic}`} progress={number}>
        <h1 id="ceo-scenario-title" className="ceo-scenario-title">{scenario.title}</h1>
        <div className="ceo-choices" role="group" aria-label="Choose your next move">
          {scenario.choices.map((choice, i) => {
            const right = Boolean(decision && choice.correct);
            const wrong = Boolean(decision && choice.id === decision.choiceId && !choice.correct);
            return (
              <button key={choice.id} onClick={() => choose(choice.id)} disabled={Boolean(decision)}
                aria-label={choice.text}
                className={`ceo-choice ${right ? "ceo-choice-correct" : wrong ? "ceo-choice-wrong" : ""}`}>
                <span className="ceo-choice-number">{right ? <Icon name="check" /> : wrong ? <Icon name="cross" /> : `0${i + 1}`}</span>
                <span>{choice.text}</span>
                <Icon name="arrowRight" className="ceo-choice-arrow" />
                {right && <span className="sr-only">Correct choice</span>}
              </button>
            );
          })}
        </div>
        <div className="ceo-timer" aria-label="Decision timer">
          <div className="ceo-timer-label">
            <span>{decision ? "Locked" : urgent ? "Decide now" : "Time left"}</span>
            <span className="ceo-time-pill"><Icon name="clock" /><span role="timer" aria-live="off">{(remaining / 1000).toFixed(1)}<small> SEC</small></span></span>
          </div>
          <div role="progressbar" aria-label="Time remaining" aria-valuemin={0} aria-valuemax={CEO_ROUND_MS / 1000} aria-valuenow={Math.round(remaining / 100) / 10} className="ceo-timer-track">
            <div className="ceo-timer-fill" style={{ transform: `scaleX(${remaining / CEO_ROUND_MS})` }} />
          </div>
          <span className="sr-only" role="status">{urgent ? `${seconds} seconds remaining` : ""}</span>
        </div>
      </ProjectorScreen>
      <aside className="boardroom-briefing" aria-live="polite" aria-atomic="true">
        <div className="boardroom-speaker"><Icon name="quote" /><span>COO</span><span className="boardroom-speaker-line" /></div>
        {decision ? (
          <div className="boardroom-response">
            <div>
              <p className="boardroom-response-title"><Icon name={decision.correct ? "check" : "cross"} />{decision.timedOut ? "Time’s up." : decision.correct ? "Approved." : "Reconsider."}</p>
              <p>{decision.timedOut ? correct.explanation : selected?.explanation}</p>
            </div>
            <button ref={nextButton} onClick={onNext} className="boardroom-next">{last ? "Results" : "Next"}<Icon name="arrowRight" /></button>
          </div>
        ) : (
          <div className="boardroom-response"><p>{scenario.situation}</p></div>
        )}
      </aside>
    </div>
  );
}

export function CeoGame({ onGameChange }: Props) {
  const [stage, setStage] = useState<"intro" | "playing" | "results">("intro");
  const [rounds, setRounds] = useState<CeoScenario[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<CeoDecision[]>([]);
  const [best, setBest] = useState(0);
  const [copied, setCopied] = useState(false);
  const score = answers.filter((answer) => answer.correct).length;
  const recordAnswer = useCallback((answer: CeoDecision) => {
    setAnswers((previous) => previous.some((item) => item.scenarioId === answer.scenarioId) ? previous : [...previous, answer]);
  }, []);

  function start() {
    setRounds(buildCeoRun());
    setIndex(0);
    setAnswers([]);
    setBest(readBest());
    setCopied(false);
    setStage("playing");
  }

  function advance() {
    if (index + 1 < rounds.length) {
      setIndex((previous) => previous + 1);
    } else {
      const nextBest = Math.max(best, score);
      setBest(nextBest);
      try { localStorage.setItem(BEST_KEY, String(nextBest)); } catch { /* Storage is optional. */ }
      setStage("results");
    }
  }

  async function share() {
    const text = `POV: You are the CEO.\n${score}/${CEO_ROUNDS} smart moves · ${CEO_ROUND_MS / 1000} seconds per decision\n${window.location.origin}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { window.prompt("Copy your result:", text); }
  }

  return (
    <div className="ceo-game flex min-h-0 flex-1 flex-col overflow-hidden bg-navy text-ivory">
      <TopBar game="ceo" onGameChange={onGameChange} status={stage === "playing" ? `Score ${score}/${CEO_ROUNDS}` : undefined} />
      <BoardroomScene confidence={boardConfidence(answers)} stage={stage}>
          {stage === "intro" && (
              <ProjectorScreen label="CEO simulation" className="boardroom-opening">
                <div className="ceo-opening-emblem" aria-hidden="true"><Icon name="target" /></div>
                <h1 id="ceo-title">POV: You are<br /><span>the CEO.</span></h1>
                <p className="ceo-opening-copy">5 decisions. {CEO_ROUND_MS / 1000} seconds each.</p>
                <button onClick={start} className="boardroom-start">Start meeting <Icon name="arrowRight" /></button>
              </ProjectorScreen>
          )}
          {stage === "playing" && rounds[index] && (
            <TimedDecision key={rounds[index].id} scenario={rounds[index]} number={index + 1} onAnswer={recordAnswer} onNext={advance} last={index + 1 === rounds.length} />
          )}
          {stage === "results" && (
              <ProjectorScreen label="Results" progress={CEO_ROUNDS} className="boardroom-debrief">
                <div className="ceo-debrief-top">
                  <p className="ceo-final-score"><strong>{score}</strong><span>/{CEO_ROUNDS}</span><small>smart moves</small></p>
                  <div><h1 id="ceo-result-title">{score === CEO_ROUNDS ? "Well played, CEO." : "Meeting complete."}</h1><p className="ceo-personal-best">Best {best}/{CEO_ROUNDS}</p></div>
                </div>
                <ul className="ceo-debrief-list" aria-label="Your decisions">
                  {rounds.map((scenario) => {
                    const answer = answers.find((item) => item.scenarioId === scenario.id);
                    return <li key={scenario.id} data-correct={Boolean(answer?.correct)}><span className="ceo-recap-icon"><Icon name={answer?.correct ? "check" : "cross"} /></span><span>{scenario.topic}</span><span className="sr-only">{answer?.timedOut ? "Timed out" : answer?.correct ? "Correct" : "Incorrect"}</span></li>;
                  })}
                </ul>
                <a href={VELHO_URL} target="_blank" rel="noopener noreferrer" className="boardroom-start ceo-velho-link">Visit velho.io <Icon name="arrowRight" /></a>
                <div className="ceo-debrief-actions"><button onClick={start}>Play again</button><button onClick={share}>{copied ? "Copied!" : "Share"}</button></div>
              </ProjectorScreen>

          )}
      </BoardroomScene>
    </div>
  );
}
