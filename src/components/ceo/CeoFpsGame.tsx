"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { TopBar, type GameId } from "@/components/layout/TopBar";
import { Icon } from "@/components/ui/Icon";
import { VELHO_URL } from "@/lib/velho";
import { boardConfidence, evaluateDecision, type CeoDecision } from "@/lib/ceo/game";
import { buildOfficeDay, currentEncounter, missedEncounters, OFFICE_DAY_SECONDS, OFFICE_DECISION_SECONDS, officeClock, type DayEncounter } from "@/lib/ceo/day";
import type { OfficeApi, OfficeEvents, OfficeStatus } from "./office-engine";
import "./office.css";

const OfficeWorld = dynamic(() => import("./OfficeWorld"), { ssr: false });
const BEST_KEY = "tehokas-ceo-office-best";
const initialStatus: OfficeStatus = { position: { x: 0, z: 12 }, yaw: 0, zone: "Reception", prompt: "", target: null, distance: 0, held: false };
type Conversation = { event: DayEncounter; deadline: number; remaining: number; decision: CeoDecision | null };

function FloorPlan({ status, encounter, expanded }: { status: OfficeStatus; encounter: DayEncounter | null; expanded: boolean }) {
  const px = (x: number) => (x + 18) / 36 * 240, pz = (z: number) => (z + 14) / 28 * 180;
  return <div className={`office-map ${expanded ? "is-expanded" : ""}`} aria-label={`Office map. You are in ${status.zone}.`}>
    <div className="office-map-label"><span>EXECUTIVE FLOOR</span><span>N ↑</span></div>
    <svg viewBox="0 0 240 180" role="img" aria-label="Floor plan: finance and studio on the left; café, operations and boardroom on the right">
      <rect width="240" height="180" rx="4" fill="#b8d2e5" fillOpacity=".05" />
      <g stroke="#89acc5" strokeWidth="1" fill="none" opacity=".6"><path d="M1 1H239V179H1Z M93 0V19 M93 33V76 M93 90V134 M93 149V180 M147 0V19 M147 33V76 M147 90V134 M147 149V180 M0 51H93 M147 51H240 M0 109H93 M147 109H240" /></g>
      <g fill="#a9c3d6" fontSize="7" textAnchor="middle" fontFamily="monospace"><text x="46" y="28">LOUNGE</text><text x="193" y="28">BOARD</text><text x="46" y="84">STUDIO</text><text x="193" y="84">OPS</text><text x="46" y="147">FINANCE</text><text x="193" y="147">CAFÉ</text></g>
      {encounter && <g><circle cx={px(encounter.position.x)} cy={pz(encounter.position.z)} r="8" fill="#9bdcff" fillOpacity=".18" /><circle cx={px(encounter.position.x)} cy={pz(encounter.position.z)} r="3.5" fill="#a4dfff" /></g>}
      <g transform={`translate(${px(status.position.x)},${pz(status.position.z)}) rotate(${-status.yaw * 180 / Math.PI})`}><path d="M0 -7L4 5 0 3 -4 5Z" fill="#fffaf1" /></g>
    </svg>
    {expanded && <p>Glowing dot = your next conversation.<br />Doors connect through the central corridor.</p>}
  </div>;
}

function TouchControls({ api, prompt }: { api: RefObject<OfficeApi | null>; prompt: string }) {
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  function down(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    const x = event.clientX - drag.current.x, y = event.clientY - drag.current.y, length = Math.max(1, Math.hypot(x, y) / 32);
    setStick({ x: x / length, y: y / length }); api.current?.move(x / length / 32, y / length / 32);
  }
  function up() { drag.current = null; setStick({ x: 0, y: 0 }); api.current?.move(0, 0); }
  useEffect(() => () => api.current?.move(0, 0), [api]);
  return <div className="office-touch-controls">
    <div role="group" aria-label="Movement joystick" className="office-joystick" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}><span style={{ transform: `translate(${stick.x}px,${stick.y}px)` }} /><small>MOVE</small></div>
    <div className="office-touch-actions"><button aria-label="Jump" onClick={() => api.current?.jump()}>↑</button><button aria-label="Interact" disabled={!prompt} onClick={() => api.current?.interact()}>E</button><button aria-label="Throw carried carton" onClick={() => api.current?.throw()}>F</button></div>
  </div>;
}

export function CeoFpsGame({ onGameChange }: { onGameChange: (game: GameId) => void }) {
  const [stage, setStage] = useState<"intro" | "playing" | "results">("intro");
  const [day, setDay] = useState<DayEncounter[]>(() => buildOfficeDay(() => 0.5));
  const [session, setSession] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [answers, setAnswers] = useState<CeoDecision[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [map, setMap] = useState(false);
  const [status, setStatus] = useState<OfficeStatus>(initialStatus);
  const [toast, setToast] = useState("");
  const [best, setBest] = useState(0);
  const [copied, setCopied] = useState(false);
  const api = useRef<OfficeApi | null>(null);
  const clock = useRef(0);
  const lastUi = useRef(0);
  const conversationRef = useRef<Conversation | null>(null);
  const runtime = useRef({ stage, paused });
  const encounter = currentEncounter(day, answers, elapsed);
  const upcoming = day.find((event) => event.at > elapsed);
  const score = answers.filter((answer) => answer.correct).length;
  const confidence = boardConfidence(answers);
  useEffect(() => { runtime.current = { stage, paused }; }, [stage, paused]);
  useEffect(() => { const media = window.matchMedia("(prefers-reduced-motion: reduce)"); setReducedMotion(media.matches); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 5500); return () => clearTimeout(timer); }, [toast]);

  const record = useCallback((decision: CeoDecision) => {
    setAnswers((previous) => previous.some((item) => item.scenarioId === decision.scenarioId) ? previous : [...previous, decision]);
  }, []);

  const choose = useCallback((choiceId: string | null) => {
    const current = conversationRef.current;
    if (!current || current.decision) return;
    const left = Math.max(0, current.deadline - clock.current);
    const decision = evaluateDecision(current.event.scenario, choiceId, left * 1000);
    const next = { ...current, remaining: decision.timedOut ? 0 : left, decision };
    conversationRef.current = next; setConversation(next); record(decision);
  }, [record]);

  const frame = useCallback((seconds: number) => {
    clock.current = Math.min(OFFICE_DAY_SECONDS, clock.current + seconds);
    if (clock.current - lastUi.current >= 0.1 || clock.current >= OFFICE_DAY_SECONDS) {
      lastUi.current = clock.current; setElapsed(clock.current);
      const current = conversationRef.current;
      if (current && !current.decision) {
        const remaining = Math.max(0, current.deadline - clock.current);
        if (remaining <= 0) choose(null);
        else { const next = { ...current, remaining }; conversationRef.current = next; setConversation(next); }
      }
    }
  }, [choose]);

  useEffect(() => {
    if (stage !== "playing" || paused) return;
    const missed = missedEncounters(day, answers, elapsed).filter((event) => event.id !== conversation?.event.id);
    if (missed.length) {
      setAnswers((previous) => [...previous, ...missed.filter((event) => !previous.some((item) => item.scenarioId === event.scenario.id)).map((event) => evaluateDecision(event.scenario, null, 0))]);
      setToast("The day moved on. A missed conversation counts as an unanswered decision.");
    }
    if (elapsed >= OFFICE_DAY_SECONDS) {
      const all = [...answers];
      for (const event of day) if (!all.some((item) => item.scenarioId === event.scenario.id)) all.push(evaluateDecision(event.scenario, null, 0));
      setAnswers(all); setStage("results"); conversationRef.current = null; setConversation(null); api.current?.release();
      const nextBest = Math.max(best, all.filter((answer) => answer.correct).length); setBest(nextBest);
      try { localStorage.setItem(BEST_KEY, String(nextBest)); } catch { /* Optional storage. */ }
    }
  }, [elapsed, stage, paused, day, answers, conversation, best]);

  function start() {
    setDay(buildOfficeDay()); setAnswers([]); clock.current = 0; lastUi.current = 0;
    setElapsed(0); setPaused(false); setCopied(false); setMap(false); setToast("Welcome to your first day. Find Alex at reception.");
    conversationRef.current = null; setConversation(null); setStage("playing");
    try { setBest(Number(localStorage.getItem(BEST_KEY)) || 0); } catch { setBest(0); }
    api.current?.capture();
  }

  function resume() { setPaused(false); if (!conversationRef.current) api.current?.capture(); }
  function pause() { setPaused(true); api.current?.release(); }
  function closeConversation() {
    conversationRef.current = null; setConversation(null); api.current?.capture();
    if (answers.length === day.length) setToast("All decisions made. Take a breath. Your day ends at 17:00.");
  }
  function restart() { api.current?.release(); setStage("intro"); setPaused(false); setReady(false); setError(null); setSession((value) => value + 1); clock.current = 0; setElapsed(0); setAnswers([]); conversationRef.current = null; setConversation(null); }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement)?.matches("input,textarea")) return;
      if (!runtime.current.paused && conversationRef.current && !conversationRef.current.decision && /^[123]$/.test(event.key)) {
        event.preventDefault(); const option = conversationRef.current.event.scenario.choices[Number(event.key) - 1]; choose(option.id);
      }
      if (event.code === "Escape" && runtime.current.stage === "playing" && !document.pointerLockElement) setPaused(true);
    };
    const visibility = () => { if (document.hidden && runtime.current.stage === "playing") { setPaused(true); api.current?.release(); } };
    window.addEventListener("keydown", keydown); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("keydown", keydown); document.removeEventListener("visibilitychange", visibility); };
  }, [choose]);

  const events: OfficeEvents = {
    ready: () => setReady(true), fail: setError, frame, status: setStatus, toast: setToast, map: () => setMap((value) => !value),
    lock: (locked) => { if (!locked && runtime.current.stage === "playing" && !conversationRef.current) setPaused(true); },
    interact: (id) => {
      if (conversationRef.current || !encounter || encounter.id !== id) return;
      const current: Conversation = { event: encounter, deadline: Math.min(clock.current + OFFICE_DECISION_SECONDS, encounter.until), remaining: Math.min(OFFICE_DECISION_SECONDS, encounter.until - clock.current), decision: null };
      conversationRef.current = current; setConversation(current); setMap(false);
    },
  };

  async function share() {
    const text = `POV: You are the CEO.\nOne office day. ${score}/${day.length} smart decisions.\n${window.location.origin}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setToast("Sharing isn’t available in this browser."); }
  }

  const running = stage === "playing" && !paused && !error;
  const selected = conversation?.event.scenario.choices.find((choice) => choice.id === conversation.decision?.choiceId);
  const correct = conversation?.event.scenario.choices.find((choice) => choice.correct);
  const decisionNumber = conversation ? day.findIndex((event) => event.id === conversation.event.id) + 1 : 0;

  return <div className="ceo-office flex min-h-0 flex-1 flex-col overflow-hidden bg-navy text-ivory">
    <TopBar game="ceo" onGameChange={(game) => { api.current?.release(); onGameChange(game); }} status="An interactive office day" />
    <div className="office-viewport">
      <OfficeWorld key={session} api={api} settings={{ running, conversation: Boolean(conversation), encounter: stage === "playing" ? encounter : null, muted, reducedMotion, elapsed }} events={events} />
      <div className="office-film" aria-hidden="true" />

      {stage === "intro" && !error && <div className="office-intro office-overlay">
        <div className="office-intro-top"><span className="office-tag"><i /> AN INTERACTIVE OFFICE DAY</span><span>HELSINKI · 09:00</span></div>
        <div className="office-intro-copy"><span className="office-eyebrow">POV: YOU ARE THE CEO</span><h1>Big title.<br /><em>Real decisions.</em></h1><p>Step into the office. Meet your team.<br />Keep a growing company moving.</p>
          <button className="office-primary" disabled={!ready} onClick={start}>{ready ? "Start your day" : "Preparing your office…"}<Icon name="arrowRight" /></button>
          <div className="office-intro-meta"><span>~5 MINUTES</span><i /><span>7 DECISIONS</span><i /><span>ONE DAY IN CHARGE</span></div>
        </div>
        <div className="office-intro-bottom"><span><kbd>W A S D</kbd> Walk <kbd>MOUSE</kbd> Look <kbd>E</kbd> Interact</span><span className="office-touch-hint">Touch: left stick to move · drag to look</span><span>EXPLORE. DECIDE. MAKE IT FLOW.</span></div>
      </div>}

      {stage === "playing" && <>
        <div className="office-hud-top"><div className="office-location"><span className="office-live-dot" />{status.zone}<small>VELHO HQ / FLOOR 07</small></div><div className="office-clock"><span>{officeClock(elapsed)}</span><small>{Math.max(0, Math.ceil(OFFICE_DAY_SECONDS - elapsed))}s left in your day</small></div></div>
        <aside className="office-objective" aria-live="polite"><span className="office-eyebrow">{encounter ? "YOUR NEXT MOVE" : "A MOMENT BETWEEN MEETINGS"}</span><h2>{encounter?.objective ?? (upcoming ? "Make yourself at home." : "Your day is almost done.")}</h2><p>{encounter ? `${encounter.person} · ${encounter.room} · ${Math.round(status.distance)} m` : upcoming ? `Next: ${upcoming.time} · ${upcoming.room}` : "Take a final look around."}</p>{encounter && <div className="office-objective-time"><span style={{ width: `${Math.max(0, (encounter.until - elapsed) / (encounter.until - encounter.at) * 100)}%` }} /></div>}</aside>
        <div className="office-day-progress" aria-label="Day progress"><span style={{ width: `${elapsed / OFFICE_DAY_SECONDS * 100}%` }} /></div>
        {!conversation && !paused && <>
          <div className={`office-crosshair ${status.prompt ? "has-target" : ""}`} aria-hidden="true" />
          {status.prompt && <button className="office-interaction" onClick={() => api.current?.interact()}><kbd>E</kbd>{status.prompt}</button>}
          <div className="office-bottom-left"><FloorPlan status={status} encounter={encounter} expanded={map} /><button className="office-map-toggle" onClick={() => setMap((value) => !value)}><kbd>M</kbd> {map ? "Close map" : "Floor plan"}</button></div>
          <div className="office-controls-hint"><span><kbd>WASD</kbd> Move <kbd>SHIFT</kbd> Sprint <kbd>SPACE</kbd> Jump</span><span>{answers.length}/{day.length} decisions · {confidence}% confidence</span></div>
          <TouchControls api={api} prompt={status.prompt} />
        </>}
        <div className="office-tools"><button aria-label={muted ? "Enable sound" : "Mute sound"} onClick={() => setMuted((value) => !value)}>{muted ? "Sound off" : "Sound on"}</button><button aria-label="Toggle reduced motion" aria-pressed={reducedMotion} onClick={() => setReducedMotion((value) => !value)}>Motion {reducedMotion ? "off" : "on"}</button><button aria-label="Pause day" onClick={pause}>Ⅱ</button></div>

        {conversation && <section className="office-dialogue" aria-label={`${conversation.event.role} decision`} data-urgent={!conversation.decision && conversation.remaining < 6}>
          <div className="office-dialogue-person"><div className="office-avatar">{conversation.event.person.slice(0, 1)}</div><div><strong>{conversation.event.person}</strong><span>{conversation.event.role} · {conversation.event.time}</span></div><span className="office-dialogue-counter">{decisionNumber.toString().padStart(2, "0")} / 07</span></div>
          <p className="office-dialogue-context">“{conversation.event.message}”</p><h1>{conversation.event.scenario.title}</h1><p className="office-dialogue-situation">{conversation.event.scenario.situation}</p>
          <div className="office-options" role="group" aria-label="Choose your next move">{conversation.event.scenario.choices.map((choice, i) => <button key={choice.id} onClick={() => choose(choice.id)} disabled={Boolean(conversation.decision)} data-correct={Boolean(conversation.decision && choice.correct)} data-wrong={Boolean(conversation.decision?.choiceId === choice.id && !choice.correct)}><span>{conversation.decision && choice.correct ? <Icon name="check" /> : `0${i + 1}`}</span><strong>{choice.text}</strong><Icon name="arrowRight" /></button>)}</div>
          <div className="office-decision-timer"><span style={{ transform: `scaleX(${conversation.remaining / OFFICE_DECISION_SECONDS})` }} /></div>
          {conversation.decision ? <div className="office-feedback" role="status"><p><strong>{conversation.decision.timedOut ? "The call wasn’t made." : conversation.decision.correct ? "Good call." : "That adds another handoff."}</strong>{conversation.decision.timedOut ? correct?.explanation : selected?.explanation}</p><button className="office-primary" onClick={closeConversation}>Back to your day<Icon name="arrowRight" /></button></div> : <div className="office-dialogue-footer"><span>YOUR TEAM IS WAITING.</span><span role="timer">{Math.ceil(conversation.remaining)} SEC</span></div>}
        </section>}
      </>}

      {paused && stage === "playing" && !error && <div className="office-pause office-overlay"><div className="office-pause-card"><span className="office-eyebrow">TAKE A BREATH</span><h1>Your day is paused.</h1><p>The clock will wait for you.</p><button className="office-primary" onClick={resume}>Back to the office<Icon name="arrowRight" /></button><button className="office-text-button" onClick={restart}>Restart the day</button><div className="office-pause-settings"><button onClick={() => setMuted((value) => !value)}>{muted ? "Enable sound" : "Mute sound"}</button><button onClick={() => setReducedMotion((value) => !value)} aria-pressed={reducedMotion}>{reducedMotion ? "Enable camera motion" : "Reduce camera motion"}</button></div><div className="office-pause-controls"><p><kbd>WASD</kbd> Walk · <kbd>SHIFT</kbd> Sprint · <kbd>SPACE</kbd> Jump</p><p><kbd>E</kbd> Talk / pick up / drop · <kbd>F</kbd> Throw · <kbd>M</kbd> Map</p><p>Look at a person or object, then interact.</p></div></div></div>}

      {error && <div className="office-pause office-overlay"><div className="office-pause-card"><span className="office-eyebrow">THE OFFICE IS OFFLINE</span><h1>Let’s reconnect.</h1><p>{error}</p><button className="office-primary" onClick={restart}>Try again<Icon name="arrowRight" /></button><button className="office-text-button" onClick={() => onGameChange("higherLower")}>Play Higher or lower</button></div></div>}

      {stage === "results" && <div className="office-results office-overlay"><div className="office-results-card"><section className="office-results-score"><span className="office-eyebrow">17:00 · THE DAY IS DONE</span><h1>{score >= 6 ? "That’s leadership." : "Every decision leaves a mark."}</h1><div className="office-score"><strong>{score}</strong><span>/{day.length}<small>smart decisions</small></span></div><div className="office-results-decisions">{day.map((event) => { const answer = answers.find((item) => item.scenarioId === event.scenario.id); return <span key={event.id} data-correct={Boolean(answer?.correct)} title={`${event.scenario.topic}: ${answer?.correct ? "correct" : answer?.timedOut ? "missed" : "incorrect"}`}><Icon name={answer?.correct ? "check" : "cross"} /><small>{event.scenario.topic}</small></span>; })}</div><p className="office-results-best">Board confidence {confidence}% · Best {best}/{day.length}</p><div className="office-results-actions"><button onClick={restart}>Another day</button><button onClick={share}>{copied ? "Copied!" : "Share result"}</button></div></section><section className="office-results-velho"><span className="office-result-brand"><Icon name="spark" /> Velho</span><h2>Your real company.<br /><em>Your next move.</em></h2><p>Bring the same clarity to your own work.<br />Velho helps teams simplify processes and make room to grow.</p><a href={VELHO_URL} target="_blank" rel="noopener noreferrer" className="office-primary">Make your next move at velho.io<Icon name="arrowRight" /></a><span className="office-result-note">Less routine. More possible.</span></section></div></div>}
      {toast && stage === "playing" && !conversation && <div className="office-toast" role="status"><span />{toast}</div>}
    </div>
  </div>;
}
