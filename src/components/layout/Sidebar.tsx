"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { User } from "@/lib/types";
import { getInitials } from "@/lib/utils";
import {
  LayoutDashboard,
  Target,
  Trophy,
  Heart,
  Settings,
  LogOut,
  Star,
  Shield,
} from "lucide-react";

interface SidebarProps {
  user: User;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/scores", label: "My Scores", icon: Target },
  { href: "/dashboard/draws", label: "Draws & Wins", icon: Trophy },
  { href: "/dashboard/charity", label: "My Charity", icon: Heart },
  { href: "/pricing", label: "Subscription", icon: Star },
];

const adminItems = [
  { href: "/admin", label: "Admin Panel", icon: Shield },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-64 glass border-r border-[var(--border)] min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[var(--border)]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg glow-primary">
          G
        </div>
        <div>
          <p className="font-bold text-white text-sm tracking-tight">GolfDraw</p>
          <p className="text-[11px] text-[var(--text-muted)]">Charity Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                active
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon
                size={16}
                className={`transition-colors ${active ? "text-blue-400" : "text-[var(--text-muted)] group-hover:text-white"}`}
              />
              {label}
            </Link>
          );
        })}

        {user.is_admin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                Admin
              </p>
            </div>
            {adminItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                    active
                      ? "bg-purple-500/15 text-purple-400 border border-purple-500/20"
                      : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={16} className={active ? "text-purple-400" : "text-[var(--text-muted)] group-hover:text-white"} />
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-[var(--border)]">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all group mb-1"
        >
          <Settings size={16} className="text-[var(--text-muted)] group-hover:text-white" />
          Settings
        </Link>
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {getInitials(user.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.full_name ?? "User"}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="btn btn-ghost btn-sm w-full justify-start text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
