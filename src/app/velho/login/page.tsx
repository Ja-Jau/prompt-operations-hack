import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isDashboardAuthenticated } from "@/lib/dashboard/auth";
import { LoginForm } from "@/components/dashboard/LoginForm";
import "@/components/dashboard/marketing.css";

export const metadata: Metadata = { title: "Sign in | Velho" };

export default async function DashboardLogin() {
  if (await isDashboardAuthenticated()) redirect("/velho");
  return <main className="marketing-login">
    <section className="marketing-login-card"><Link href="/" className="marketing-login-brand">Velho<span>Marketing</span></Link><h1>Welcome back.</h1><p>Sign in to your dashboard.</p><LoginForm /></section>
    <Link href="/" className="marketing-login-back">Back to Firmle</Link>
  </main>;
}
