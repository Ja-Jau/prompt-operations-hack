"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dashboardSessionSecret } from "@/lib/dashboard/auth";
import { createDashboardSession, DASHBOARD_COOKIE, SESSION_SECONDS, validDashboardCredentials } from "@/lib/dashboard/session";

export async function loginDashboard(_previous: { error: string }, form: FormData): Promise<{ error: string }> {
  if (!validDashboardCredentials(form.get("username"), form.get("password"))) {
    return { error: "Incorrect username or password." };
  }
  (await cookies()).set(DASHBOARD_COOKIE, createDashboardSession(dashboardSessionSecret()), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_SECONDS,
  });
  redirect("/velho");
}

export async function logoutDashboard() {
  (await cookies()).delete(DASHBOARD_COOKIE);
  redirect("/velho/login");
}
