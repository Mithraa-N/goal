import Link from "next/link";
import { PublicNav } from "@/components/layout/PublicNav";
import { Trophy, Target, Heart, Zap, Shield, Star, ChevronRight, Users, TrendingUp, Award } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        {/* Background orbs */}
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center">
          <div className="badge badge-accent inline-flex mb-6 text-xs px-4 py-1.5 animate-fade-in">
            <Star size={10} className="mr-1" />
            Monthly Prize Pool · Real Impact
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight mb-6 animate-fade-in-up">
            Where Golf Meets
            <span className="gradient-text block mt-1">Genuine Giving</span>
          </h1>

          <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 animate-fade-in-up animate-delay-100">
            Submit your golf scores, enter monthly prize draws, and automatically donate to
            the charity you love — all in one premium platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animate-delay-200">
            <Link href="/signup" className="btn btn-primary btn-lg glow-primary">
              Start for Free
              <ChevronRight size={18} />
            </Link>
            <Link href="#how-it-works" className="btn btn-secondary btn-lg">
              See How It Works
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-8 mt-14 text-sm text-[var(--text-muted)] animate-fade-in-up animate-delay-300">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-blue-400" />
              <span><strong className="text-white">2,400+</strong> Players</span>
            </div>
            <div className="w-px h-4 bg-[var(--border)]" />
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-yellow-400" />
              <span><strong className="text-white">£38k+</strong> in Prizes</span>
            </div>
            <div className="w-px h-4 bg-[var(--border)]" />
            <div className="flex items-center gap-2">
              <Heart size={14} className="text-red-400" />
              <span><strong className="text-white">£12k+</strong> to Charity</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Simple by Design</h2>
            <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
              Three steps to playing, winning, and giving — every single month.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: "Submit Your Scores",
                desc: "Enter up to 5 golf scores (1–45) each month. Your latest 5 are always on record and entered automatically.",
                color: "from-blue-500 to-cyan-500",
                glow: "var(--primary-glow)",
              },
              {
                icon: Zap,
                title: "Monthly Draw",
                desc: "On the first of every month, 5 winning numbers are drawn. Match 3, 4, or all 5 to win from the prize pool.",
                color: "from-purple-500 to-pink-500",
                glow: "rgba(168, 85, 247, 0.35)",
              },
              {
                icon: Heart,
                title: "Give Automatically",
                desc: "At least 10% of your subscription goes straight to your chosen charity — no extra steps needed.",
                color: "from-rose-500 to-orange-500",
                glow: "rgba(244, 63, 94, 0.3)",
              },
            ].map(({ icon: Icon, title, desc, color, glow }, i) => (
              <div
                key={i}
                className="card card-hover text-center group"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mx-auto mb-5 transition-all group-hover:scale-110`}
                  style={{ boxShadow: `0 8px 24px ${glow}` }}
                >
                  <Icon size={24} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prize pool breakdown */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="card p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="badge badge-warning mb-4">Prize Distribution</div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Transparent Prize Pools
                </h2>
                <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
                  Every subscription contributes to the monthly prize pool. The
                  breakdown is always visible, always fair, and always grows with
                  the community.
                </p>
                <Link href="/signup" className="btn btn-primary">
                  Join the Draw <ChevronRight size={16} />
                </Link>
              </div>
              <div className="space-y-4">
                {[
                  { label: "5 Matches", share: "40%", desc: "Rollover jackpot if no winner", color: "bg-yellow-400", tier: "Jackpot" },
                  { label: "4 Matches", share: "35%", desc: "Split among 4-match winners", color: "bg-blue-400", tier: "Major" },
                  { label: "3 Matches", share: "25%", desc: "Split among 3-match winners", color: "bg-cyan-400", tier: "Minor" },
                ].map(({ label, share, desc, color, tier }) => (
                  <div key={label} className="glass-light rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                        <span className="font-semibold text-white text-sm">{label}</span>
                        <span className="badge badge-warning text-xs">{tier}</span>
                      </div>
                      <span className="font-bold text-white text-lg gradient-text-gold">{share}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] pl-5">{desc}</p>
                    <div className="progress-track mt-2">
                      <div
                        className="progress-bar"
                        style={{ width: share, background: color.replace("bg-", "var(--color-") + ")" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Charity section */}
      <section id="charities" className="py-24 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="badge badge-success inline-flex mb-4">
            <Heart size={10} className="mr-1" /> Verified Charities
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">Play with Purpose</h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto mb-12">
            Choose a charity you care about. A guaranteed 10% of every subscription
            goes directly to them, every single month.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {["Cancer Research", "Mind UK", "RNIB", "British Red Cross"].map((name) => (
              <div key={name} className="card card-hover flex items-center justify-center text-center p-5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/30 border border-green-500/30 flex items-center justify-center mb-3">
                  <Heart size={18} className="text-green-400" />
                </div>
                <p className="text-sm font-semibold text-white">{name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 border-t border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: "£38k+", label: "Total Prizes Awarded", icon: Award },
            { value: "2,400+", label: "Active Members", icon: Users },
            { value: "12", label: "Charity Partners", icon: Heart },
            { value: "100%", label: "Draw Transparency", icon: Shield },
          ].map(({ value, label, icon: Icon }) => (
            <div key={label} className="stat-card">
              <Icon size={20} className="text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold gradient-text mb-1">{value}</p>
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Compete & Contribute?
          </h2>
          <p className="text-[var(--text-secondary)] text-lg mb-8">
            Join thousands of golfers making every round count — for prizes and for good.
          </p>
          <Link href="/signup" className="btn btn-primary btn-lg glow-primary">
            Create Your Account <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">G</div>
            <span className="font-bold text-white">GolfDraw</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">© 2025 GolfDraw. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-[var(--text-muted)]">
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
