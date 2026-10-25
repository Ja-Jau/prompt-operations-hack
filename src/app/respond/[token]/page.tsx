import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { findInvitation } from "@/lib/outreach/invitations";
import { InvitationClick } from "@/components/dashboard/InvitationClick";
import "@/components/dashboard/marketing.css";

export const metadata = { title: "Your invitation | Velho", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";
export default async function InvitationResponse({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ choice?: string; saved?: string }> }) {
  const { token } = await params;
  const invitation = await findInvitation(token);
  if (!invitation) notFound();
  const query = await searchParams;
  const saved = query.saved === "1" && Boolean(invitation.response);
  const choice = saved ? invitation.response : query.choice;
  const kind = choice === "interested" ? "contact" : choice === "declined" ? "declined" : "game";
  const cards = {
    contact: {
      icon: "quote" as const, eyebrow: "Let’s talk",
      title: saved ? "You’re on the list." : "Make room for better work.",
      description: saved ? `Your interest is recorded for ${invitation.companyName}. Velho can follow up at ${invitation.to}.` : `Explore where Velho could help ${invitation.companyName} save time, streamline processes and reduce repetitive work.`,
    },
    declined: {
      icon: "check" as const, eyebrow: "Your choice",
      title: saved ? "Thanks for letting us know." : "Not the right time?",
      description: saved ? "Your preference is saved. This invitation is marked as not interested." : "No problem. We’ll let the Velho team know you’re not interested in discussing the service.",
    },
    game: {
      icon: "play" as const, eyebrow: "The Velho game",
      title: "Spot the work worth changing.",
      description: `Which company is hiring for routine work? Play Firmle, follow the clues and discover ideas that could help ${invitation.companyName} work smarter.`,
    },
  };
  const card = cards[kind];
  return <main className="marketing-login"><section className={`invitation-landing invitation-minimal is-${kind}`}>
    <Link className="marketing-login-brand" href="/">Velho<span>Play. Discover. Improve.</span></Link>
    <p className="invitation-eyebrow">{card.eyebrow}</p>
    <h1>{card.title}</h1>
    <p className="invitation-description">{card.description}</p>
    <InvitationClick key={`${token}-${kind}`} token={token} choice={kind === "contact" ? "interested" : kind === "declined" ? "declined" : "game"} />
    {kind === "game" ? <>
      <Link className="btn btn-dark invitation-primary" href="/">Play Firmle<Icon name="arrowRight" /></Link>
      <Link className="invitation-secondary" prefetch={false} href={`/respond/${token}?choice=interested`}>Contact Velho ↗</Link>
    </> : <>
      {!invitation.sentAt && <p className="invitation-draft-notice">Demo preview. Button clicks are recorded on the Responses page. No email is delivered.</p>}
      {kind === "contact" && <a className="btn btn-dark invitation-primary" href="https://velho.io/" target="_blank" rel="noreferrer">Explore Velho<Icon name="arrowRight" /></a>}
      <Link className="invitation-secondary" prefetch={false} href={`/respond/${token}?choice=${kind === "contact" ? "declined" : "interested"}`}>{kind === "contact" ? "No thanks, change my preference" : "Actually, contact Velho"}</Link>
    </>}
    <p className="marketing-send-explanation invitation-demo-note">Demo invitation · no emails are sent automatically.</p>
  </section></main>;
}
