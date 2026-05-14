import { cn } from "@/lib/utils";

interface DividerProps {
  className?: string;
  label?: string;
}

export function Divider({ className, label }: DividerProps) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex-1 h-px bg-[#e5e5e3]" />
        <span className="text-xs text-[#9c9c96] font-medium tracking-wider uppercase">
          {label}
        </span>
        <div className="flex-1 h-px bg-[#e5e5e3]" />
      </div>
    );
  }
  return <div className={cn("h-px w-full bg-[#e5e5e3]", className)} />;
}
