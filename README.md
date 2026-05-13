# Prosync HR Intelligence System (P.H.R.I.S)

AI-powered employee performance intelligence system for analysing Time Champ activity reports, login/logout reports, and manual EOD submissions.
It now also generates weekly reports from the daily analyses already stored in the system, so managers can review each employee or department on a Monday-Sunday cycle.

## Stack

- Next.js 15 App Router, React, TypeScript
- Tailwind CSS with shadcn-style UI primitives
- NextAuth/Auth.js credentials auth
- Prisma ORM with PostgreSQL
- OpenAI API via backend service layer
- Notion API sync service
- CSV/XLSX parsing for Time Champ exports
- Weekly reporting and archive views

## Local Setup With Supabase

```bash
cd D:\ProSync\phris
npm install
copy .env.example .env
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

Use Supabase for PostgreSQL:

- `SUPABASE_URL`: Supabase project API URL.
- `DATABASE_URL`: Supabase transaction pooler URL. Use this for the running app, especially on Vercel.
- `DIRECT_URL`: Supabase direct connection URL. Prisma uses this for migrations.

In Supabase, find these under **Project Settings -> Database -> Connection string**.

For `DATABASE_URL`, choose the **Transaction pooler** connection string and append:

```txt
?pgbouncer=true&connection_limit=1
```

For `DIRECT_URL`, choose the direct database connection string.

Default seeded admin:

- Email: `admin@prosync.local`
- Password: `Admin@12345`

## Environment Variables

```env
DATABASE_URL=
DIRECT_URL=
SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
NOTION_API_KEY=
NOTION_DAILY_REPORTS_DATABASE_ID=
NOTION_WEEKLY_REPORTS_DATABASE_ID=
NOTION_EMPLOYEE_MASTER_DATABASE_ID=
CRON_SECRET=
```

## Phase 1 Flow

1. Admin logs in.
2. Admin selects employee and date.
3. Admin uploads Time Champ Detailed Activity and Login/Logout reports.
4. Admin pastes Manual EOD.
5. Backend validates and parses uploads.
6. OpenAI generates strict JSON analysis.
7. Prisma saves the final report, uploaded report metadata, flags, and audit log.
8. Notion sync runs; failures keep the local report and mark retry status.
9. Dashboard, daily archive, and weekly archive update.

## Weekly Reporting

Weekly reports are generated from daily analyses already in Prisma.

- Employee weekly reports summarize one employee's Monday-Sunday activity.
- Department weekly reports combine all daily analyses for a department in the same week.
- Weekly reports include coverage, score trend, recurring flags, source daily reports, and Notion sync logs.
- The dashboard has a Weekly Reports archive with manual generation and deletion.
- A cron endpoint is available at `/api/weekly/cron` for scheduled generation using `CRON_SECRET`.

## Deployment

1. Create a PostgreSQL database on Supabase.
2. Add all environment variables in Vercel.
3. Run Prisma migration against the production database.
4. Deploy to Vercel.
5. Seed the admin user through a secure one-time migration or remove the seed user and create an admin through your internal process.

## Security Notes

- OpenAI and Notion calls are backend-only.
- Uploads are size/type validated.
- Admin routes and APIs are protected by Auth.js middleware.
- Report parsing sanitizes cell values.
- Audit logs track core admin actions.
- Rate-limit hooks can be added around `/app/api/analyse/route.ts` before public rollout.
