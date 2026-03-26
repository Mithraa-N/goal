import Link from "next/link";
import { signup } from "@/app/(auth)/actions";
import { Mail, Lock, User, AlertCircle } from "lucide-react";

interface SignupPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-mesh">
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-blue-500/8 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xl glow-primary">
              G
            </div>
            <span className="font-bold text-white text-xl">GolfDraw</span>
          </Link>
          <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
          <p className="text-[var(--text-secondary)] text-sm">Join the monthly draw and support a charity you love</p>
        </div>

        <div className="glass rounded-2xl p-8 shadow-2xl border border-[var(--border)]">
          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm mb-6">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{decodeURIComponent(error)}</span>
            </div>
          )}

          <form action={signup} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Full name
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="John Smith"
                  className="input pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="input pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="input pl-9"
                />
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              By signing up you agree to our{" "}
              <Link href="/terms" className="text-blue-400 hover:text-blue-300">Terms</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>.
            </p>

            <button type="submit" className="btn btn-primary w-full">
              Create Account
            </button>
          </form>

          <div className="divider" />

          <p className="text-center text-sm text-[var(--text-secondary)]">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
