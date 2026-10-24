import { NextResponse } from "next/server";
import { getCompanies } from "@/lib/data/companies";

/** Company data as JSON. The place to plug in live stats sources later. */
export async function GET() {
  return NextResponse.json(await getCompanies());
}
