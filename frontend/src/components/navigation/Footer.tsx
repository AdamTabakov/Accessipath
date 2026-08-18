import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-graphite bg-true-black">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-md">
            <p className="font-display text-lg font-semibold text-silk">AccessiPath</p>
            <p className="mt-2 text-sm leading-relaxed text-ash">
              Accessibility-first navigation for Toronto Metropolitan University. Routes that are
              not just short — but usable.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-col gap-2 text-sm text-platinum">
            <Link to="/map" className="hover:text-white">
              Plan a route
            </Link>
            <Link to="/preferences" className="hover:text-white">
              Preferences
            </Link>
            <Link to="/report" className="hover:text-white">
              Report an issue
            </Link>
            <Link to="/about" className="hover:text-white">
              About
            </Link>
          </nav>
        </div>

        <div className="mt-10 border-t border-graphite pt-6 text-xs leading-relaxed text-ash">
          <p>
            Map data &copy; OpenStreetMap contributors. TMU accessibility information is a curated
            demo dataset derived from public sources — review against live sources before relying on
            it.
          </p>
          <p className="mt-2">
            Accessibility information on AccessiPath is best-effort and frequently incomplete.
            &ldquo;Unknown&rdquo; never means &ldquo;inaccessible&rdquo;. Use your judgment and verify
            critical conditions.
          </p>
        </div>
      </div>
    </footer>
  );
}