import { AppShell } from "@/components/layout/AppShell";
import { getCompanies, getHiringCompanies } from "@/lib/data/companies";

export default async function Home() {
  const companies = await getCompanies();
  const hiring = await getHiringCompanies();

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <AppShell companies={companies} hiring={hiring} />
    </main>
  );
}
