import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { requireDashboardLogin } from "@/lib/dashboard/auth";
import { readInvitations, responseCounts } from "@/lib/outreach/invitations";
import { ResponsesDashboard } from "@/components/dashboard/ResponsesDashboard";
import "@/components/dashboard/marketing.css";

export const metadata = { title: "Company responses | Velho" };
export const dynamic = "force-dynamic";
export default async function ResponsesPage() {
  await requireDashboardLogin();
  const invitations = await readInvitations();
  const sent = invitations.filter((invitation) => invitation.sentAt).sort((a, b) => b.sentAt!.localeCompare(a.sentAt!));
  return <div className="marketing-page min-h-dvh bg-cream">
    <DashboardHeader active="responses" />
    <ResponsesDashboard counts={responseCounts(sent)} rows={sent.map((invitation) => ({ id: invitation.token, company: invitation.companyName, to: invitation.to, sentAt: invitation.sentAt!, respondedAt: invitation.respondedAt, status: invitation.response ?? "pending" }))} />
  </div>;
}
