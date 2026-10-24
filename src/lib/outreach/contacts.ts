import type { HiringCompany } from "@/types/company";
import { displayName, isPublicSector } from "./targets";

/**
 * Step 3 of the outreach pipeline: work out who to write to.
 *
 * This is a prototype, so nothing is scraped and no contact database is queried. Instead:
 *  - the domain comes from the data pipeline when it's known, otherwise it is *derived* from the
 *    company name and flagged as unverified;
 *  - the inboxes are the role-based addresses Finnish companies usually publish (info@, hr@…),
 *    never a named person's address we haven't seen;
 *  - the decision-maker is a *role to look up*, with a LinkedIn search link, not a guessed name.
 *
 * Every contact carries a confidence so a person at Velho can verify before anything goes out.
 */

export type Confidence = "verified" | "likely" | "derived";

export type Contact = {
  email: string;
  /** Who usually reads this inbox. */
  role: string;
  confidence: Confidence;
  /** Where the address comes from, in one line. */
  basis: string;
};

export type DecisionMaker = {
  /** The title to look for, e.g. "CFO" or "COO". */
  title: string;
  /** Why this role, given the company's ads. */
  why: string;
  /** LinkedIn people search for that title at the company. */
  linkedInSearch: string;
};

export type ContactSheet = {
  domain: string;
  domainConfidence: Confidence;
  website: string;
  contacts: Contact[];
  decisionMaker: DecisionMaker;
  /** Google search for the company's own careers or contact page. */
  contactPageSearch: string;
};

const LEGAL = /\b(oyj|oy|ab|abp|ltd|inc|gmbh|ry|plc)\b\.?/gi;

/** "Lassila & Tikanoja Oyj" → "lassila-tikanoja". Used only when no domain is on file. */
export function slugForDomain(name: string): string {
  return name
    .replace(LEGAL, "")
    .replace(/–.*$/, "") // "CSC – Tieteen tietotekniikan keskus" → "CSC"
    .replace(/\s*-\s*.*$/, "") // "FVR - Suomen rokotetutkimus" → "FVR"
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents: ä → a, ö → o
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("");
}

export function deriveDomain(company: Pick<HiringCompany, "name" | "domain">): { domain: string; confidence: Confidence } {
  if (company.domain) return { domain: company.domain, confidence: "verified" };
  const slug = slugForDomain(company.name) || "example";
  return { domain: `${slug}.fi`, confidence: "derived" };
}

/** Which inbox a Velho opener should go to, given what the ads are about. */
function inboxesFor(company: HiringCompany, domain: string, domainConfidence: Confidence): Contact[] {
  // Role inboxes inherit the domain's confidence, capped at "likely": nobody has confirmed they exist.
  const confidence: Confidence = domainConfidence === "verified" ? "likely" : "derived";
  const basis =
    domainConfidence === "verified"
      ? `Standard role inbox at ${domain} (domain on file)`
      : `Standard role inbox at ${domain} (domain derived from the company name, unverified)`;

  const functions = new Set(company.functions);
  const contacts: Contact[] = [{ email: `info@${domain}`, role: "General enquiries, usually forwarded", confidence, basis }];

  if (functions.has("Finance")) contacts.push({ email: `talous@${domain}`, role: "Finance team (talous)", confidence: "derived", basis });
  if (functions.has("HR")) contacts.push({ email: `hr@${domain}`, role: "HR, who wrote the ad", confidence: "derived", basis });
  if (functions.has("Procurement") || functions.has("Logistics")) {
    contacts.push({ email: `hankinta@${domain}`, role: "Procurement (hankinta)", confidence: "derived", basis });
  }
  if (functions.has("Customer service")) {
    contacts.push({ email: `asiakaspalvelu@${domain}`, role: "Customer service", confidence: "derived", basis });
  }
  if (contacts.length === 1) contacts.push({ email: `rekrytointi@${domain}`, role: "Recruitment, who posted the ad", confidence: "derived", basis });

  return contacts.slice(0, 3);
}

/** The role Velho should ask for, inferred from where the routine work sits. */
export function decisionMakerFor(company: HiringCompany): DecisionMaker {
  const functions = company.functions;
  const name = displayName(company);
  let title = "COO";
  let why = "Operations owns the routine work the ads describe.";

  if (functions.includes("Finance") && !functions.includes("Logistics")) {
    title = "CFO";
    why = "The ads describe finance work: reconciliations, invoicing, month-end reporting.";
  } else if (functions.includes("HR") && functions.length === 1) {
    title = "HR Director";
    why = "The routine work is in HR and payroll, and HR wrote the ad.";
  } else if (functions.includes("Logistics") || functions.includes("Procurement")) {
    title = "COO";
    why = "Orders, stock and supplier data: that's operations' budget.";
  } else if (isPublicSector(company)) {
    title = "Hallintojohtaja";
    why = "In public bodies the administrative director owns process budgets.";
  } else if (company.jobAds.checked >= 8) {
    title = "CEO";
    why = "A large hiring round means the CEO is already thinking about headcount versus tooling.";
  }

  const query = encodeURIComponent(`${title} ${name}`);
  return { title, why, linkedInSearch: `https://www.linkedin.com/search/results/people/?keywords=${query}` };
}

export function contactSheet(company: HiringCompany): ContactSheet {
  const { domain, confidence } = deriveDomain(company);
  return {
    domain,
    domainConfidence: confidence,
    website: `https://www.${domain}`,
    contacts: inboxesFor(company, domain, confidence),
    decisionMaker: decisionMakerFor(company),
    contactPageSearch: `https://www.google.com/search?q=${encodeURIComponent(`${company.name} yhteystiedot`)}`,
  };
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  verified: "On file",
  likely: "Likely",
  derived: "Derived · verify",
};
