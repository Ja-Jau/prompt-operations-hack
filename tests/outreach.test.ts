import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { HiringCompany } from "../src/types/company";
import { contactSheet, deriveDomain, slugForDomain } from "../src/lib/outreach/contacts";
import { draftEmail, emailAsText } from "../src/lib/outreach/email";
import { findTargets, isStaffing, scoreTarget } from "../src/lib/outreach/targets";
import hiring from "../src/data/hiring.json";

const companies = hiring as HiringCompany[];
// Tests are compiled to /tmp and run from the project root, so the source tree is cwd.
const ROOT = process.cwd();

test("targets are ranked, every one has a reason, and agencies sink", () => {
  const targets = findTargets(companies);
  assert.ok(targets.length > 0);
  for (let i = 1; i < targets.length; i++) assert.ok(targets[i - 1].score >= targets[i].score, "sorted by score");
  for (const t of targets) {
    assert.ok(t.reasons.length > 0, `${t.company.name} has a reason`);
    assert.ok(t.company.jobAds.manual > 0, "only companies with routine-work ads");
  }
  const workpower = targets.find((t) => /workpower/i.test(t.company.name));
  assert.ok(workpower?.staffing, "Workpower is flagged as staffing");
  assert.ok(isStaffing({ name: "Barona Teollisuus Oy" }));
  assert.ok(!isStaffing({ name: "Destia Oy" }));
  // The agency with the most manual ads must not outrank a real company with a Velho take.
  const destia = targets.find((t) => /destia/i.test(t.company.name))!;
  assert.ok(destia.score > workpower!.score);
});

test("scoring rewards volume, share, breadth and a ready Velho take", () => {
  const base = companies.find((c) => c.id === "destia-oy")!;
  const rich = scoreTarget(base);
  const poor = scoreTarget({ ...base, locations: ["Espoo"], functions: ["Finance"], velhoCase: null, logo: null, domain: null });
  assert.ok(rich.score > poor.score);
  assert.ok(rich.reasons.some((r) => r.includes("Velho's take is ready")));
  assert.ok(!poor.reasons.some((r) => r.includes("Velho's take is ready")));
});

test("domains come from the data when known and are flagged when derived", () => {
  assert.deepEqual(deriveDomain({ name: "Valmet", domain: "valmet.com" }), { domain: "valmet.com", confidence: "verified" });
  assert.deepEqual(deriveDomain({ name: "Destia Oy", domain: null }), { domain: "destia.fi", confidence: "derived" });
  assert.equal(slugForDomain("Lassila & Tikanoja Oyj"), "lassilatikanoja");
  assert.equal(slugForDomain("CSC – Tieteen tietotekniikan keskus Oy"), "csc");
  assert.equal(slugForDomain("FVR - Suomen rokotetutkimus"), "fvr");
  assert.equal(slugForDomain("Hämeenlinnan kaupunki"), "hameenlinnankaupunki");
});

test("contact sheets never invent a personal address and carry a confidence", () => {
  for (const company of companies.filter((c) => c.jobAds.manual > 0)) {
    const sheet = contactSheet(company);
    assert.ok(sheet.contacts.length >= 2 && sheet.contacts.length <= 3, `${company.name} has 2–3 inboxes`);
    for (const c of sheet.contacts) {
      assert.match(c.email, /^(info|hr|talous|hankinta|asiakaspalvelu|rekrytointi)@[a-z0-9.-]+\.[a-z]+$/, `${c.email} is a role inbox`);
      assert.ok(["verified", "likely", "derived"].includes(c.confidence));
      assert.ok(c.basis.length > 0);
    }
    // Role inboxes are never "verified": nobody has confirmed they exist.
    assert.ok(sheet.contacts.every((c) => c.confidence !== "verified"));
    assert.ok(sheet.decisionMaker.title.length > 0);
    assert.ok(sheet.decisionMaker.linkedInSearch.startsWith("https://www.linkedin.com/search/"));
  }
});

test("the email quotes the ad verbatim, links the game and brief, and reads as a draft", () => {
  const target = findTargets(companies).find((t) => t.company.id === "destia-oy")!;
  const sheet = contactSheet(target.company);
  const urls = { game: "https://tehokas.example", brief: "https://tehokas.example/brief/destia-oy" };
  const draft = draftEmail(target, sheet, urls);
  assert.equal(draft.to, sheet.contacts[0].email);
  assert.ok(draft.subject.startsWith("Destia:"), "legal suffix removed from the subject");
  assert.ok(draft.subjectFi.includes("avoimesta"));
  const quote = target.company.jobAds.ads[0].quote;
  assert.ok(draft.body.includes(quote.length > 180 ? quote.slice(0, 100) : quote), "verbatim quote");
  assert.ok(draft.body.includes(urls.game) && draft.body.includes(urls.brief));
  assert.ok(draft.body.includes(target.firstFix!.toLowerCase()), "names the first fix");
  assert.ok(draft.body.includes("we have not contacted anyone"));
  assert.ok(emailAsText(draft).startsWith(`To: ${draft.to}\nSubject: `));
});

test("DEMO GUARANTEE: the outreach code has no mail transport", () => {
  const dirs = [path.join(ROOT, "src/lib/outreach"), path.join(ROOT, "src/app/api/outreach"), path.join(ROOT, "src/components/outreach")];
  const forbidden = /nodemailer|smtp|sendgrid|mailgun|postmark|resend\.|createTransport|sendMail\(|@sendgrid|aws-sdk\/client-ses/i;
  for (const dir of dirs) {
    for (const file of readdirSync(dir)) {
      const text = readFileSync(path.join(dir, file), "utf8");
      // Strip comments, which are allowed to *mention* SMTP to say we don't use it.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      assert.ok(!forbidden.test(code), `${file} must not reference a mail transport`);
    }
  }
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  assert.ok(!deps.some((d) => forbidden.test(d)), "no mail library in package.json");
});
