import { SOP, SOPCategory, SOPCategoryMeta } from "@/types/sop";

export const SOPS: SOP[] = [
  {
    id: "sop-001",
    slug: "employee-onboarding",
    title: "Employee Onboarding",
    description:
      "Standard procedure for integrating new employees from offer acceptance through their first 90 days.",
    category: "onboarding",
    status: "active",
    version: "3.2",
    owner: "People Operations",
    lastReviewed: "2026-03-15",
    effectiveDate: "2025-01-01",
    tags: ["hr", "new-hire", "orientation"],
    steps: [
      {
        id: 1,
        title: "Send offer confirmation and welcome kit",
        description:
          "Email the signed offer letter, company handbook, and a welcome packet with first-day logistics (parking, dress code, schedule) no later than 48 hours after acceptance.",
        note: "Use the Welcome Kit template in Google Drive / HR > Templates.",
      },
      {
        id: 2,
        title: "Provision accounts and access",
        description:
          "Submit an IT ticket to create corporate email, Slack, GitHub, and tool-specific accounts aligned to the employee's role. Access should be ready by 9 AM on the start date.",
        warning: "Never provision admin-level access without manager approval.",
      },
      {
        id: 3,
        title: "Assign onboarding buddy",
        description:
          "Pair the new hire with a tenured team member outside their direct chain of command. The buddy's role is social and cultural, not technical.",
      },
      {
        id: 4,
        title: "Complete required compliance training",
        description:
          "New hires must finish Security Awareness, Anti-Harassment, and Data Privacy modules within their first five business days via the LMS.",
        warning: "Training completion is a legal requirement. Do not skip.",
      },
      {
        id: 5,
        title: "30-day check-in with manager",
        description:
          "Schedule a structured 30-minute meeting to review initial impressions, clarify expectations, and surface any blockers. Log outcomes in the HR system.",
      },
      {
        id: 6,
        title: "90-day performance baseline",
        description:
          "Conduct a formal review against the onboarding success criteria defined in the role's job description. Document and share with the employee.",
      },
    ],
    relatedSOPs: ["offboarding-process", "access-control-policy"],
  },
  {
    id: "sop-002",
    slug: "incident-response",
    title: "Incident Response",
    description:
      "Structured process for identifying, containing, and resolving production incidents while minimizing customer impact.",
    category: "operations",
    status: "active",
    version: "2.1",
    owner: "Engineering",
    lastReviewed: "2026-04-01",
    effectiveDate: "2025-06-01",
    tags: ["engineering", "on-call", "production"],
    steps: [
      {
        id: 1,
        title: "Declare the incident",
        description:
          "Any team member who detects a customer-impacting issue must immediately post to #incidents on Slack, tag @oncall, and open an incident ticket in PagerDuty.",
        warning: "Do not wait to confirm severity before declaring — declare, then assess.",
      },
      {
        id: 2,
        title: "Assign incident commander (IC)",
        description:
          "The on-call engineer assumes the IC role unless they hand off to a more senior engineer within 5 minutes. The IC coordinates all response activity and owns communication.",
      },
      {
        id: 3,
        title: "Assess severity and notify stakeholders",
        description:
          "Use the severity matrix (P0–P3) to classify the incident. P0 and P1 require immediate notification to the VP of Engineering and Customer Success within 15 minutes.",
      },
      {
        id: 4,
        title: "Contain and mitigate",
        description:
          "Take the fastest available action to stop customer impact — rollback, feature flag, rate limit, or traffic shift. Preserve logs before any rollback.",
        note: "Mitigation speed beats root-cause analysis. Fix first, investigate after.",
      },
      {
        id: 5,
        title: "Communicate status updates",
        description:
          "Post updates every 15 minutes to #incidents and the status page while the incident is open. Use plain language — no jargon in customer-facing copy.",
      },
      {
        id: 6,
        title: "Resolve and close",
        description:
          "Confirm the fix is stable for 30 minutes before marking resolved. Update the ticket with resolution details and notify all stakeholders.",
      },
      {
        id: 7,
        title: "Conduct post-mortem",
        description:
          "Schedule a blameless post-mortem within 5 business days for all P0/P1 incidents. Publish findings and action items in Confluence within 48 hours of the meeting.",
      },
    ],
    relatedSOPs: ["on-call-rotation", "severity-matrix"],
  },
  {
    id: "sop-003",
    slug: "data-access-request",
    title: "Data Access Request",
    description:
      "How to request, approve, and audit access to sensitive customer or business data.",
    category: "security",
    status: "active",
    version: "1.4",
    owner: "Security & Compliance",
    lastReviewed: "2026-02-20",
    effectiveDate: "2025-03-01",
    tags: ["data", "compliance", "access-control"],
    steps: [
      {
        id: 1,
        title: "Submit access request",
        description:
          "Complete the Data Access Request form in the IT portal. Specify the dataset, business justification, duration, and required access level (read / read-write).",
      },
      {
        id: 2,
        title: "Manager approval",
        description:
          "Your direct manager must approve the request within 2 business days. Requests for PII or financial data require dual approval (manager + Data Privacy Officer).",
        warning:
          "Requests without a business justification will be automatically rejected.",
      },
      {
        id: 3,
        title: "Security review",
        description:
          "The Security team reviews all approved requests for compliance with the Data Classification Policy. Review SLA is 3 business days for standard requests.",
      },
      {
        id: 4,
        title: "Provisioning",
        description:
          "IT provisions access with a maximum duration of 90 days. Permanent access requires quarterly renewal and VP-level sponsorship.",
        note: "All access is logged and subject to automated anomaly detection.",
      },
      {
        id: 5,
        title: "Access expiry and revocation",
        description:
          "Access is automatically revoked at expiry. Early revocation can be requested by the employee, their manager, or the Security team at any time.",
      },
    ],
    relatedSOPs: ["data-classification-policy", "offboarding-process"],
  },
  {
    id: "sop-004",
    slug: "vendor-onboarding",
    title: "Vendor Onboarding",
    description:
      "End-to-end process for evaluating, contracting, and integrating new vendors and third-party suppliers.",
    category: "operations",
    status: "under-review",
    version: "1.0",
    owner: "Procurement",
    lastReviewed: "2026-01-10",
    effectiveDate: "2025-01-15",
    tags: ["procurement", "vendor", "legal"],
    steps: [
      {
        id: 1,
        title: "Submit vendor evaluation request",
        description:
          "Complete the vendor intake form with company details, services required, estimated annual spend, and business owner. Submit to procurement@company.com.",
      },
      {
        id: 2,
        title: "Security and compliance assessment",
        description:
          "Procurement sends the vendor a security questionnaire (based on SOC 2 / ISO 27001 controls). Vendors with access to company data must complete this before contract execution.",
      },
      {
        id: 3,
        title: "Contract negotiation and legal review",
        description:
          "Legal reviews all contracts over $10K or involving data sharing. Use approved MSA templates where possible. Non-standard terms require General Counsel sign-off.",
      },
      {
        id: 4,
        title: "Finance approval",
        description:
          "Contracts over $25K require VP approval. Contracts over $100K require C-suite approval. All approvals are tracked in the contract management system.",
      },
      {
        id: 5,
        title: "Vendor registration and payment setup",
        description:
          "Collect banking details via the secure vendor portal. Add the vendor to the approved vendor list and configure billing in the ERP system.",
      },
    ],
    relatedSOPs: ["data-access-request", "contract-management"],
  },
  {
    id: "sop-005",
    slug: "performance-review",
    title: "Performance Review Cycle",
    description:
      "Bi-annual structured process for evaluating employee performance, setting goals, and determining compensation adjustments.",
    category: "hr",
    status: "active",
    version: "4.0",
    owner: "People Operations",
    lastReviewed: "2026-04-30",
    effectiveDate: "2025-07-01",
    tags: ["hr", "performance", "compensation"],
    steps: [
      {
        id: 1,
        title: "Open self-assessment",
        description:
          "Employees complete a structured self-assessment in the HRIS covering: key accomplishments, challenges, goal progress, and development areas. Window: 2 weeks.",
      },
      {
        id: 2,
        title: "Manager evaluation",
        description:
          "Managers complete evaluations for all direct reports against role-level competencies and individual goals. Ratings are not shared until calibration is complete.",
      },
      {
        id: 3,
        title: "Calibration sessions",
        description:
          "VP-level leaders facilitate calibration across teams to ensure rating consistency. HR facilitates and documents outcomes. No employee data leaves the session.",
        warning: "Calibration discussions are strictly confidential.",
      },
      {
        id: 4,
        title: "Compensation review",
        description:
          "People Ops and Finance model compensation adjustments based on calibrated ratings, market data, and budget. Proposals require CFO approval.",
      },
      {
        id: 5,
        title: "Deliver feedback",
        description:
          "Managers conduct 1:1 review conversations within 2 weeks of calibration closing. Written feedback is shared in the HRIS within 24 hours of the conversation.",
      },
      {
        id: 6,
        title: "Goal-setting for next cycle",
        description:
          "Employees and managers align on 3–5 SMART goals for the upcoming cycle. Goals are entered in the HRIS and marked final within 2 weeks of review delivery.",
      },
    ],
    relatedSOPs: ["compensation-philosophy", "employee-onboarding"],
  },
  {
    id: "sop-006",
    slug: "change-management",
    title: "Change Management",
    description:
      "Controls for requesting, reviewing, and deploying changes to production systems to prevent unplanned outages.",
    category: "operations",
    status: "draft",
    version: "0.9",
    owner: "Engineering",
    lastReviewed: "2026-05-01",
    effectiveDate: "2026-06-01",
    tags: ["engineering", "deployment", "risk"],
    steps: [
      {
        id: 1,
        title: "Raise a change request (CR)",
        description:
          "Open a CR in Jira using the Change Management template. Classify as Standard (pre-approved), Normal, or Emergency. Include rollback plan and blast radius assessment.",
      },
      {
        id: 2,
        title: "Change Advisory Board (CAB) review",
        description:
          "Normal changes are reviewed in the weekly CAB meeting. Present risk assessment, implementation plan, and verification steps. Emergency changes follow the fast-track path.",
      },
      {
        id: 3,
        title: "Approval and scheduling",
        description:
          "Approved changes are scheduled in the change calendar. Changes to customer-facing systems are blocked during peak hours (9 AM – 5 PM local for primary markets).",
      },
      {
        id: 4,
        title: "Deploy and monitor",
        description:
          "Execute the change following the approved plan. Monitor dashboards for 30 minutes post-deployment. IC on-call must be notified before any production change.",
      },
      {
        id: 5,
        title: "Close and document",
        description:
          "Mark the CR as implemented, document any deviations from the plan, and confirm rollback plan was not needed. Close within 48 hours of successful deployment.",
      },
    ],
    relatedSOPs: ["incident-response", "deployment-runbook"],
  },
];

export const CATEGORY_META: Record<string, SOPCategoryMeta> = {
  onboarding: {
    id: "onboarding",
    label: "Onboarding",
    description: "New hire and vendor integration procedures",
    icon: "Users",
    count: SOPS.filter((s) => s.category === "onboarding").length,
  },
  operations: {
    id: "operations",
    label: "Operations",
    description: "Day-to-day operational standards and controls",
    icon: "Settings",
    count: SOPS.filter((s) => s.category === "operations").length,
  },
  security: {
    id: "security",
    label: "Security",
    description: "Access control, compliance, and data protection",
    icon: "Shield",
    count: SOPS.filter((s) => s.category === "security").length,
  },
  hr: {
    id: "hr",
    label: "HR",
    description: "People operations and workforce management",
    icon: "Heart",
    count: SOPS.filter((s) => s.category === "hr").length,
  },
  finance: {
    id: "finance",
    label: "Finance",
    description: "Financial controls and approval workflows",
    icon: "DollarSign",
    count: SOPS.filter((s) => s.category === "finance").length,
  },
  legal: {
    id: "legal",
    label: "Legal",
    description: "Contracts, risk, and regulatory compliance",
    icon: "Scale",
    count: SOPS.filter((s) => s.category === "legal").length,
  },
};

export function getSOPsByCategory(category: SOPCategory): SOP[] {
  return SOPS.filter((s) => s.category === category);
}

export function getSOPBySlug(slug: string): SOP | undefined {
  return SOPS.find((s) => s.slug === slug);
}

export function getSOPById(id: string): SOP | undefined {
  return SOPS.find((s) => s.id === id);
}

export function getActiveSOPs(): SOP[] {
  return SOPS.filter((s) => s.status === "active");
}

export function getAllCategories(): SOPCategory[] {
  return [...new Set(SOPS.map((s) => s.category))];
}
