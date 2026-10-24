import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSignalCompanies } from "@/lib/data/companies";
import { firstFix, serviceFor } from "@/lib/signals";
import { VELHO_URL } from "@/lib/velho";
import { CompanyLogo } from "@/components/game/CompanyLogo";
import { LeadForm } from "@/components/leads/LeadForm";
import { Icon } from "@/components/ui/Icon";
import { PrintButton } from "@/components/ui/PrintButton";

type Params = { params: Promise<{ id: string }> };

async function findCompany(id: string) {
  const { companies, isExample } = await getSignalCompanies();
  return { company: companies.find((c) => c.id === id), isExample };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { company } = await findCompany((await params).id);
  return { title: company ? `${company.name}: where time goes | Velho` : "Brief | Velho" };
}

/** A one-page note for one company's CEO, built only from its own public job ads. */
export default async function BriefPage({ params }: Params) {
  const { company, isExample } = await findCompany((await params).id);
  if (!company?.jobAds) notFound();

  const { manual, checked, ads, fetchedAt } = company.jobAds;
  const take = company.velhoCase;
  const fix = firstFix(company);
  const service = serviceFor(company);

  return (
    <div className="min-h-dvh overflow-y-auto bg-cream print:bg-white">
      <header className="bg-navy text-ivory print:bg-white print:text-ink">
        <div className="mx-auto flex max-w-[820px] items-center justify-between px-5 py-4">
          <span className="text-lg font-semibold tracking-tight">Velho</span>
          <span className="eyebrow text-on-dark-2 print:text-ink-3">Prepared for {company.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-5 py-10 md:py-14">
        {isExample && (
          <p className="mb-6 rounded-[9px] border border-clay/30 bg-white px-4 py-2 text-sm text-ink-2">
            <span className="eyebrow mr-2 text-clay">Example</span>A made-up company, to show the format.
          </p>
        )}

        <div className="flex items-center gap-4">
          <CompanyLogo company={company} className="h-14 w-14" />
          <p className="eyebrow text-sage-d">
            {company.name} · From your open job ads, {fetchedAt}
          </p>
        </div>
        <h1 className="mt-6 text-[clamp(32px,5vw,54px)] leading-[1.02] tracking-[-0.04em]">
          {manual} of your {checked} open roles include work software could do.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-2">
          That is time people spend moving information between systems instead of on growth. Here is what your own ads
          say, and where Velho would start.
        </p>

        <section className="mt-10">
          <p className="eyebrow text-sage-d">In your own words</p>
          <ol className="mt-4 border-b border-sand-2">
            {ads.slice(0, 4).map((ad, i) => (
              <li key={ad.url + ad.quote} className="grid grid-cols-[40px_1fr] border-t border-sand-2 py-4">
                <span className="pt-0.5 font-mono text-[13px] text-clay">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="text-[17px] leading-snug">“{ad.quote}”</p>
                  <p className="eyebrow mt-1.5 text-ink-3">{ad.title}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {take && fix && (
          <section className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="card p-6">
              <p className="eyebrow text-sage-d">Where we would start</p>
              <h2 className="mt-3 text-2xl tracking-tight">{fix}</h2>
              <p className="mt-3 text-ink-2">{take.fixReasoning}</p>
            </div>
            <div className="card p-6">
              <p className="eyebrow text-sage-d">How it sticks</p>
              <p className="mt-3 text-ink">{take.adoptNote}</p>
              {service && (
                <dl className="mt-5 space-y-2 border-t border-sand-2 pt-4 text-sm">
                  <p className="eyebrow text-ink-3">{service.title}, a typical result</p>
                  <div className="flex gap-3">
                    <dt className="eyebrow w-12 shrink-0 pt-0.5 text-[10px] text-clay">Before</dt>
                    <dd className="text-ink-2">{service.before}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="eyebrow w-12 shrink-0 pt-0.5 text-[10px] text-sage-d">After</dt>
                    <dd>{service.after}</dd>
                  </div>
                </dl>
              )}
            </div>
          </section>
        )}

        <section className="mt-10 rounded-[14px] bg-navy p-7 text-ivory md:p-9 print:border print:border-sand-2 print:bg-white print:text-ink">
          <p className="eyebrow text-sky print:text-sage-d">Next step</p>
          <h2 className="mt-3 text-[clamp(24px,3vw,34px)] tracking-[-0.03em]">Let&apos;s find the first opportunity.</h2>
          <p className="mt-3 max-w-lg text-on-dark print:text-ink-2">
            In 30 minutes we map where work gets stuck at {company.name} and what a useful first improvement could be.
          </p>
          <div className="mt-6 print:hidden">
            <LeadForm source="brief" contextCompanyId={company.id} cta="Book the 30 minutes" />
          </div>
          <p className="mt-4 hidden text-sm print:block">velho.io · hello@velho.io</p>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-ink-3">
          <span>
            Based only on public job ads. Quotes are verbatim; we did not contact {company.name} or its employees.
          </span>
          <span className="flex items-center gap-3 print:hidden">
            <PrintButton />
            <a href={VELHO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-navy-3 hover:text-ink">
              velho.io <Icon name="arrowRight" className="h-3 w-3" />
            </a>
            <Link href="/" className="text-navy-3 hover:text-ink">
              Play the game
            </Link>
          </span>
        </footer>
      </main>
    </div>
  );
}
