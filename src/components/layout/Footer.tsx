export function Footer() {
  return (
    <footer className="border-t border-[#e5e5e3] bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <p className="text-xs text-[#9c9c96]">
          © {new Date().getFullYear()} Process Hub. Internal use only.
        </p>
        <p className="text-xs text-[#9c9c96]">
          Last updated: May 2026
        </p>
      </div>
    </footer>
  );
}
