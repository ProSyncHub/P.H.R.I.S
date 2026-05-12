# P.H.R.I.S Installation Guide

## Prerequisites

- Node.js 18+ or 20+
- PostgreSQL database
- Supabase project or another Postgres host
- Notion integration token if you want sync
- OpenAI API key if you want AI analysis

## Local Setup

```bash
npm install
copy .env.example .env
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

## Environment Variables

Required:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `OPENAI_API_KEY`

Optional but used by the app:

- `OPENAI_MODEL`
- `NOTION_API_KEY`
- `NOTION_DAILY_REPORTS_DATABASE_ID`
- `NOTION_EMPLOYEE_MASTER_DATABASE_ID`
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`

## Supabase Notes

- Use the transaction pooler URL for `DATABASE_URL`.
- Use the direct database URL for `DIRECT_URL`.
- Keep `DIRECT_URL` only for Prisma migrations and schema operations.

## Seeded Admin

The seed script creates:

- Email: `admin@prosync.local`
- Password: `Admin@12345`

Change that immediately after first login.

## Core Scripts

- `npm run dev` - start the app
- `npm run build` - production build
- `npm run start` - run the production server
- `npm run typecheck` - TypeScript check
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` - create a migration locally
- `npm run prisma:studio` - open Prisma Studio
- `npm run seed` - seed demo records
