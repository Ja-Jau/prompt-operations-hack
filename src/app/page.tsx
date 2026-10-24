import { AppShell } from "@/components/layout/AppShell";
import { getCompanies, getExampleCompanies } from "@/lib/data/companies";

export default async function Home() {
  const companies = await getCompanies();
  const exampleCompanies = await getExampleCompanies();

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <AppShell companies={companies} exampleCompanies={exampleCompanies} />
    </main>
  );
}
