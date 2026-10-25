import credits from "../../../public/images/credits.json";
import type { GameCompany } from "@/types/company";

const industries = Object.keys(credits.industries);

/** Every identity has a local, credited photograph even when remote sites fail. */
export function companyPhotoFallback(company: Pick<GameCompany, "industry">) {
  const slug = company.industry.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const industry = industries.includes(slug) ? slug : "industrial";
  return {
    image: `/images/industry/${industry}.jpg`,
    imageCredit: credits.industries[industry as keyof typeof credits.industries],
  };
}

export function openGraphImage(html: string, homepage: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attributes.set(match[1].toLowerCase(), (match[2] ?? match[3]).replace(/&amp;/g, "&"));
    }
    const kind = attributes.get("property") ?? attributes.get("name");
    if (kind !== "og:image" && kind !== "twitter:image") continue;
    const content = attributes.get("content");
    if (!content) continue;
    try {
      const url = new URL(content, homepage);
      if (url.protocol === "https:" && !url.username && !url.password) return url.href;
    } catch { /* Ignore malformed social metadata. */ }
  }
  return null;
}
