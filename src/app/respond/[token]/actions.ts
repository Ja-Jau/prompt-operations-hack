"use server";

import { revalidatePath } from "next/cache";
import { applyInvitationClick, findInvitation, saveInvitation } from "@/lib/outreach/invitations";

/** Public invitation tokens identify the recipient; dashboard credentials are not required. */
export async function recordInvitationClick(token: string, choice: "interested" | "declined" | "game") {
  if (choice !== "interested" && choice !== "declined" && choice !== "game") return { ok: false, message: "Invalid response." };
  try {
    const invitation = await findInvitation(token);
    if (!invitation) return { ok: false, message: "Invitation not found." };
    const updated = applyInvitationClick(invitation, choice);
    await saveInvitation(updated);
    revalidatePath("/velho/responses");
    return { ok: true, message: choice === "game" ? "Game visit recorded." : choice === "interested" ? "Your interest is saved and visible on the Responses page." : "Your preference is saved. This invitation is marked as not interested." };
  } catch {
    return { ok: false, message: "Could not save your response. Please try again." };
  }
}
