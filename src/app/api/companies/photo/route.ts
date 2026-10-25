import { NextResponse } from "next/server";
import companies from "@/data/game_companies.json";
import { companyPhotoFallback, openGraphImage } from "@/lib/data/company-images";

const catalog = new Map(companies.map((company) => [company.id, company]));
const pending = new Map<string, Promise<string | null>>();
const cache = new Map<string, { image: string | null; expires: number }>();

async function discoverPhoto(domain: string): Promise<string | null> {
  if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(domain)) return null;
  let url = `https://${domain}/`;
  for (let redirect = 0; redirect < 3; redirect++) {
    const response = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) return null;
      const target = new URL(location, url);
      if (target.protocol !== "https:" || ![domain, `www.${domain}`, domain.replace(/^www\./, "")].includes(target.hostname)) return null;
      url = target.href;
      continue;
    }
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
      await response.body?.cancel();
      return null;
    }
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (size < 1_000_000) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
      }
    } finally {
      await reader.cancel();
    }
    return openGraphImage(Buffer.concat(chunks).toString("utf8"), url);
  }
  return null;
}

export async function GET(request: Request) {
  const company = catalog.get(new URL(request.url).searchParams.get("id") ?? "");
  if (!company) return NextResponse.json({ error: "Unknown company" }, { status: 404 });
  const fallback = company.image ? { image: company.image, imageCredit: company.imageCredit } : companyPhotoFallback(company);
  let image: string | null = null;
  if (company.domain) {
    const stored = cache.get(company.id);
    if (stored && stored.expires > Date.now()) image = stored.image;
    else {
      let task = pending.get(company.id);
      if (!task && pending.size < 6) {
        task = discoverPhoto(company.domain).catch(() => null);
        pending.set(company.id, task);
      }
      if (task) {
        image = await task;
        cache.set(company.id, { image, expires: Date.now() + (image ? 86_400_000 : 300_000) });
        pending.delete(company.id);
      }
    }
  }
  return NextResponse.json(image ? {
    image, kind: "company", imageCredit: {
      author: company.name, url: `https://${company.domain}/`, source: "Company website", license: null,
    },
  } : { ...fallback, kind: "industry" }, { headers: { "Cache-Control": "public, max-age=300" } });
}
