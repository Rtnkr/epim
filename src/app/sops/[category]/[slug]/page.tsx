import { notFound } from "next/navigation";
import Link from "next/link";
import { getSOPBySlug, SOPS } from "@/lib/sop";
import { StepList } from "@/components/sop/StepList";
import { StatusBadge } from "@/components/sop/StatusBadge";
import { TableOfContents } from "@/components/sop/TableOfContents";
import { Divider } from "@/components/ui/Divider";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Calendar, RefreshCw, User, Tag } from "lucide-react";

interface Props {
  params: Promise<{ category: string; slug: string }>;
}

export default async function SOPDetailPage({ params }: Props) {
  const { slug, category } = await params;
  const sop = getSOPBySlug(slug);
  if (!sop || sop.category !== category) notFound();

  const related = (sop.relatedSOPs ?? [])
    .map((s) => SOPS.find((r) => r.slug === s))
    .filter(Boolean);

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-8">
      {/* Back link */}
      <Link
        href={`/sops/${sop.category}`}
        className="inline-flex items-center gap-1.5 text-xs text-[#9c9c96] hover:text-[#6b6b66] mb-6 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        Back to {sop.category.charAt(0).toUpperCase() + sop.category.slice(1)}
      </Link>

      <div className="flex gap-10">
        {/* Main content */}
        <article className="flex-1 min-w-0">
          {/* Header */}
          <header className="mb-8 pb-8 border-b border-[#e5e5e3]">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9c9c96]">
                    {sop.id}
                  </span>
                  <span className="text-[#e5e5e3]">·</span>
                  <span className="text-[10px] text-[#9c9c96]">
                    v{sop.version}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-[#1a1a18] tracking-tight leading-tight">
                  {sop.title}
                </h1>
              </div>
              <StatusBadge status={sop.status} />
            </div>
            <p className="text-sm text-[#6b6b66] leading-relaxed mt-3 max-w-2xl">
              {sop.description}
            </p>

            {/* Meta grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#f0f0ee]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9c9c96] mb-1">
                  Owner
                </p>
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-[#9c9c96]" />
                  <span className="text-sm text-[#3d3d3a] font-medium">
                    {sop.owner}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9c9c96] mb-1">
                  Last Reviewed
                </p>
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 text-[#9c9c96]" />
                  <span className="text-sm text-[#3d3d3a] font-medium">
                    {formatDate(sop.lastReviewed)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9c9c96] mb-1">
                  Effective Date
                </p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[#9c9c96]" />
                  <span className="text-sm text-[#3d3d3a] font-medium">
                    {formatDate(sop.effectiveDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tags */}
            {sop.tags.length > 0 && (
              <div className="flex items-center gap-2 mt-4">
                <Tag className="w-3 h-3 text-[#9c9c96]" />
                <div className="flex flex-wrap gap-1.5">
                  {sop.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0f0ee] text-[#6b6b66] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </header>

          {/* Steps */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#9c9c96]">
                Procedure
              </h2>
              <Divider className="flex-1" />
              <span className="text-xs text-[#9c9c96]">
                {sop.steps.length} steps
              </span>
            </div>
            <div>
              {sop.steps.map((step) => (
                <div key={step.id} data-step={step.id} id={`step-${step.id}`}>
                  <StepList steps={[step]} />
                </div>
              ))}
            </div>
          </section>

          {/* Related SOPs */}
          {related.length > 0 && (
            <section className="mt-10 pt-8 border-t border-[#e5e5e3]">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#9c9c96] mb-4">
                Related Procedures
              </h2>
              <div className="space-y-2">
                {related.map((rel) =>
                  rel ? (
                    <Link
                      key={rel.id}
                      href={`/sops/${rel.category}/${rel.slug}`}
                      className="flex items-center justify-between p-3 rounded-md border border-[#e5e5e3] hover:border-[#c9c9c5] bg-white hover:bg-[#f9f9f8] transition-all group"
                    >
                      <div>
                        <span className="text-[10px] text-[#9c9c96] font-medium uppercase tracking-wider">
                          {rel.id}
                        </span>
                        <p className="text-sm font-medium text-[#1a1a18] mt-0.5">
                          {rel.title}
                        </p>
                      </div>
                      <StatusBadge status={rel.status} size="sm" />
                    </Link>
                  ) : null
                )}
              </div>
            </section>
          )}
        </article>

        {/* Sticky TOC */}
        <aside className="hidden lg:block w-48 shrink-0">
          <TableOfContents steps={sop.steps} />
        </aside>
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  return SOPS.map((sop) => ({
    category: sop.category,
    slug: sop.slug,
  }));
}
