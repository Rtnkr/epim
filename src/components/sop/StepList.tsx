import { SOPStep } from "@/types/sop";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepListProps {
  steps: SOPStep[];
}

export function StepList({ steps }: StepListProps) {
  return (
    <ol className="relative space-y-0">
      {steps.map((step, index) => (
        <li key={step.id} className="flex gap-5">
          {/* Step line + number */}
          <div className="flex flex-col items-center shrink-0">
            <div
              className={cn(
                "w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 z-10",
                "border-[#1a1a18] bg-white text-[#1a1a18]"
              )}
            >
              {step.id}
            </div>
            {index < steps.length - 1 && (
              <div className="w-px flex-1 my-1.5 bg-[#e5e5e3]" />
            )}
          </div>

          {/* Content */}
          <div className={cn("pb-8 flex-1", index === steps.length - 1 && "pb-0")}>
            <h3 className="text-sm font-semibold text-[#1a1a18] leading-tight mb-1.5">
              {step.title}
            </h3>
            <p className="text-sm text-[#6b6b66] leading-relaxed">
              {step.description}
            </p>

            {step.note && (
              <div className="mt-3 flex gap-2.5 p-3 rounded-md bg-blue-50 border border-blue-100">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  {step.note}
                </p>
              </div>
            )}

            {step.warning && (
              <div className="mt-3 flex gap-2.5 p-3 rounded-md bg-amber-50 border border-amber-100">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  {step.warning}
                </p>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
