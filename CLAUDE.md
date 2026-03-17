# CLAUDE.md

## Build & Dev Commands

- `npm run dev` — Start Next.js dev server
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npx prisma migrate dev` — Create/apply migrations
- `npx prisma generate` — Regenerate Prisma client
- `docker compose up -d` — Start PostgreSQL

## Architecture

### Prisma 7 (Adapter Pattern)

The schema datasource has **no `url` property**. Database URL is configured in two places:

- **Migrations:** `prisma.config.ts` reads `DATABASE_URL` from env
- **Runtime:** `src/lib/prisma.ts` uses `new PrismaPg({ connectionString })` adapter

Generated client lives at `src/generated/prisma/client` — import via `@/generated/prisma/client`.

For JSON fields, use `JSON.parse(JSON.stringify(data))` to satisfy the Prisma type checker.

### Background Jobs

pg-boss handles two job types: `generate-report` and `merge-pdfs`. Workers are registered in `src/lib/workers.ts`. `next.config.ts` lists `pg-boss` in `serverExternalPackages`.

### Auth Flow

NextAuth v5 beta with Google OAuth. Requests `gmail.readonly` scope + `offline` access for refresh tokens. Tokens stored in `Account` table, auto-refreshed by `src/lib/gmail.ts`. On refresh failure, throws `GmailTokenError` which triggers a reconnect banner in the UI.

### Report Pipeline

1. User submits query (patient name + report type + format)
2. `/api/gmail/sync` — fetches Gmail messages + PDF attachments, extracts text, upserts to DB
3. `/api/patients/disambiguate` — resolves patient identity
4. `/api/ai/generate-report` — enqueues pg-boss job
5. `src/lib/jobs/process-report.ts` — extracts blood metrics via OpenAI, generates summary, caches metrics across reports sharing the same emails

### Report Types & Formats

- **Types:** `"all emails"`, `"detailed report"`, `"comparison"`, `"plain PDF"`
- **Formats:** `"summary"`, `"detailed"`, `"graphical"`
- 12 distinct layout configs in `src/config/report-layouts.ts`

## Key Files

| File | Purpose |
|---|---|
| `src/auth.ts` | NextAuth configuration |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/gmail.ts` | Gmail API client with auto token refresh |
| `src/lib/openai.ts` | AI prompts for classification, extraction, summary |
| `src/lib/email-parser.ts` | Email body, PDF parts, forwarding headers, metadata |
| `src/lib/blood-metrics.ts` | Metric normalization + reference ranges |
| `src/lib/pdf.ts` | PDF text extraction (pdfjs-dist + Tesseract.js OCR) |
| `src/config/report-layouts.ts` | Layout configs per reportType x format |
| `src/config/blood-metrics.ts` | Reference ranges with age/gender adjustments |

## Code Conventions

- App Router with `"use client"` directives only where needed
- Zod validation on all API inputs (`src/lib/validations.ts`)
- Rate limiting on sync (10/min) and report generation (5/min)
- Recharts Tooltip formatter: don't annotate the `value` parameter type explicitly
- Turkish lab terminology normalized to English metric names in `blood-metrics.ts`

## Environment Variables

```
DATABASE_URL=postgresql://emailp:emailp@localhost:5432/emailp
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<secret>
GOOGLE_CLIENT_ID=<google>
GOOGLE_CLIENT_SECRET=<google>
OPENAI_API_KEY=<openai>
RESEND_API_KEY=<optional>
```
