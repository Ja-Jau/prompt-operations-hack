import assert from "node:assert/strict";
import { test } from "node:test";
import { dashboardProspects } from "../src/lib/dashboard/prospects";
import type { HiringCompany } from "../src/types/company";
import hiring from "../src/data/hiring.json";

function company(id: string, flagged: boolean): HiringCompany {
  const base = (hiring as HiringCompany[])[0];
  return {
    ...base, id, name: id, velhoCase: null, titles: ["New opening"], titlesEn: ["New opening"],
    jobAds: {
      checked: 1, manual: flagged ? 1 : 0, source: "Supabase sample", fetchedAt: "2026-10-25",
      listings: [{ title: "New opening", url: `https://www.jobly.fi/tyopaikka/${id}` }],
      ads: flagged ? [{ title: "New opening", titleEn: "New opening", quote: "Maintain Excel spreadsheets", quoteEn: "Maintain Excel spreadsheets", url: `https://www.jobly.fi/tyopaikka/${id}` }] : [],
    },
  };
}

test("newly saved companies remain visible even without a repetitive-task match", () => {
  const initial = dashboardProspects([company("existing", true)]);
  const refreshed = dashboardProspects([company("existing", true), company("newly-saved", false)]);
  assert.equal(initial.length, 1);
  assert.equal(refreshed.length, 2);
  assert.equal(refreshed[0].company.id, "existing");
  const added = refreshed.find((row) => row.company.id === "newly-saved")!;
  assert.equal(added.company.jobAds.manual, 0);
  assert.equal(added.solution.evidence, null);
  assert.equal(added.solution.area, "Needs review");
  assert.match(added.solution.reasoning, /No explicit repetitive-task phrase/);
  assert.equal(added.company.jobAds.listings?.[0].url, "https://www.jobly.fi/tyopaikka/newly-saved");
});

test("a new snapshot replaces companies that no longer appear in the saved sample", () => {
  dashboardProspects([company("old", true)]);
  const refreshed = dashboardProspects([company("new", false)]);
  assert.deepEqual(refreshed.map((row) => row.company.id), ["new"]);
  assert.deepEqual(dashboardProspects([]), []);
});
