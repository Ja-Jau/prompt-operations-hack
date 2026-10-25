import assert from "node:assert/strict";
import { test } from "node:test";
import { applyResponse, newInvitation, responseCounts } from "../src/lib/outreach/invitations";
import { draftOpportunityEmail, invitationEmailHtml } from "../src/lib/outreach/marketing";
import { contactSheet } from "../src/lib/outreach/contacts";
import { roleSolution } from "../src/lib/case/solution";
import type { HiringCompany } from "../src/types/company";
import hiring from "../src/data/hiring.json";

test("drafts are excluded; confirmed replies replace pending without duplicate counts", () => {
  const draft = newInvitation("test", "Example");
  assert.match(draft.token, /^[a-f0-9]{64}$/);
  assert.notEqual(draft.token, newInvitation("test", "Example").token);
  assert.deepEqual(responseCounts([draft]), { interested: 0, declined: 0, pending: 0 });
  assert.throws(() => applyResponse(draft, "interested"));
  const sent = { ...draft, sentAt: new Date().toISOString() };
  assert.deepEqual(responseCounts([sent]), { interested: 0, declined: 0, pending: 1 });
  const positive = applyResponse(sent, "interested");
  assert.equal(applyResponse(positive, "interested"), positive);
  assert.deepEqual(responseCounts([positive]), { interested: 1, declined: 0, pending: 0 });
  assert.deepEqual(responseCounts([applyResponse(positive, "declined")]), { interested: 0, declined: 1, pending: 0 });
  assert.throws(() => applyResponse(sent, "bad" as "interested"));
});

test("invitation email includes game, company proposal and both tracked responses; HTML escapes edited text", () => {
  const company = (hiring as HiringCompany[])[0];
  const links = { game: "https://example.test/", interested: "https://example.test/respond/abc?choice=interested", declined: "https://example.test/respond/abc?choice=declined" };
  const draft = draftOpportunityEmail(company, contactSheet(company), "https://example.test/brief/example", roleSolution(company), links);
  for (const link of Object.values(links)) assert.ok(draft.body.includes(link));
  assert.match(draft.body, /Try Firmle/);
  const html = invitationEmailHtml({ ...draft, body: '<script>alert("x")</script>' }, links);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes(`href="${links.interested}"`));
  assert.ok(html.includes(`href="${links.declined}"`));
});
