# P.H.R.I.S Deployment Guide

## 1. Supabase Database

Create a Supabase project and use its PostgreSQL database.

In Supabase, open **Project Settings -> Database -> Connection string**.

Use:

- **Transaction pooler** for `DATABASE_URL`
- **Direct connection** for `DIRECT_URL`

Recommended Vercel runtime URL:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
```

Recommended Prisma migration URL:

```env
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
```

## 2. Vercel Environment Variables

Add:

```env
DATABASE_URL=
DIRECT_URL=
SUPABASE_URL=https://zvxwnkkchlcpjoecjmxl.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://zvxwnkkchlcpjoecjmxl.supabase.co
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://your-domain.vercel.app
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
NOTION_API_KEY=
NOTION_DAILY_REPORTS_DATABASE_ID=
NOTION_WEEKLY_REPORTS_DATABASE_ID=
NOTION_EMPLOYEE_MASTER_DATABASE_ID=
CRON_SECRET=
```

## 3. Migrate

Run from a trusted machine with Supabase `DATABASE_URL` and `DIRECT_URL` configured:

```bash
npx prisma migrate deploy
npx prisma generate
```

## 4. Admin User

For a first deployment, run:

```bash
npm run seed
```

Then replace the seeded admin password or create your own secure admin bootstrap flow.

## 5. Weekly Automation

If you want scheduled weekly generation, set `CRON_SECRET` and call `POST /api/weekly/cron` from your scheduler with the header `x-cron-secret: <secret>`.

## 6. Deploy

Push the repository to GitHub and import it into Vercel. Build command:

```bash
npm run build
```

Output is handled by Next.js.
