"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-client";

interface NavbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/quiz", label: "Quiz" },
  { href: "/cards", label: "Cards" },
  { href: "/settings", label: "Settings" },
];

export function AppNavbar({ user }: NavbarProps) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Brand */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-lg font-semibold text-zinc-50"
        >
          <span className="text-xl" aria-hidden="true">
            字
          </span>
          <span className="hidden sm:inline">In Context Learning</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-zinc-50"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* User menu */}
        <div className="flex items-center gap-3">
          {user.image && (
            <img
              src={user.image}
              alt=""
              className="h-7 w-7 rounded-full"
              referrerPolicy="no-referrer"
            />
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
