"use client";

import { LogOut, Settings, FileText, MapPin } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ProfileDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  email: string;
  onLogout: () => void;
}

const menuItems: Array<{
  label: string;
  to: string;
  icon: React.ReactNode;
}> = [
  {
    label: "Preferences",
    to: "/preferences",
    icon: <Settings className="h-4 w-4" aria-hidden="true" />,
  },
  {
    label: "Report an issue",
    to: "/report",
    icon: <MapPin className="h-4 w-4" aria-hidden="true" />,
  },
  {
    label: "Terms & Privacy",
    to: "/terms",
    icon: <FileText className="h-4 w-4" aria-hidden="true" />,
  },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

export default function ProfileDropdown({
  name,
  email,
  onLogout,
  className,
  ...props
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={cn("relative", className)} {...props}>
      <DropdownMenu onOpenChange={setIsOpen}>
        <div className="group relative">
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-pill border border-zinc-800/60 bg-zinc-900 py-1.5 pr-2 pl-1.5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800/40 focus:outline-none"
              type="button"
              aria-label={`Account menu for ${name}`}
            >
              <div className="hidden flex-col text-right lg:block">
                <div className="text-sm leading-tight font-medium tracking-tight text-zinc-100">
                  {name}
                </div>
                <div className="text-[10px] leading-tight tracking-tight text-zinc-400">
                  {email}
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-apple-blue to-link-blue p-0.5">
                <div className="grid h-full w-full place-items-center rounded-full bg-zinc-900 text-xs font-semibold text-silk">
                  {initials(name)}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-64 origin-top-right rounded-2xl border border-zinc-800/60 bg-zinc-900/95 p-2 shadow-xl shadow-zinc-950/20 backdrop-blur-sm"
            sideOffset={4}
          >
            <div className="space-y-1">
              {menuItems.map((item) => (
                <DropdownMenuItem asChild key={item.label}>
                  <Link
                    className="group flex cursor-pointer items-center rounded-xl border border-transparent p-3 transition-all duration-200 hover:border-zinc-700/50 hover:bg-zinc-800/60"
                    to={item.to}
                  >
                    <div className="flex flex-1 items-center gap-2">
                      {item.icon}
                      <span className="whitespace-nowrap text-sm font-medium leading-tight tracking-tight text-zinc-100 transition-colors group-hover:text-zinc-50">
                        {item.label}
                      </span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>

            <DropdownMenuSeparator className="my-3 bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

            <DropdownMenuItem asChild>
              <button
                className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-red-500/10 p-3 transition-all duration-200 hover:border-red-500/30 hover:bg-red-500/20"
                type="button"
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4 text-red-500 group-hover:text-red-600" aria-hidden="true" />
                <span className="text-sm font-medium text-red-500 group-hover:text-red-600">
                  Sign Out
                </span>
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </div>
      </DropdownMenu>
    </div>
  );
}