# P.H.R.I.S

ProSync Human Resource Intelligence System.

P.H.R.I.S is an internal HR performance intelligence tool that turns Time Champ exports and manual EOD updates into structured daily and weekly performance reports. It is built for managers, HR teams, and operations leads who need a consistent way to review attendance, productivity, evidence alignment, and risk.

## What P.H.R.I.S Does

P.H.R.I.S helps you:

- Upload Time Champ detailed activity reports and login/logout reports.
- Paste a manual end-of-day report.
- Parse CSV and XLSX input into structured activity and attendance data.
- Generate a scored employee performance report.
- Compare system activity with the EOD narrative.
- Highlight gaps, mismatches, idle time, and off-task usage.
- Store reports in PostgreSQL through Prisma.
- Sync reports and employee data to Notion when configured.
- View archive pages for reports, employees, sync logs, and settings.
- Delete reports with an audit trail.

## Core Features

### Analysis Pipeline

- Validates upload type and size.
- Parses Time Champ activity data from CSV/XLS/XLSX.
- Parses login/logout data and attendance timing.
- Scores attendance, work hours, productive activity, EOD clarity, and EOD-to-system match.
- Uses OpenAI to produce strict JSON summaries when an API key is configured.
- Falls back to rule-based scoring when normalized AI output is missing.

### Report Output

Each report includes:

- Total system time and expected time coverage.
- Productive, unproductive, and idle split.
- Work-time-by-category breakdown.
- Task evidence mapped from EOD text to app and URL usage.
- Alignment and gap analysis.
- Final risk level and manager summary.
- Uploaded file metadata and Notion sync status.

### Employee Master

- Add and manage employees.
- Store employee ID, name, email, department, role, manager, and Notion page reference.
- Use the same identifier for Employee ID and Notion employee page ID when your workflow requires it.

### Authentication and Access

- Credentials-based login with Auth.js / NextAuth.
- Protected dashboard routes.
- Session-backed admin access.
- Admin seed user for first-time setup.

### Notion Sync

When configured with a Notion token and database IDs, P.H.R.I.S can:

- Create a daily report page in Notion.
- Link it to the matching employee record.
- Update employee master metadata such as latest score and latest risk.
- Track sync success, failure, and retry state.

## Main Screens

- Dashboard: recent analyses and summary metrics.
- Analyse Report: upload files, select an employee, and generate a report.
- Reports: archive of all generated reports with filters and deletion.
- Report Detail: full report view with time coverage, evidence, verdict, logs, and export.
- Employees: employee master list and create form.
- Notion Sync Logs: sync audit history.
- Settings: environment readiness checks.

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- Auth.js / NextAuth
- OpenAI API
- Notion API
- csv-parse and xlsx for file ingestion

## Installation

See [INSTALLATION.md](INSTALLATION.md) for the full setup guide.

Quick start:

```bash
npm install
copy .env.example .env
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

## Environment Variables

Use `.env.example` as the template.

Required:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `OPENAI_API_KEY`

Optional but supported:

- `OPENAI_MODEL`
- `NOTION_API_KEY`
- `NOTION_DAILY_REPORTS_DATABASE_ID`
- `NOTION_EMPLOYEE_MASTER_DATABASE_ID`
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`

## Default Seeded Admin

- Email: `admin@prosync.local`
- Password: `Admin@12345`

Change that immediately after the first login.

## Project Structure

- `app/` - routes, layouts, and API endpoints.
- `components/` - shared UI and action controls.
- `lib/` - Prisma client, security helpers, utilities.
- `services/` - parsing, AI, scoring, and Notion sync.
- `prisma/` - schema, seed, and migration SQL.
- `types/` - shared analysis types.

## Documentation

- [Installation Guide](INSTALLATION.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Deployment Guide](DEPLOYMENT.md)

## Operational Notes

- Uploads are validated and sanitized before processing.
- Report deletion removes the report and linked uploaded file rows.
- Audit logs capture major admin actions.
- Rate limiting is applied to analysis requests.
- AI output is treated as structured input, not final truth.

## Troubleshooting

- If login fails, verify `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and the seeded admin credentials.
- If migrations fail, confirm `DIRECT_URL` points to the direct PostgreSQL connection.
- If analysis fails, confirm `OPENAI_API_KEY` is present and the uploads are valid CSV/XLSX files.
- If Notion sync fails, confirm the Notion token and database IDs are configured with raw Notion database IDs.

## License

Internal project for ProSyncHub.
