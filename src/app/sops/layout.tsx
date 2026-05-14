export default function SOPsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-1 min-w-0">{children}</div>;
}
