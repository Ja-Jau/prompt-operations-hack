"use client";

import { useActionState } from "react";
import { fetchJobAds } from "@/app/velho/job-actions";
import { Icon } from "@/components/ui/Icon";

export function FetchJobAds({ updatedAt, automatic = false, lastError = null }: { updatedAt: string; automatic?: boolean; lastError?: string | null }) {
  const [state, action, pending] = useActionState(fetchJobAds, { message: "", ok: false });
  const updated = updatedAt ? `Updated ${new Date(updatedAt).toLocaleString("en-GB", { timeZone: "Europe/Helsinki", dateStyle: "short", timeStyle: "short" })}` : "Waiting for the first update";
  const idleMessage = automatic ? updated : "Connect Supabase to load saved ads";
  return <div className="dashboard-fetch">
    <form action={action}>
      <button disabled={pending} type="submit"><Icon name={pending ? "clock" : "search"} />{pending ? "Fetching…" : "Fetch job ads"}</button>
      <span>{pending ? "Loading saved ads…" : idleMessage}</span>
    </form>
    {automatic && <p>New ads are collected hourly. Fetch job ads loads the latest saved ads.</p>}
    {lastError && <p role="status" className="is-error">The last background refresh failed. Previously saved ads are still shown; another attempt runs next hour.</p>}
    {state.message && !pending && <p role="status" className={state.ok ? "is-success" : "is-error"}>{state.message}</p>}
  </div>;
}
