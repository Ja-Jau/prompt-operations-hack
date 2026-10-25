import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import companies from "../src/data/game_companies.json";
import { companyPhotoFallback } from "../src/lib/data/company-images";

test("every discovered company has a local credited photo fallback", () => {
  for (const company of companies) {
    const fallback = companyPhotoFallback(company);
    assert.ok(existsSync(path.join(process.cwd(), "public", fallback.image)));
    assert.ok(fallback.imageCredit.author);
    if (company.image) assert.ok(existsSync(path.join(process.cwd(), "public", company.image)));
  }
});
