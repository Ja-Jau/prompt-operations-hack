import type { HiringCompany, JobAd } from "@/types/company";
import { redact } from "@/lib/case/cases";
import { VELHO_SERVICES, type VelhoService } from "@/lib/velho";

/** A company hiring people for work software could do: Velho's reason to talk to them now. */
export type Signal = {
  company: HiringCompany;
  /** Share (0–100) of the open job ads read that describe manual work. */
  share: number;
  manual: number;
  checked: number;
  topQuote: JobAd;
  firstFix: string | null;
  service: VelhoService | null;
};

export function serviceFor(company: HiringCompany): VelhoService | null {
  const area = company.velhoCase?.serviceArea;
  return VELHO_SERVICES.find((s) => s.title === area) ?? null;
}

export function firstFix(company: HiringCompany): string | null {
  const take = company.velhoCase;
  return take ? take.fixOptions[take.correctIndex] : null;
}

/** Every company with manual-work ads, strongest signal first. */
export function buildSignals(companies: HiringCompany[]): Signal[] {
  return companies
    .filter((c) => c.jobAds.ads.length > 0)
    .map((c) => {
      const { manual, checked, ads } = c.jobAds;
      return {
        company: c,
        share: (manual / checked) * 100,
        manual,
        checked,
        topQuote: ads[0],
        firstFix: firstFix(c),
        service: serviceFor(c),
      };
    })
    .sort((a, b) => b.manual - a.manual || b.share - a.share);
}

/** A short first message for a person at Velho to edit and send. Never sent automatically. */
export function draftOpener(signal: Signal, briefUrl: string): string {
  const { company, topQuote, firstFix: fix } = signal;
  const start = fix ? ` Teams like yours usually start with one thing: ${fix.toLowerCase()}.` : "";
  return [
    `Hi,`,
    ``,
    `I noticed ${company.name} is hiring for a ${topQuote.title} role that includes "${topQuote.quote}"`,
    ``,
    `That's the kind of work Velho takes off people's plates, so they can spend the time on growth.${start}`,
    ``,
    `I put together a one-page note from your public job ads: ${briefUrl}`,
    ``,
    `Would a 30-minute call to map where work gets stuck be useful?`,
  ].join("\n");
}

/** Today's case as a LinkedIn post, with the company hidden so the post doesn't spoil the game. */
export function linkedInPost(target: HiringCompany, gameUrl: string): string {
  const quote = target.jobAds.ads[0];
  if (!quote) return "";
  return [
    `A Finnish company is hiring someone for this, right now:`,
    ``,
    `"${redact(quote.quote, target)}"`,
    ``,
    `Can you guess who? Today's Firmle case, made from real open job ads:`,
    gameUrl,
    ``,
    `Every day we read Finnish job ads and find work software could take over.`,
  ].join("\n");
}
