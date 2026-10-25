"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { initOfficePhysics, OfficeEngine, type OfficeApi, type OfficeEvents, type OfficeSettings } from "./office-engine";

export default function OfficeWorld({ settings, events, api }: {
  settings: OfficeSettings; events: OfficeEvents; api: MutableRefObject<OfficeApi | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<OfficeEngine | null>(null);
  const latest = useRef({ settings, events });
  useEffect(() => {
    latest.current = { settings, events };
    if (engine.current) engine.current.settings = settings;
  }, [settings, events]);
  useEffect(() => {
    let disposed = false;
    async function initialize() {
      try {
        await initOfficePhysics();
        if (disposed || !host.current) return;
        const callbacks = Object.fromEntries(
          ["ready", "fail", "frame", "status", "interact", "lock", "map", "toast"].map((key) => [key, (...args: unknown[]) => {
            const callback = latest.current.events[key as keyof OfficeEvents] as (...values: unknown[]) => void;
            callback(...args);
          }]),
        ) as OfficeEvents;
        const game = new OfficeEngine(host.current, callbacks);
        game.settings = latest.current.settings;
        engine.current = game; api.current = game;
      } catch {
        if (!disposed) latest.current.events.fail("Your browser couldn’t start the 3D office. Enable hardware acceleration or try another browser.");
      }
    }
    void initialize();
    return () => { disposed = true; engine.current?.dispose(); engine.current = null; api.current = null; };
  }, [api]);
  return <div ref={host} className="office-world" />;
}
