import type { HiringCompany, JobAd } from "../../types/company";

export type RoleSolution = {
  role: string;
  area: string;
  action: string;
  reasoning: string;
  people: string;
  evidence: JobAd | null;
  basis: "reviewed" | "suggested";
};

type Pattern = { match: RegExp; area: string; action: string; reasoning: string; people: string };
const patterns: Pattern[] = [
  { match: /payroll|payslip|timesheet|time entries|time management|palkka/i, area: "Payroll workflows",
    action: "Connect time records to payroll and automate routine checks.",
    reasoning: "Collect approved time data once, prepare reconciliations and flag differences for review.",
    people: "Payroll specialists handle exceptions and compliance." },
  { match: /invoic|billing|receivable|payable|reskontr|lasku/i, area: "Billing and finance",
    action: "Connect billing data and automate routine invoice checks.",
    reasoning: "Carry validated data between systems, prepare matches and route approvals to the right person.",
    people: "Finance approves exceptions and payments." },
  { match: /crm|salesforce|follow.?up|customer records|customer information/i, area: "Customer follow-up",
    action: "Capture customer updates and prepare follow-ups automatically.",
    reasoning: "Use existing customer interactions to prepare system updates and follow-up drafts, instead of retyping them.",
    people: "The team reviews drafts and owns customer relationships." },
  { match: /schedul|dispatch|shift planning|appointment|resource planning/i, area: "Scheduling and dispatch",
    action: "Connect availability and automate routine scheduling.",
    reasoning: "A shared view of availability and clear booking rules can reduce calls, spreadsheets and duplicate coordination.",
    people: "Dispatchers resolve conflicts and unusual requests." },
  { match: /quotation|quotes?|orders?|enquir|pricing|tilausten|tarjou/i, area: "Quotes and order intake",
    action: "Turn incoming requests into validated quote or order drafts.",
    reasoning: "Capture request details once, apply agreed rules and send incomplete or unusual cases to a person.",
    people: "The team approves exceptions and customer commitments." },
  { match: /field report|site notes|site report|service report|inspection report|work report/i, area: "Field reporting",
    action: "Capture site notes once and prepare reports automatically.",
    reasoning: "Move job details from the field into reporting and billing without another round of manual entry.",
    people: "Field specialists verify the record and handle unusual jobs." },
  { match: /report|excel|spreadsheet|data entry|master data|reconcil|päivit|raport|syött/i, area: "Management reporting",
    action: "Connect source systems and automate routine data updates.",
    reasoning: "Bring approved data into one workflow, prepare recurring reports and flag changes instead of copying between files.",
    people: "The team interprets results and approves corrections." },
  { match: /robot|production line|machine vision|welding|quality inspection/i, area: "Physical automation",
    action: "Assess repetitive physical steps for robotics or automated checks.",
    reasoning: "Map the repeated operation and trial a suitable automation step, with clear checks before expanding it.",
    people: "Operators supervise quality, safety and exceptions." },
];

/** A proposed task-level fix from reviewed case notes, otherwise the ad's actual text. */
export function roleSolution(company: HiringCompany): RoleSolution {
  const evidence = company.jobAds.ads[0] ?? null;
  const role = evidence?.titleEn || evidence?.title || company.titlesEn[0] || company.titles[0] || "This role";
  const text = evidence ? `${evidence.quoteEn || ""} ${evidence.quote}` : "";
  const match = patterns.find((pattern) => pattern.match.test(text));
  const fallback = {
    area: "Workflow automation",
    action: "Map the repeated steps and automate validated handoffs.",
    reasoning: "Start with the routine tasks described in the ad, connect the relevant tools and trial one repeatable workflow.",
    people: "People retain judgment, approvals and exception handling.",
  };
  const suggestion = match ?? fallback;
  const reviewed = company.velhoCase;
  const fix = reviewed?.fixOptions[reviewed.correctIndex]?.trim();
  return {
    role, evidence, area: reviewed?.serviceArea || suggestion.area,
    action: fix || suggestion.action,
    reasoning: fix && reviewed?.fixReasoning ? reviewed.fixReasoning : suggestion.reasoning,
    people: suggestion.people,
    basis: fix ? "reviewed" : "suggested",
  };
}
