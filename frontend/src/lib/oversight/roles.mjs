// The four kinds of party that report on a stadium, when each report is due, and the sections a complete report contains.
// Shared by the build script (scripts/build-oversight.mjs) and the application, so a section named in the CSV is checked
// against the same list the completeness check uses.
//
// Every party reports monthly. A report covers the month before its due date: the report due on 5 November covers October.
export const ROLES = [
  {
    id: "contractor",
    label: "Contractor",
    plural: "Contractors",
    dueDay: 5,
    sections: ["Programme progress", "Quality and defects log", "Evidence index", "Health and safety", "Procurement and deliveries", "Risks and mitigations"],
  },
  {
    id: "pmc",
    label: "Programme manager",
    plural: "Programme managers",
    dueDay: 10,
    sections: ["Programme and milestones", "Cost and change control", "Risk register", "Interface issues", "Contractor performance", "Decisions needed"],
  },
  {
    id: "engineering",
    label: "Engineering firm",
    plural: "Engineering firms",
    dueDay: 10,
    sections: ["Design status", "Clash and coordination log", "Site inspection findings", "Open technical queries", "Requirement compliance check", "Design changes"],
  },
  {
    id: "owner",
    label: "Asset owner",
    plural: "Asset owners",
    dueDay: 15,
    sections: ["Funding and approvals", "Land and permits", "Operations readiness", "Stakeholder updates", "Handover plan", "Risks and decisions"],
  },
];
export const ROLE_IDS = ROLES.map((r) => r.id);
export const roleById = (id) => ROLES.find((r) => r.id === id) || null;
/** How many reporting cycles each party's history covers. */
export const CYCLES = 6;
