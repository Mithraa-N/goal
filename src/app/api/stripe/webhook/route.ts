import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Use service role key for webhooks — bypasses RLS
function getAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("CRITICAL VULNERABILITY: Missing Supabase Admin Keys");
  }
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request: NextRequest) {
  const { checkRateLimit } = await import("@/lib/rate-limit");
  const ip = request.headers.get("x-forwarded-for") ?? "webhook-ip";
  // Max 50 requests per minute from webhook IPs to prevent spam
  if (!(await checkRateLimit(`webhook_${ip}`, 50, 60 * 1000))) {
    return NextResponse.json({ error: "Too many webhook requests" }, { status: 429 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  let stripe: Stripe;

  try {
    stripe = getStripe();
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("STRIPE_WEBHOOK_SECRET map is missing");
    }
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed or env missing:", err);
    return NextResponse.json({ error: "Invalid signature or init failed" }, { status: 400 });
  }

  const supabase = getAdminClient();

  // IDEMPOTENCY CHECK
  const { data: existingEvent } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .single();

  if (existingEvent) {
    console.log(`Event ${event.id} already processed. Skipping.`);
    return NextResponse.json({ received: true, skipped: true });
  }
  
  // Record event to prevent double processing
  await supabase.from("stripe_events").insert({ id: event.id, type: event.type });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription as string;
        const userId = session.metadata?.supabase_user_id ?? 
          ((session as any).subscription_data as unknown as { metadata?: { supabase_user_id?: string } })?.metadata?.supabase_user_id;

        if (!userId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const planType = subscription.metadata?.plan_type ?? "monthly";
        const currentPeriodEnd = (subscription as any).current_period_end || subscription.items?.data?.[0]?.current_period_end || Math.floor(Date.now() / 1000);

        await supabase.from("subscriptions").upsert({
          user_id: userId,
          stripe_subscription_id: subscriptionId,
          plan_type: planType,
          status: subscription.status,
          current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
        }, { onConflict: "stripe_subscription_id" });

        // FINANCIAL LEDGER: Balanced Double-Entry Group
        const amountPaid = session.amount_total ? session.amount_total / 100 : 0;
        const entryGroupId = crypto.randomUUID();
        
        await supabase.from("financial_ledger").insert([
          {
            entry_group_id: entryGroupId,
            user_id: userId,
            account: "user_wallet",
            type: "debit",
            amount: amountPaid,
            category: "subscription",
            metadata: { stripe_session_id: session.id }
          },
          {
            entry_group_id: entryGroupId,
            account: "system_revenue",
            type: "credit",
            amount: amountPaid,
            category: "subscription",
            metadata: { stripe_subscription_id: subscriptionId }
          }
        ]);

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        const status = subscription.status === "active" ? "active" :
          subscription.status === "past_due" ? "past_due" :
          subscription.status === "canceled" ? "canceled" : "inactive";

        const currentPeriodEnd = (subscription as any).current_period_end || subscription.items?.data?.[0]?.current_period_end || Math.floor(Date.now() / 1000);

        await supabase.from("subscriptions").update({
          status: subscription.status,
          current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
        }).eq("stripe_subscription_id", subscription.id);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        await supabase.from("subscriptions").update({
          status: "canceled",
        }).eq("stripe_subscription_id", subscription.id);

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: userData } = await supabase
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        // Subscriptions auto-update in Stripe, which issues customer.subscription.updated to past_due
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Even if handler errors, we might want to delete the idempotency key so it retries, 
    // but in Stripe it's usually better to let it fail and retry and we delete it on catch.
    await supabase.from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
