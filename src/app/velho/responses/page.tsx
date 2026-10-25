import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { requireDashboardLogin } from "@/lib/dashboard/auth";
import { readInvitations, invitationResponseSnapshot } from "@/lib/outreach/invitations";
import { ResponsesDashboard } from "@/components/dashboard/ResponsesDashboard";
import "@/components/dashboard/marketing.css";

export const metadata = { title: "Company responses | Velho" };
export const dynamic = "force-dynamic";
export default async function ResponsesPage() {
  await requireDashboardLogin();
  const snapshot = invitationResponseSnapshot(await readInvitations());
  return <div className="marketing-page min-h-dvh bg-cream">
    <DashboardHeader active="responses" />
    <ResponsesDashboard {...snapshot} />
  </div>;
}
