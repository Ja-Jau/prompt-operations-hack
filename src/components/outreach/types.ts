import type { JobAd } from "@/types/company";
import type { ContactSheet } from "@/lib/outreach/contacts";
import type { EmailDraft } from "@/lib/outreach/email";
import type { Tier } from "@/lib/outreach/targets";

/** One company on the outreach board, with everything the four pipeline steps produced. */
export type Prospect = {
  company: { id: string; name: string; logo: string | null; domain: string | null; brandColor: string };
  score: number;
  tier: Tier;
  reasons: string[];
  staffing: boolean;
  firstFix: string | null;
  serviceArea: string | null;
  isCase: boolean;
  locations: string[];
  functions: string[];
  ads: JobAd[];
  checked: number;
  manual: number;
  sheet: ContactSheet;
  email: EmailDraft;
  briefPath: string;
};

/** Where one row is in the (simulated) send batch. */
export type SendState = "idle" | "queued" | "sending" | "simulated" | "error";
