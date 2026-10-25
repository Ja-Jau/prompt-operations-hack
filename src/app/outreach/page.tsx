import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getHiringCompanies } from "@/lib/data/companies";
import { contactSheet } from "@/lib/outreach/contacts";
import { draftEmail } from "@/lib/outreach/email";
import { readOutreachLog } from "@/lib/outreach/log";
import { findTargets } from "@/lib/outreach/targets";
import { Icon } from "@/components/ui/Icon";
import { requireDashboardLogin } from "@/lib/dashboard/auth";
import { OutreachBoard, type Prospect } from "@/components/outreach/OutreachBoard";

export const metadata: Metadata = { title: "Outreach | Velho" };
// The demo log changes while the app runs, so never serve a cached copy.
export const dynamic = "force-dynamic";

/** How many targets the board shows. The rest are counted but not drafted. */
const SHORTLIST = 24;

/**
 * Velho's outreach desk: find the companies hiring for routine work, compile what their ads say,
 * work out who to write to, and draft a proposal to try the game. The Send button is a demo and
 * records what would have gone out; see src/app/api/outreach/route.ts.
 */
export default async function OutreachPage() {
  await requireDashboardLogin();

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const companies = await getHiringCompanies();
  const targets = findTargets(companies);
  const log = await readOutreachLog();

  const prospects: Prospect[] = targets.slice(0, SHORTLIST).map((target) => {
    const sheet = contactSheet(target.company);
    const email = draftEmail(target, sheet, { game: origin, brief: `${origin}/brief/${target.company.id}` });
    const { id, name, logo, domain, brandColor, locations, functions, jobAds } = target.company;
    return {
      company: { id, name, logo, domain, brandColor },
      score: target.score,
      tier: target.tier,
      reasons: target.reasons,
      staffing: target.staffing,
      firstFix: target.firstFix,
      serviceArea: target.serviceArea,
      isCase: target.isCase,
      locations,
      functions,
      ads: jobAds.ads,
      checked: jobAds.checked,
      manual: jobAds.manual,
      sheet,
      email,
      briefPath: `/brief/${id}`,
    };
  });

  return (
    <div className="min-h-dvh bg-cream">
      <header className="bg-navy text-ivory">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-semibold tracking-tight">Velho</span>
            <span className="eyebrow hidden text-on-dark-2 sm:inline">Outreach desk</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/velho" className="btn btn-line-dark btn-sm">
              Signals
            </Link>
            <Link href="/" className="btn btn-line-dark btn-sm">
              Open the game <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <OutreachBoard prospects={prospects} totalTargets={targets.length} totalCompanies={companies.length} initialLog={log} />
    </div>
  );
}
