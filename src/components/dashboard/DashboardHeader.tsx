import Link from "next/link";
import { logoutDashboard } from "@/app/velho/login/actions";
import { Icon } from "@/components/ui/Icon";

export function DashboardHeader({ active }: { active: "opportunities" | "responses" }) {
  return <header className="marketing-topbar"><div>
    <Link href="/velho" className="marketing-wordmark">Velho<span>Marketing</span></Link>
    <nav aria-label="Dashboard navigation" className="dashboard-navigation">
      <Link href="/velho" aria-current={active === "opportunities" ? "page" : undefined}><Icon name="target" />Opportunities</Link>
      <Link href="/velho/responses" aria-current={active === "responses" ? "page" : undefined}><Icon name="quote" />Responses</Link>
      <Link href="/" className="dashboard-game-link"><Icon name="play" />Firmle<Icon name="arrowRight" /></Link>
      <form action={logoutDashboard}><button className="dashboard-signout">Sign out<Icon name="arrowRight" /></button></form>
    </nav>
  </div></header>;
}
