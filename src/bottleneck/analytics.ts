/** Analytics stubs. Replace the body of track() with a real tool (Plausible, PostHog...) later. */
export type BottleneckEvent =
  | "game_start"
  | "level_complete"
  | "agent_deployed"
  | "agent_moved"
  | "level_generated"
  | "level_skipped"
  | "cta_view"
  | "cta_submit"
  | "share_click";

export function track(event: BottleneckEvent, props: Record<string, unknown> = {}): void {
  console.log(`[analytics] ${event}`, props);
}
