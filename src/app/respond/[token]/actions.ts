"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyResponse, findInvitation, saveInvitation } from "@/lib/outreach/invitations";

export async function recordResponse(form: FormData) {
  const token = String(form.get("token") ?? "");
  const choice = form.get("choice");
  if (choice !== "interested" && choice !== "declined") throw new Error("Choose a response.");
  const invitation = await findInvitation(token);
  if (!invitation) throw new Error("Invitation not found.");
  await saveInvitation(applyResponse(invitation, choice));
  revalidatePath("/velho/responses");
  redirect(`/respond/${token}?saved=1`);
}
