import { notFound } from "next/navigation";
import { CATEGORY_META, getSOPsByCategory } from "@/lib/sop";
import { RuleCard } from "@/components/sop/RuleCard";
import { SOPCategory } from "@/types/sop";
import {
  Users,
  Settings,
  Shield,
  Heart,
  DollarSign,
  Scale,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  Users,
  Settings,
  Shield,
  Heart,
  DollarSign,
  Scale,
};

interface Props {
  params: Promise<{ category: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const meta = CATEGORY_META[category];
  if (!meta) notFound();

  const sops = getSOPsByCategory(category as SOPCategory);
  const Icon = iconMap[meta.icon] ?? Settings;

  const active = sops.filter((s) => s.status === "active").length;
  const draft = sops.filter((s) => s.status === "draft").length;
  const underReview = sops.filter((s) => s.status === "under-review").length;

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-8">
      {/* Category header */}
      <div className="flex items-start gap-4 mb-8 pb-8 border-b border-[#e5e5e3]">
        <div className="w-10 h-10 rounded-lg bg-[#f0f0ee] flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#3d3d3a]" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[#1a1a18] tracking-tight mb-1">
            {meta.label}
          </h1>
          <p className="text-sm text-[#6b6b66]">{meta.description}</p>
          {/* Mini stats */}
          <div className="flex items-center gap-4 mt-3">
            <span className="text-xs text-[#9c9c96]">
              <span className="font-semibold text-[#1a1a18]">{active}</span> active
            </span>
            {draft > 0 && (
              <span className="text-xs text-[#9c9c96]">
                <span className="font-semibold text-[#1a1a18]">{draft}</span> draft
              </span>
            )}
            {underReview > 0 && (
              <span className="text-xs text-[#9c9c96]">
                <span className="font-semibold text-[#1a1a18]">{underReview}</span> under review
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SOPs grid */}
      {sops.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm text-[#9c9c96]">No procedures in this category yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {sops.map((sop) => (
            <RuleCard key={sop.id} sop={sop} />
          ))}
        </div>
      )}
    </div>
  );
}

export async function generateStaticParams() {
  return Object.keys(CATEGORY_META).map((category) => ({ category }));
}
