import { Game } from "@/components/game/Game";
import { getCompanies } from "@/lib/data/companies";

export default async function Home() {
  const companies = await getCompanies();
  const unverifiedCount = companies.filter((c) => !c.verified).length;

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <Game companies={companies} unverifiedCount={unverifiedCount} />
    </main>
  );
}
