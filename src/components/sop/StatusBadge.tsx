import { Badge } from "@/components/ui/Badge";
import { SOPStatus } from "@/types/sop";

const statusConfig: Record<
  SOPStatus,
  { label: string; variant: "success" | "warning" | "danger" | "outline" }
> = {
  active: { label: "Active", variant: "success" },
  draft: { label: "Draft", variant: "outline" },
  archived: { label: "Archived", variant: "danger" },
  "under-review": { label: "Under Review", variant: "warning" },
};

interface StatusBadgeProps {
  status: SOPStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} size={size}>
      {config.label}
    </Badge>
  );
}
