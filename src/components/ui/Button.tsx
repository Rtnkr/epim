import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}

const variantStyles = {
  primary:
    "bg-[#1a1a18] text-white hover:bg-[#3d3d3a] border-transparent",
  secondary:
    "bg-white text-[#1a1a18] border-[#e5e5e3] hover:border-[#c9c9c5] hover:bg-[#f9f9f8]",
  ghost:
    "bg-transparent text-[#6b6b66] hover:text-[#1a1a18] hover:bg-[#f0f0ee] border-transparent",
};

const sizeStyles = {
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium transition-colors duration-150 cursor-pointer",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
