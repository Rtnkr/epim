export type SOPStatus = "active" | "draft" | "archived" | "under-review";

export type SOPCategory =
  | "onboarding"
  | "operations"
  | "security"
  | "finance"
  | "hr"
  | "legal";

export interface SOPStep {
  id: number;
  title: string;
  description: string;
  note?: string;
  warning?: string;
}

export interface SOP {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: SOPCategory;
  status: SOPStatus;
  version: string;
  owner: string;
  lastReviewed: string;
  effectiveDate: string;
  steps: SOPStep[];
  tags: string[];
  relatedSOPs?: string[];
}

export interface SOPCategoryMeta {
  id: SOPCategory;
  label: string;
  description: string;
  icon: string;
  count: number;
}
