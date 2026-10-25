"use client";

import { useActionState } from "react";
import { fetchJobAds } from "@/app/velho/job-actions";
import { Icon } from "@/components/ui/Icon";

export function FetchJobAds({ updatedAt }: { updatedAt: string }) {
  const [state, action, pending] = useActionState(fetchJobAds, { message: "", ok: false });
  return <div className="dashboard-fetch">
    <form action={action}>
      <button disabled={pending} type="submit"><Icon name={pending ? "clock" : "search"} />{pending ? "Fetching…" : "Fetch job ads"}</button>
      <span>{pending ? "Reading up to 10 ads…" : updatedAt ? `Updated ${new Date(updatedAt).toLocaleString("en-GB", { timeZone: "Europe/Helsinki", dateStyle: "short", timeStyle: "short" })}` : "Up to 10 ads per fetch"}</span>
    </form>
    {state.message && !pending && <p role="status" className={state.ok ? "is-success" : "is-error"}>{state.message}</p>}
  </div>;
}
