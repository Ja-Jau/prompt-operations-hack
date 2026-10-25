import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { HiringCompany } from "../src/types/company";
import { roleSolution } from "../src/lib/case/solution";
import { contactSheet } from "../src/lib/outreach/contacts";
import { draftOpportunityEmail } from "../src/lib/outreach/marketing";
import hiring from "../src/data/hiring.json";

const companies = hiring as HiringCompany[];

test("reviewed company fixes retain their original evidence without changing the data", () => {
  const company = companies.find((item) => item.velhoCase)!;
  const before = JSON.stringify(company);
  const solution = roleSolution(company);
  assert.equal(solution.action, company.velhoCase!.fixOptions[company.velhoCase!.correctIndex]);
  assert.equal(solution.reasoning, company.velhoCase!.fixReasoning);
  assert.equal(solution.evidence, company.jobAds.ads[0]);
  assert.equal(solution.basis, "reviewed");
  assert.equal(JSON.stringify(company), before);
});

test("an unreviewed billing ad gets a task-level proposal and keeps finance approvals", () => {
  const base = companies[0];
  const company: HiringCompany = { ...base, velhoCase: null, jobAds: { ...base.jobAds, ads: [{
    ...base.jobAds.ads[0], titleEn: "Accountant", quoteEn: "Process invoices and check payment records.", quote: "Process invoices and check payment records.",
  }] } };
  const solution = roleSolution(company);
  assert.equal(solution.role, "Accountant");
  assert.equal(solution.area, "Billing and finance");
  assert.match(solution.action, /invoice/);
  assert.match(solution.people, /approves/);
  assert.equal(solution.basis, "suggested");
});

test("marketing drafts contain the company's evidence, proposed fix and brief without contacting anyone", () => {
  const company = companies.find((item) => item.velhoCase)!;
  const contacts = contactSheet(company);
  const solution = roleSolution(company);
  const brief = `https://example.test/brief/${company.id}`;
  const draft = draftOpportunityEmail(company, contacts, brief, solution);
  assert.equal(draft.to, contacts.contacts[0].email);
  assert.ok(draft.body.includes(company.jobAds.ads[0].quote));
  assert.ok(draft.body.includes(solution.action));
  assert.ok(draft.body.includes(brief));
  assert.ok(draft.subject.includes(company.name));
});

test("the marketing demo send has no network or email delivery path", () => {
  const component = readFileSync("src/components/dashboard/MarketingDashboard.tsx", "utf8");
  assert.doesNotMatch(component, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|mailto:|\/api\/outreach/);
  assert.match(component, /No email was sent/);
  const moduleSource = readFileSync("src/lib/outreach/marketing.ts", "utf8");
  assert.doesNotMatch(moduleSource, /\bfetch\s*\(|sendMail\s*\(|createTransport\s*\(/);
});
