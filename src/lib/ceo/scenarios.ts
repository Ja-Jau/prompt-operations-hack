export type CeoChoice = {
  id: string;
  text: string;
  correct: boolean;
  explanation: string;
};

export type CeoScenario = {
  id: string;
  topic: string;
  title: string;
  situation: string;
  choices: [CeoChoice, CeoChoice, CeoChoice];
};

/** Fictional business situations written for the game, not claims about real companies. */
export const CEO_SCENARIOS: CeoScenario[] = [
  {
    id: "billing", topic: "Billing", title: "Sales doubled. Billing can’t keep up.",
    situation: "Every order is retyped into billing by hand.",
    choices: [
      { id: "hire", text: "Hire more billing staff.", correct: false, explanation: "More staff helps today, but every invoice still needs manual entry." },
      { id: "outsource", text: "Outsource the billing work.", correct: false, explanation: "Outsourcing moves the data entry; it doesn’t fix the workflow." },
      { id: "velho", text: "Have Velho connect orders to billing.", correct: true, explanation: "Connected systems handle routine invoices. Your team handles exceptions." },
    ],
  },
  {
    id: "reporting", topic: "Reporting", title: "Last week’s figures take three days to assemble.",
    situation: "Managers copy data from five systems into spreadsheets.",
    choices: [
      { id: "analyst", text: "Hire another reporting analyst.", correct: false, explanation: "The analyst inherits the copying. Your reports still arrive late." },
      { id: "meeting", text: "Push back the leadership meeting.", correct: false, explanation: "A later meeting gives you older information, not better reporting." },
      { id: "velho", text: "Have Velho connect the reporting data.", correct: true, explanation: "Automatic reporting frees the meeting for decisions, not data collection." },
    ],
  },
  {
    id: "quotes", topic: "Sales quotes", title: "Your sales team spends more time quoting than selling.",
    situation: "Standard quotes are rebuilt from scratch every time.",
    choices: [
      { id: "late", text: "Ask sales to work overtime.", correct: false, explanation: "Longer hours don’t reduce the work behind each quote." },
      { id: "assistant", text: "Hire an assistant for every salesperson.", correct: false, explanation: "Another handoff leaves the same repetitive task in place." },
      { id: "velho", text: "Have Velho automate standard quote drafts.", correct: true, explanation: "Pricing rules produce drafts. Sales reviews exceptions and talks to customers." },
    ],
  },
  {
    id: "scheduling", topic: "Scheduling", title: "One sick day breaks the entire schedule.",
    situation: "Your dispatcher juggles calls and three separate spreadsheets.",
    choices: [
      { id: "backup", text: "Hire a second dispatcher.", correct: false, explanation: "More calls won’t connect the scattered schedules and availability data." },
      { id: "chat", text: "Start another urgent group chat.", correct: false, explanation: "Another channel adds noise without a reliable shared schedule." },
      { id: "velho", text: "Have Velho connect scheduling and availability.", correct: true, explanation: "One live schedule makes reassignment faster and ownership clear." },
    ],
  },
  {
    id: "follow-up", topic: "Follow-ups", title: "Good leads keep slipping away.",
    situation: "Customer follow-ups depend on inboxes and memory.",
    choices: [
      { id: "reminder", text: "Tell everyone to remember their follow-ups.", correct: false, explanation: "A reminder doesn’t create a dependable follow-up process." },
      { id: "review", text: "Review every inbox in a daily meeting.", correct: false, explanation: "More meetings add admin without fixing customer ownership." },
      { id: "velho", text: "Have Velho streamline customer follow-ups.", correct: true, explanation: "Visible next steps and prepared drafts keep customers from being forgotten." },
    ],
  },
  {
    id: "field-work", topic: "Field reports", title: "The job is done. Billing is still waiting.",
    situation: "Technicians retype their site notes every evening.",
    choices: [
      { id: "clerk", text: "Hire someone to retype the notes.", correct: false, explanation: "You’ve moved the duplicate work to another person." },
      { id: "weekend", text: "Save all reports for Friday.", correct: false, explanation: "Batching reports delays billing and makes details harder to remember." },
      { id: "velho", text: "Have Velho connect site notes to billing.", correct: true, explanation: "Capture details once and carry them through reporting and billing." },
    ],
  },
  {
    id: "orders", topic: "Order intake", title: "Copy-paste errors are costing you customers.",
    situation: "Email orders are retyped into your ERP.",
    choices: [
      { id: "checker", text: "Hire someone to double-check every order.", correct: false, explanation: "Every order now needs two people through the same manual steps." },
      { id: "spreadsheet", text: "Add an order-tracking spreadsheet.", correct: false, explanation: "Another copy adds another chance for details to drift." },
      { id: "velho", text: "Have Velho automate intake with validation.", correct: true, explanation: "Validated order data flows into the ERP; people review unclear cases." },
    ],
  },
  {
    id: "stock", topic: "Stock", title: "Bestsellers sell out. Slow stock piles up.",
    situation: "Purchasing relies on last month’s stock spreadsheet.",
    choices: [
      { id: "space", text: "Rent more space and buy extra stock.", correct: false, explanation: "More stock ties up cash without showing what customers need." },
      { id: "count", text: "Ask for daily stock-count emails.", correct: false, explanation: "Daily emails still leave purchasing piecing the picture together." },
      { id: "velho", text: "Have Velho connect sales, stock and purchasing.", correct: true, explanation: "Current data helps purchasing spot shortages and excess stock sooner." },
    ],
  },
  {
    id: "onboarding", topic: "Onboarding", title: "New hires spend week one chasing access.",
    situation: "Requests get lost between HR, IT and payroll.",
    choices: [
      { id: "coordinator", text: "Hire someone to chase the emails.", correct: false, explanation: "Another person still has to navigate the same unclear handoffs." },
      { id: "cc", text: "CC everyone on every request.", correct: false, explanation: "More recipients create noise, not clear ownership." },
      { id: "velho", text: "Have Velho streamline onboarding handoffs.", correct: true, explanation: "Collect details once, assign owners and track each step." },
    ],
  },
  {
    id: "supplier-invoices", topic: "Approvals", title: "Suppliers are chasing unpaid invoices.",
    situation: "Nobody knows who should approve each payment.",
    choices: [
      { id: "calls", text: "Call every approver each morning.", correct: false, explanation: "Unclear ownership becomes a daily chasing job for finance." },
      { id: "outsource", text: "Outsource the invoice chasing.", correct: false, explanation: "An external team faces the same unclear approval steps." },
      { id: "velho", text: "Have Velho streamline approval routing.", correct: true, explanation: "Clear rules route invoices to the right owner and flag delays." },
    ],
  },
];
