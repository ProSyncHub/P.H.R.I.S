# P.H.R.I.S Architecture

## Main Areas

- `app/` - Next.js App Router pages, layouts, and API routes
- `components/` - shared UI components and action buttons
- `lib/` - Prisma client, security, utilities, and rate limiting
- `services/` - report parsing, AI analysis, scoring, and Notion sync
- `prisma/` - schema, seed, and migration SQL
- `types/` - shared TypeScript types

## Data Flow

1. Admin logs in through Auth.js credentials login.
2. Admin uploads Time Champ activity and login/logout files plus manual EOD.
3. `services/report-parser.ts` extracts structured activity and attendance data.
4. `services/openai-analysis.ts` generates the final JSON report.
5. Prisma stores the report, flags, uploaded file metadata, and audit log.
6. `services/notion-sync.ts` writes the analysis to Notion if configured.
7. The dashboard and report archive render from Prisma data.

## Database Model

Key models:

- `User` - Auth.js users
- `Employee` - employee master records
- `DailyAnalysis` - generated report record
- `UploadedReport` - stored file metadata
- `AnalysisFlag` - structured flags from analysis
- `NotionSyncLog` - sync audit trail
- `AuditLog` - application audit trail

## Design Notes

- The report page mirrors the sample report structure:
  - time coverage
  - category breakdown
  - EOD/system alignment
  - task evidence
  - verdict and key signals
- Deletion is handled by a server action and cascades related records safely.
