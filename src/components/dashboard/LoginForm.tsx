"use client";

import { useActionState } from "react";
import { loginDashboard } from "@/app/velho/login/actions";
import { Icon } from "@/components/ui/Icon";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginDashboard, { error: "" });
  return <form action={action} className="marketing-login-form">
    <label>Username<input name="username" autoComplete="username" required autoFocus aria-describedby={state.error ? "login-error" : undefined} /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required aria-describedby={state.error ? "login-error" : undefined} /></label>
    {state.error && <p id="login-error" role="alert">{state.error}</p>}
    <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}<Icon name="arrowRight" /></button>
  </form>;
}
