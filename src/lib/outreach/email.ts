import type { HiringCompany } from "@/types/company";
import { displayName, type Target } from "./targets";
import type { ContactSheet } from "./contacts";

/**
 * Step 4 of the outreach pipeline: a ready-to-edit proposal email.
 *
 * The email invites the company to try the game and to see what Velho found in their own ads.
 * It quotes the ad verbatim, links to the public case and the one-page brief, and asks for 30
 * minutes. Everything Velho-facing is a draft: a person edits and approves it before it goes out.
 */

export type EmailDraft = {
  to: string;
  subject: string;
  /** Finnish subject line, offered as an alternative since the audience is Finnish. */
  subjectFi: string;
  body: string;
};

type Urls = {
  /** Where the game lives, e.g. https://tehokas.example. */
  game: string;
  /** The one-page brief for this company. */
  brief: string;
};

function trimQuote(quote: string, max = 180): string {
  if (quote.length <= max) return quote;
  const cut = quote.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** A plain, short email in Velho's voice: specific, no superlatives, one ask. */
export function draftEmail(target: Target, sheet: ContactSheet, urls: Urls, sender = { name: "Velho team", title: "Velho", email: "hello@velho.io" }): EmailDraft {
  const company = target.company;
  const name = displayName(company);
  const ad = company.jobAds.ads[0];
  const { manual, checked } = company.jobAds;
  const fix = target.firstFix;
  const role = sheet.decisionMaker.title;

  const subject = `${name}: ${manual} of your ${checked} open roles include work software could do`;
  const subjectFi = `${name}: ${manual}/${checked} avoimesta tehtävästänne sisältää työtä, jonka ohjelmisto voisi hoitaa`;

  const lines = [
    `Hi,`,
    ``,
    `I'm writing from Velho. We read Finnish job ads to find routine work that software could take over, and ${name} came up.`,
    ``,
    `Your ad for "${ad.title}" says:`,
    `    "${trimQuote(ad.quote)}"`,
    ``,
    `That's the kind of work we remove so people can spend the time on growth.${fix ? ` For a team like yours we would usually start with one thing: ${fix.toLowerCase()}.` : ""}`,
    ``,
    `Two things you might find useful:`,
    ``,
    `1. ${target.isCase ? "Your ads are one of the cases in" : "Try"} Who's hiring?, a two-minute game where players guess which Finnish company is hiring for routine work: ${urls.game}`,
    `2. A one-page note built only from your public ads, with where we'd start: ${urls.brief}`,
    ``,
    `Would a 30-minute call be useful, to map where work gets stuck at ${name} and what a first improvement could look like? If you're not the right person, I'd be grateful for a pointer to your ${role}.`,
    ``,
    `Best regards,`,
    `${sender.name}`,
    `${sender.title} · ${sender.email}`,
    ``,
    `—`,
    `Based only on public job ads. Quotes are verbatim; we have not contacted anyone at ${name}. Reply "no thanks" and we won't write again.`,
  ];

  return { to: sheet.contacts[0]?.email ?? "", subject, subjectFi, body: lines.join("\n") };
}

/** The email as a single block, for copying into a mail client. */
export function emailAsText(draft: EmailDraft): string {
  return `To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`;
}

/** Companies the dashboard can draft for: those with at least one verbatim quote. */
export function canDraft(company: HiringCompany): boolean {
  return company.jobAds.ads.length > 0;
}
