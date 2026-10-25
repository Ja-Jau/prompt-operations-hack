import { NextResponse } from "next/server";
import { isDashboardAuthenticated } from "@/lib/dashboard/auth";
import { invitationResponseSnapshot, readInvitations } from "@/lib/outreach/invitations";

export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  if (!(await isDashboardAuthenticated())) return NextResponse.json({ error: "Your session expired. Sign in again." }, { status: 401, headers });
  try {
    return NextResponse.json(invitationResponseSnapshot(await readInvitations()), { headers });
  } catch {
    return NextResponse.json({ error: "Could not load saved responses. Please try again." }, { status: 500, headers });
  }
}
