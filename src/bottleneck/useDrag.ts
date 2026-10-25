"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type DropTarget = { kind: "stage"; index: number } | { kind: "bench" } | null;
export type DragState = { agent: number; x: number; y: number; over: string | null } | null;

const MOVE_THRESHOLD = 8; // px before a press becomes a drag; below that it is a tap

/** Which drop zone (a stage cell or the bench) is under a screen point. Zones carry data-drop attributes. */
export function dropAt(x: number, y: number): DropTarget {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]");
  if (!el) return null;
  if (el.dataset.drop === "bench") return { kind: "bench" };
  return { kind: "stage", index: Number(el.dataset.index) };
}

const keyOf = (t: DropTarget) => (t ? (t.kind === "bench" ? "bench" : `s${t.index}`) : null);

/**
 * Pointer-based drag and drop for agent tokens (mouse, touch and pen share one code path).
 * - A press that moves more than 8 px becomes a drag; releasing over a drop zone calls onDrop.
 * - A press that does not move is a tap and calls onTap. The keyboard (Enter/Space) also calls onTap.
 * Tokens must set `touch-action: none` in CSS so the page does not scroll while dragging.
 */
export function useDrag(
  onDrop: (agent: number, target: DropTarget) => void,
  onTap: (agent: number) => void,
) {
  const [drag, setDrag] = useState<DragState>(null);
  const press = useRef<{ agent: number; x: number; y: number; moved: boolean } | null>(null);

  const bind = useCallback(
    (agent: number) => ({
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.button !== undefined && e.button > 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        press.current = { agent, x: e.clientX, y: e.clientY, moved: false };
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const p = press.current;
        if (!p || p.agent !== agent) return;
        if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_THRESHOLD) p.moved = true;
        if (p.moved) setDrag({ agent, x: e.clientX, y: e.clientY, over: keyOf(dropAt(e.clientX, e.clientY)) });
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        const p = press.current;
        press.current = null;
        if (!p || p.agent !== agent) return;
        setDrag(null);
        if (p.moved) onDrop(agent, dropAt(e.clientX, e.clientY));
        else onTap(agent);
      },
      onPointerCancel: () => {
        press.current = null;
        setDrag(null);
      },
      // Keyboard activation only: a pointer tap is handled in onPointerUp (a keyboard click has detail 0).
      onClick: (e: { detail: number }) => {
        if (e.detail === 0) onTap(agent);
      },
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (e.key === "Escape") setDrag(null);
      },
    }),
    [onDrop, onTap],
  );

  return { drag, bind };
}
