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
  const visible = invitationEmailHtml(draft, links).replace(/<[^>]+>/g, "");
  assert.ok(!visible.includes("https://"));
  assert.ok(visible.includes("Contact Velho"));
  assert.ok(visible.includes("Play the Velho game"));
});

test("responses persist across processes and retain game visits without double-counting", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const directory = mkdtempSync(join(tmpdir(), "velho-response-test-"));
  const modulePath = resolve(__dirname, "../src/lib/outreach/invitations.js");
  const env = { ...process.env };
  for (const key of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) delete env[key];
  const run = (code: string) => {
    const result = spawnSync(process.execPath, ["-e", `const store = require(${JSON.stringify(modulePath)}); (async () => { ${code} })().catch(error => { console.error(error); process.exit(1); });`], { cwd: directory, env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    const token = run(`const invitation = store.newInvitation("example", "Example"); invitation.sentAt = new Date().toISOString(); await store.saveInvitation(invitation); console.log(invitation.token);`);
    run(`const invitation = await store.findInvitation(${JSON.stringify(token)}); await store.saveInvitation({ ...store.applyResponse(invitation, "interested"), gameClickedAt: "2026-10-25T12:00:00Z" });`);
    assert.equal(run(`console.log(JSON.stringify(store.responseCounts(await store.readInvitations())));`), '{"interested":1,"declined":0,"pending":0}');
    run(`const invitation = await store.findInvitation(${JSON.stringify(token)}); await store.saveInvitation(store.applyResponse(invitation, "declined"));`);
    const stored = JSON.parse(run(`console.log(JSON.stringify(await store.findInvitation(${JSON.stringify(token)})));`));
    assert.equal(stored.response, "declined");
    assert.equal(stored.gameClickedAt, "2026-10-25T12:00:00Z");
    assert.equal(run(`console.log(JSON.stringify(store.responseCounts(await store.readInvitations())));`), '{"interested":0,"declined":1,"pending":0}');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("draft-preview clicks appear in response snapshots without becoming email sends", async () => {
  const { applyInvitationClick, invitationResponseSnapshot } = await import("../src/lib/outreach/invitations");
  const draft = newInvitation("preview", "Preview company");
  assert.equal(invitationResponseSnapshot([draft]).rows.length, 0);
  const interested = applyInvitationClick(draft, "interested");
  assert.equal(interested.sentAt, null);
  assert.ok(interested.previewedAt);
  const snapshot = invitationResponseSnapshot([interested]);
  assert.deepEqual(snapshot.counts, { interested: 1, declined: 0, pending: 0 });
  assert.equal(snapshot.rows[0].preview, true);
  assert.equal(snapshot.rows[0].to, "Draft preview");
  assert.equal(snapshot.rows[0].status, "interested");
  const declined = applyInvitationClick(interested, "declined");
  const played = applyInvitationClick(declined, "game");
  assert.equal(played.response, "declined");
  assert.ok(played.gameClickedAt);
  assert.deepEqual(invitationResponseSnapshot([played]).counts, { interested: 0, declined: 1, pending: 0 });
  const gameOnly = applyInvitationClick(draft, "game");
  assert.deepEqual(invitationResponseSnapshot([gameOnly]).counts, { interested: 0, declined: 0, pending: 1 });
});
