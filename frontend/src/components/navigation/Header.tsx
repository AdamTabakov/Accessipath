import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { MapPin, Menu, X } from "lucide-react";
import { Button } from "../ui.js";

const LINKS = [
  { to: "/map", label: "Plan a route" },
  { to: "/preferences", label: "Preferences" },
  { to: "/report", label: "Report an issue" },
  { to: "/about", label: "About" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-[1000] border-b border-graphite bg-true-black/90 backdrop-blur-xl">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"
      >
        <Link
          to="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-silk"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-apple-blue text-white">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>AccessiPath</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `text-sm transition-colors ${
                  isActive ? "text-white" : "text-platinum hover:text-white"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <Button size="sm" onClick={() => navigate("/map")}>
            Get directions
          </Button>
        </div>

        <button
          className="rounded-pill bg-smoke p-2 text-silk md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close navigation" : "Open navigation"}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </nav>

      {open && (
        <div id="mobile-nav" className="border-t border-graphite bg-true-black md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-3 text-base text-silk hover:bg-charcoal"
              >
                {link.label}
              </NavLink>
            ))}
            <Button className="mt-2" onClick={() => navigate("/map")}>
              Get directions
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}