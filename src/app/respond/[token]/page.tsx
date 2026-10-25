import Link from "next/link";
import { notFound } from "next/navigation";
import { findInvitation } from "@/lib/outreach/invitations";
import { recordResponse } from "./actions";
import "@/components/dashboard/marketing.css";

export const metadata = { title: "Your invitation | Velho", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";
export default async function InvitationResponse({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ choice?: string; saved?: string }> }) {
  const { token } = await params;
  const invitation = await findInvitation(token);
  if (!invitation) notFound();
  const query = await searchParams;
  const saved = query.saved === "1" && invitation.response;
  return <main className="marketing-login"><section className="marketing-login-card invitation-card">
    <Link className="marketing-login-brand" href="/">Velho<span>Play. Discover. Improve.</span></Link>
    <h1>{saved ? "Thank you" : `Hello, ${invitation.companyName}`}</h1>
    <p>{saved ? invitation.response === "interested" ? "Your interest is recorded. The Velho team can follow up using the invitation’s email address." : "Your preference is recorded: no service follow-up for this invitation." : "Play Firmle and discover where smarter processes could free up your team’s time. Velho helps turn those ideas into improvements at your company."}</p>
    <a className="btn btn-dark" href="/" target="_blank" rel="noreferrer">Play the Velho game ↗</a>
    {!invitation.sentAt ? <p>Draft preview. Use “Send demo” in the dashboard to enable responses. No email will be delivered.</p> : <form action={recordResponse} className="invitation-actions">
      <input type="hidden" name="token" value={token} />
      <p>{saved ? "You can update your preference below." : "Would you like to explore improvements with Velho?"}</p>
      <button className="btn btn-dark" name="choice" value="interested" autoFocus={!saved && query.choice === "interested"}>Yes, contact me</button>
      <button className="btn btn-outline" name="choice" value="declined" autoFocus={!saved && query.choice === "declined"}>No thanks</button>
    </form>}
    <p className="marketing-send-explanation">Demo invitation · no emails are sent automatically.</p>
  </section></main>;
}
