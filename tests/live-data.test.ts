import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import companies from "../src/data/game_companies.json";
import { companyPhotoFallback, openGraphImage } from "../src/lib/data/company-images";

test("every discovered company has a local credited photo fallback", () => {
  for (const company of companies) {
    const fallback = companyPhotoFallback(company);
    assert.ok(existsSync(path.join(process.cwd(), "public", fallback.image)));
    assert.ok(fallback.imageCredit.author);
    if (company.image) assert.ok(existsSync(path.join(process.cwd(), "public", company.image)));
  }
});

test("official social image metadata supports attribute order and relative URLs", () => {
  assert.equal(openGraphImage('<meta content="/photo.jpg?a=1&amp;b=2" property="og:image">', 'https://example.com/'), 'https://example.com/photo.jpg?a=1&b=2');
  assert.equal(openGraphImage("<meta name='twitter:image' content='https://cdn.example.com/image.jpg'>", 'https://example.com/'), 'https://cdn.example.com/image.jpg');
  assert.equal(openGraphImage('<meta property="og:image" content="javascript:alert(1)">', 'https://example.com/'), null);
});
