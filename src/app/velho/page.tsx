import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getHiringCompanies } from "@/lib/data/companies";
import { dailyCase } from "@/lib/case/cases";
import { readLeads } from "@/lib/leads";
import { buildSignals, draftOpener, linkedInPost } from "@/lib/signals";
import { CompanyLogo } from "@/components/game/CompanyLogo";
import { CopyButton } from "@/components/ui/CopyButton";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Signals | Velho" };
// Leads change while the app runs, so never serve a cached copy.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ key?: string }> };

/**
 * Velho's side of the game: companies hiring people for work software could do, strongest
 * signal first, each with a brief and a draft opener; plus the game's leads and today's post.
 * Set DASHBOARD_KEY to require /velho?key=… outside local development.
 */
export default async function VelhoDashboard({ searchParams }: Props) {
  const requiredKey = process.env.DASHBOARD_KEY;
  const key = (await searchParams).key;
  const keyQuery = key ? `?key=${encodeURIComponent(key)}` : "";
  if (requiredKey && key !== requiredKey) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-cream px-4">
        <p className="card p-8 text-ink-2">This page is for the Velho team. Add the access key to the link.</p>
      </main>
    );
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const companies = await getHiringCompanies();
  const signals = buildSignals(companies);
  const leads = await readLeads();
  const today = dailyCase(companies);
  const post = today ? linkedInPost(today, origin) : "";
  const roles = signals.reduce((sum, s) => sum + s.manual, 0);
  const byId = new Map(companies.map((c) => [c.id, c.name]));

  return (
    <div className="min-h-dvh bg-cream">
      <header className="bg-navy text-ivory">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-semibold tracking-tight">Velho</span>
            <span className="eyebrow text-on-dark-2">Signals from Finnish job ads</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href={`/outreach${keyQuery}`} className="btn btn-line-dark btn-sm">
              Outreach desk
            </Link>
            <Link href="/" className="btn btn-line-dark btn-sm">
              Open the game <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <p className="eyebrow text-sage-d">This week</p>
        <h1 className="mt-3 text-[clamp(32px,4.4vw,52px)] leading-none tracking-[-0.04em]">
          Who to talk to, and why now
        </h1>

        <dl className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Companies hiring for routine work", value: signals.length },
            { label: "Open roles software could help with", value: roles },
            { label: "Leads from the game", value: leads.length },
          ].map((stat) => (
            <div key={stat.label} className="card p-5">
              <dd className="text-4xl font-semibold tracking-[-0.03em]">{stat.value}</dd>
              <dt className="eyebrow mt-2 text-ink-3">{stat.label}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_340px]">
          {/* Ranked signals */}
          <section>
            <p className="eyebrow mb-4 text-sage-d">Strongest signals first</p>
            <ol className="flex flex-col gap-3">
              {signals.map((s, i) => {
                const briefUrl = `${origin}/brief/${s.company.id}`;
                return (
                  <li key={s.company.id} className="card p-5">
                    <div className="flex items-start gap-4">
                      <span className="pt-1 font-mono text-[13px] text-clay">{String(i + 1).padStart(2, "0")}</span>
                      <CompanyLogo company={s.company} className="h-11 w-11" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h2 className="text-xl tracking-tight">{s.company.name}</h2>
                          <span className="font-mono text-sm text-ink-2">
                            {s.manual} of {s.checked} roles · {Math.round(s.share)}%
                          </span>
                        </div>
                        <p className="eyebrow mt-1 text-ink-3">
                          {s.company.functions.join(" · ")} · {s.company.locations.slice(0, 3).join(", ")}
                        </p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand">
                          <div className="h-full bg-navy-3" style={{ width: `${Math.round(s.share)}%` }} />
                        </div>
                        <p className="mt-4 text-[15px] leading-snug">“{s.topQuote.quote}”</p>
                        <p className="eyebrow mt-1.5 text-ink-3">{s.topQuote.title}</p>
                        {s.firstFix && (
                          <p className="mt-3 text-sm text-ink-2">
                            <span className="eyebrow mr-2 text-sage-d">Start with</span>
                            {s.firstFix}
                            {s.service && <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-xs">{s.service.title}</span>}
                          </p>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={`/brief/${s.company.id}`} className="btn btn-dark btn-sm">
                            Open brief <Icon name="arrowRight" className="h-3.5 w-3.5" />
                          </Link>
                          <CopyButton text={draftOpener(s, briefUrl)} label="Copy draft opener" />
                          <CopyButton text={briefUrl} label="Copy brief link" />
                          {s.topQuote.url && (
                            <a href={s.topQuote.url} target="_blank" rel="noreferrer" className="btn btn-line btn-sm">
                              Source ad
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <aside className="flex flex-col gap-8">
            {/* Leads */}
            <section>
              <p className="eyebrow mb-4 text-sage-d">Leads from the game</p>
              {leads.length === 0 ? (
                <p className="card p-5 text-sm text-ink-3">No leads yet. They appear here when players ask for the analysis.</p>
              ) : (
                <ul className="card divide-y divide-sand-2">
                  {leads.slice(0, 20).map((lead) => (
                    <li key={lead.id} className="p-4 text-sm">
                      <p className="font-semibold">
                        {lead.name} · {lead.company}
                      </p>
                      <p className="text-ink-2">{lead.email}</p>
                      <p className="eyebrow mt-1 text-[10px] text-ink-3">
                        {new Date(lead.createdAt).toLocaleString("en-GB")} · {lead.source}
                        {lead.contextCompanyId && ` · viewing ${byId.get(lead.contextCompanyId) ?? lead.contextCompanyId}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Stay top of mind */}
            {post && (
              <section>
                <p className="eyebrow mb-4 text-sage-d">Today&apos;s post</p>
                <div className="card p-5">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">{post}</pre>
                  <div className="mt-4">
                    <CopyButton text={post} label="Copy for LinkedIn" className="btn btn-dark btn-sm" />
                  </div>
                  <p className="mt-3 text-xs text-ink-3">Review before posting. Nothing is published automatically.</p>
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
