import Link from "next/link";
import { Trophy, Menu } from "lucide-react";

export function PublicNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold glow-primary">
              G
            </div>
            <span className="font-bold text-white text-lg">GolfDraw</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/#how-it-works" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
              How It Works
            </Link>
            <Link href="/#charities" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
              Charities
            </Link>
            <Link href="/pricing" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="btn btn-ghost btn-sm text-[var(--text-secondary)] hover:text-white">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary btn-sm">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
