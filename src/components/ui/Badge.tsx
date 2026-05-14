import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "outline";
  size?: "sm" | "md";
  className?: string;
}

const variantStyles = {
  default: "bg-[#f0f0ee] text-[#3d3d3a] border-transparent",
  success: "bg-green-50 text-green-700 border-transparent",
  warning: "bg-amber-50 text-amber-700 border-transparent",
  danger: "bg-red-50 text-red-700 border-transparent",
  info: "bg-blue-50 text-blue-700 border-transparent",
  outline: "bg-transparent text-[#6b6b66] border-[#e5e5e3]",
};

const sizeStyles = {
  sm: "text-[10px] px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
};

export function Badge({
  children,
  variant = "default",
  size = "md",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium tracking-wide",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
