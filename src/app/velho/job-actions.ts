"use server";

import { revalidatePath } from "next/cache";
import { requireDashboardLogin } from "@/lib/dashboard/auth";
import { refreshDashboardJobs } from "@/lib/dashboard/job-ads";

export async function fetchJobAds() {
  await requireDashboardLogin();
  try {
    const result = await refreshDashboardJobs();
    revalidatePath("/velho");
    return { ok: true, message: `Loaded ${result.checked} ads from Supabase; ${result.flagged} flagged for review.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update job ads. Existing data was kept." };
  }
}
