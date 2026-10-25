"use client";

import { useActionState } from "react";
import { fetchJobAds } from "@/app/velho/job-actions";
import { Icon } from "@/components/ui/Icon";

export function FetchJobAds({ updatedAt, automatic = false, lastError = null }: { updatedAt: string; automatic?: boolean; lastError?: string | null }) {
  const [state, action, pending] = useActionState(fetchJobAds, { message: "", ok: false });
  const updated = updatedAt ? `Updated ${new Date(updatedAt).toLocaleString("en-GB", { timeZone: "Europe/Helsinki", dateStyle: "short", timeStyle: "short" })}` : "Waiting for the first update";
  if (automatic) return <div className="dashboard-fetch">
    <p><Icon name="clock" /> Ads refresh automatically every hour · {updated}</p>
    {lastError && <p role="status" className="is-error">The last refresh failed. Previously saved ads are still shown; another attempt runs next hour.</p>}
  </div>;
  return <div className="dashboard-fetch">
    <form action={action}>
      <button disabled={pending} type="submit"><Icon name={pending ? "clock" : "search"} />{pending ? "Fetching…" : "Fetch job ads"}</button>
      <span>{pending ? "Reading up to 10 ads…" : updatedAt ? `Updated ${new Date(updatedAt).toLocaleString("en-GB", { timeZone: "Europe/Helsinki", dateStyle: "short", timeStyle: "short" })}` : "Up to 10 ads per fetch"}</span>
    </form>
    {state.message && !pending && <p role="status" className={state.ok ? "is-success" : "is-error"}>{state.message}</p>}
  </div>;
}
