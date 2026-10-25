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
