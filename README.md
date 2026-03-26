# Golf Charity Platform (GolfDraw)

A subscription-based Golf Charity Platform built with Next.js App Router, Supabase, Tailwind CSS, and Stripe.

## Features Built
- 🔐 **Authentication**: Supabase Auth (Sign up, Log in, protected routes).
- 💳 **Subscriptions**: Stripe billing integration (monthly/yearly), webhooks for syncing status. Only active subscribers can enter scores or draws.
- ⛳ **Scores**: Rolling 5-score logic, automatically removing the 6th oldest score using Postgres triggers.
- ❤️ **Charities**: Users can choose a charity, enforce min 10% contribution, updating profiles.
- 🏆 **Draw Engine**: Admin dashboard to simulate or execute draws (Random or Frequency mode). Automatically splits prize pools (40% for 5-match, 35% for 4-match, 25% for 3-match) and handles rollovers.
- 🔍 **Verification**: Winners can upload proof of identity/score. Admins can approve and mark as paid.

## Prerequisites
- Node.js 18+
- Supabase Account
- Stripe Account
- Vercel Account (for deployment)

## Local Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env.local` and fill in the values:
   ```bash
   cp .env.example .env.local
   ```
   You will need:
   - Supabase URL & Anon Key
   - Supabase Service Role Key (for webhooks & admin cron jobs)
   - Stripe Secret Key & Publishable Key
   - Stripe Webhook Secret
   - Stripe Price IDs for Monthly & Yearly plans

3. **Database Setup**:
   Run the SQL script `phase_2_database.sql` located in the `brain` directory in your Supabase SQL Editor to set up all tables, enums, indexes, and triggers.

4. **Stripe Setup**:
   - Create two products/prices in Stripe (Monthly and Yearly).
   - Get your Price IDs and place them in `.env.local`.
   - Setup a Stripe Webhook pointing to `<your-ngrok-url>/api/stripe/webhook` during local dev, or `<your-vercel-url>/api/stripe/webhook` in prod. Map it to listen to `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed`.

5. **Run the local dev server**:
   ```bash
   npm run dev
   ```

## Admin Setup
1. Sign up as a normal user.
2. Go to your Supabase table `users` and set `is_admin = true` for your account.
3. You can now access the Admin Panel at `/admin`.

## Deployment to Vercel
1. Push your code to GitHub.
2. Import the project in Vercel.
3. Add all environment variables from `.env.local` to the Vercel project settings.
4. Deploy!

## Draw Engine Execution
In production, you can trigger the draw engine automatically by setting up a Supabase Edge Function with `pg_cron`, or using Vercel Cron to send a POST request to `https://<your-vercel-url>/api/admin/draw` with the header `x-admin-secret: <SUPABASE_SERVICE_ROLE_KEY>`.
