import type { HiringCompany } from "../../types/company";
import { roleSolution, type RoleSolution } from "../case/solution";
import type { ContactSheet } from "./contacts";
import type { EmailDraft } from "./email";

export type InvitationLinks = { game: string; interested: string; declined: string };

/** Draft text only. This module has no network or delivery operations. */
export function draftOpportunityEmail(company: HiringCompany, contacts: ContactSheet, briefUrl: string, solution: RoleSolution = roleSolution(company), links?: InvitationLinks): EmailDraft {
  const ad = solution.evidence;
  return {
    to: contacts.contacts[0]?.email ?? "",
    subject: `${company.name}: play Firmle, discover smarter ways to work`,
    subjectFi: `${company.name}: vähemmän rutiinityötä`,
    body: [
      "Hi,", "",
      `We noticed your ${solution.role} opening${ad ? ":" : "."}`,
      ...(ad ? [`“${ad.quote}”`, ""] : [""]),
      `Try Firmle, the Velho game: ${links?.game ?? new URL("/", briefUrl).href}`, "",
      "Guess which companies are hiring for routine work, then discover how Velho could help your own team work more efficiently.", "",
      `For ${company.name}, one possible starting point is: ${solution.action}`, "",
      solution.reasoning, "",
      `${solution.people} We would first review the workflow with your team to understand what can be automated.`, "",
      `Here is a brief based on your public job ads: ${briefUrl}`, "",
      "Would you like to explore improvements with Velho?", "",
      ...(links ? [`Yes, contact me: ${links.interested}`, ...(links.declined ? [`No thanks: ${links.declined}`] : []), ""] : []),
      "Best regards,", "The Velho team", "https://velho.io/",
    ].join("\n"),
  };
}

/** Safe HTML for the demo email preview or export; never delivers an email. */
export function invitationEmailHtml(draft: EmailDraft, links: InvitationLinks): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const button = (label: string, url: string, primary = false) => `<a href="${escape(url)}" target="_blank" rel="noreferrer" style="display:inline-block;padding:12px 18px;margin:6px 8px 6px 0;border:1px solid #0a1b34;border-radius:6px;background:${primary ? "#0a1b34" : "#ffffff"};color:${primary ? "#ffffff" : "#0a1b34"};font-size:14px;font-weight:600;text-decoration:none">${label}</a>`;
  const paragraphs = draft.body.split(/\n\s*\n/).map((paragraph) => {
    // CTA destinations live in the buttons, never as visible tracking URLs.
    const text = paragraph.split("\n").filter((line) => !line.includes(links.interested) && (!links.declined || !line.includes(links.declined))).join("\n").replaceAll(links.game, "").replace(/Try Firmle, the Velho game:\s*$/, "Try Firmle, the Velho game.").trim();
    if (!text) return "";
    const parts = text.split(/(https?:\/\/[^\s<>"”]+)/g);
    const content = parts.map((part) => /^https?:\/\//.test(part)
      ? `<a href="${escape(part)}" target="_blank" rel="noreferrer" style="color:#426791">${part.includes("/brief/") ? "View company brief" : part === "https://velho.io/" ? "velho.io" : "Open link"}</a>`
      : escape(part).replaceAll("\n", "<br />")).join("");
    return `<p style="margin:0 0 16px;line-height:1.65;font-size:14px">${content}</p>`;
  }).join("");
  return `<div style="font-family:Arial,sans-serif;color:#0a1b34;max-width:600px;margin:auto;padding:24px;background:#ffffff"><h1 style="font-size:24px;margin:0 0 24px">Play. Discover. Improve.</h1>${paragraphs}<div style="margin-top:20px">${button("Play the Velho game", links.game, true)}</div><p style="font-size:14px;line-height:1.6">Explore what Velho could improve at your company:</p>${button("Contact Velho", links.interested, true)}${links.declined ? button("No thanks", links.declined) : ""}</div>`;
}
