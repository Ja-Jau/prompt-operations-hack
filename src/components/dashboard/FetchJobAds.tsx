"use client";

import { useActionState } from "react";
import { fetchJobAds } from "@/app/velho/job-actions";
import { Icon } from "@/components/ui/Icon";

export function FetchJobAds({ updatedAt }: { updatedAt: string }) {
  const [state, action, pending] = useActionState(fetchJobAds, { message: "", ok: false });
  return <div className="dashboard-fetch">
    <form action={action}><div><strong>Job-ad database</strong><span>{pending ? "Reading current ads · this can take a few minutes" : updatedAt ? `Updated ${new Date(updatedAt).toLocaleString("en-GB", { timeZone: "Europe/Helsinki", dateStyle: "short", timeStyle: "short" })}` : "Fetch current ads to find new opportunities"}</span></div>
      <button disabled={pending} type="submit"><Icon name={pending ? "clock" : "search"} />{pending ? "Fetching job ads…" : "Fetch job ads"}</button>
    </form>
    {state.message && !pending && <p role="status" className={state.ok ? "is-success" : "is-error"}>{state.message}</p>}
  </div>;
}
