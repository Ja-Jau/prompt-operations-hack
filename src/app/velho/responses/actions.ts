"use server";

import { revalidatePath } from "next/cache";
import { requireDashboardLogin } from "@/lib/dashboard/auth";
import { getDashboardCompanies } from "@/lib/dashboard/job-ads";
import { findInvitation, newInvitation, saveInvitation } from "@/lib/outreach/invitations";

export async function prepareInvitation(companyId: string) {
  await requireDashboardLogin();
  const company = (await getDashboardCompanies()).companies.find((entry) => entry.id === companyId);
  if (!company) throw new Error("Company not found.");
  const invitation = newInvitation(company.id, company.name);
  await saveInvitation(invitation);
  return invitation.token;
}

/** Saves a demo event only; no mail transport or delivery integration. */
export async function sendDemoInvitation(token: string, to: string, subject: string) {
  await requireDashboardLogin();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 300 || !subject.trim() || subject.length > 300) throw new Error("Enter a valid recipient and subject.");
  const invitation = await findInvitation(token);
  if (!invitation) throw new Error("Invitation not found. Regenerate the draft.");
  if (!invitation.sentAt) await saveInvitation({ ...invitation, to, subject, sentAt: new Date().toISOString() });
  revalidatePath("/velho/responses");
}
