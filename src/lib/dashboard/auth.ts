import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DASHBOARD_COOKIE, validDashboardSession } from "./session";

/** Stable demo default; set DASHBOARD_SESSION_SECRET to supply a deployment-specific signing key. */
export function dashboardSessionSecret() {
  return process.env.DASHBOARD_SESSION_SECRET ?? process.env.DASHBOARD_KEY ?? "velho-hackathon-demo-session";
}

export async function isDashboardAuthenticated() {
  return validDashboardSession((await cookies()).get(DASHBOARD_COOKIE)?.value, dashboardSessionSecret());
}

export async function requireDashboardLogin() {
  if (!(await isDashboardAuthenticated())) redirect("/velho/login");
}
