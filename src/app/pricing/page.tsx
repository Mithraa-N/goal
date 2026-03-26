import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { STRIPE_PLANS } from "@/lib/stripe";
import { CheckCircle, Star, Zap, Shield, ChevronRight } from "lucide-react";
import { PublicNav } from "@/components/layout/PublicNav";

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let subscriptionStatus = null;
  let planType = null;
  if (user) {
    const { data: profile } = await supabase.from("subscriptions").select("status, plan_type").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single();
    if (profile) {
      subscriptionStatus = profile?.status;
      planType = profile?.plan_type;
    }
  }

  const features = [
    "Enter every monthly prize draw",
    "Submit up to 5 rolling scores",
    "Choose & support your charity",
    "Real-time draw result notifications",
    "Full winnings history",
    "Priority winner verification",
  ];

  const yearlyMonthly = (STRIPE_PLANS.yearly.amount / 100 / 12).toFixed(2);

  return (
    <div className="min-h-screen gradient-mesh">
      <PublicNav />

      <div className="pt-28 pb-20 px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="badge badge-accent inline-flex mb-4">
            <Star size={10} className="mr-1" /> Simple Pricing
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            One membership. Every draw. Real impact.
          </h1>
          <p className="text-[var(--text-secondary)] text-lg">
            Choose monthly for flexibility or yearly to save 17%. Cancel anytime.
          </p>
        </div>

        {/* Plan cards */}
        <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Monthly */}
          <div className="card card-hover flex flex-col">
            <div className="mb-6">
              <p className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">Monthly</p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-extrabold text-white">
                  £{(STRIPE_PLANS.monthly.amount / 100).toFixed(2)}
                </span>
                <span className="text-[var(--text-muted)] mb-1">/month</span>
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-1">Billed monthly. Cancel anytime.</p>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                  <CheckCircle size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            {user && subscriptionStatus === "active" && planType === "monthly" ? (
              <div className="btn btn-secondary w-full cursor-default opacity-80">
                <CheckCircle size={16} className="text-green-400" /> Current Plan
              </div>
            ) : (
              <form action="/api/stripe/checkout" method="POST">
                <input type="hidden" name="plan" value="monthly" />
                <button type="submit" className="btn btn-secondary w-full">
                  {user ? "Switch to Monthly" : "Get Started"} <ChevronRight size={16} />
                </button>
              </form>
            )}
          </div>

          {/* Yearly — recommended */}
          <div className="relative card card-hover flex flex-col border-blue-500/40 glow-primary">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="badge badge-primary text-xs px-3">BEST VALUE · SAVE 17%</span>
            </div>
            <div className="mb-6 mt-2">
              <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-2">Yearly</p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-extrabold text-white">
                  £{yearlyMonthly}
                </span>
                <span className="text-[var(--text-muted)] mb-1">/month</span>
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                £{(STRIPE_PLANS.yearly.amount / 100).toFixed(2)} billed annually.
              </p>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                  <CheckCircle size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
              <li className="flex items-start gap-3 text-sm text-yellow-400 font-medium">
                <Zap size={15} className="flex-shrink-0 mt-0.5" />
                2 months free vs monthly
              </li>
            </ul>

            {user && subscriptionStatus === "active" && planType === "yearly" ? (
              <div className="btn btn-primary w-full cursor-default opacity-80">
                <CheckCircle size={16} /> Current Plan
              </div>
            ) : (
              <form action="/api/stripe/checkout" method="POST">
                <input type="hidden" name="plan" value="yearly" />
                <button type="submit" className="btn btn-primary w-full">
                  {user ? "Switch to Yearly" : "Get Yearly Access"} <ChevronRight size={16} />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Trust row */}
        <div className="max-w-3xl mx-auto mt-10 grid grid-cols-3 gap-4 text-center">
          {[
            { icon: Shield, label: "Secure Payments", sub: "Powered by Stripe" },
            { icon: Star, label: "Cancel Anytime", sub: "No lock-in contracts" },
            { icon: CheckCircle, label: "10% to Charity", sub: "Guaranteed contribution" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="stat-card">
              <Icon size={18} className="text-blue-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-white">{label}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {!user && (
          <p className="text-center text-sm text-[var(--text-muted)] mt-8">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-semibold">
              Sign up free first
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
