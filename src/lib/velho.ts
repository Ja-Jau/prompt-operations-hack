/** Where every "Go to Velho" link points. Override with NEXT_PUBLIC_VELHO_URL, e.g. a campaign URL. */
export const VELHO_URL = process.env.NEXT_PUBLIC_VELHO_URL ?? "https://velho.io/";

export type VelhoService = { title: string; before: string; after: string };

/** What Velho fixes, in Velho's own words ("Where we help" on velho.io, read 2026-10-24). */
export const VELHO_SERVICES: VelhoService[] = [
  {
    title: "Customer follow-up",
    before: "Follow-ups written from memory, or missed",
    after: "A ready draft with full context, waiting for review",
  },
  {
    title: "Quotes and order intake",
    before: "Every enquiry re-keyed into a quote by hand",
    after: "Standard quotes drafted automatically, exceptions routed",
  },
  {
    title: "Field reporting",
    before: "Reports typed up after the shift",
    after: "The record is ready when the job ends",
  },
  {
    title: "Scheduling and dispatch",
    before: "Phone calls and a shared spreadsheet",
    after: "Routine jobs scheduled, people only handle conflicts",
  },
  {
    title: "Management reporting",
    before: "Figures copied from several systems each month",
    after: "One current view that flags what changed",
  },
  {
    title: "Robotics and physical automation",
    before: "Stoppages found by walking the floor",
    after: "Sensors and cameras flag issues as they happen",
  },
];
