# EmailP

A web application that connects to Gmail, extracts blood test results from lab report emails and PDF attachments, and generates AI-powered clinical summaries with interactive charts.

## How It Works

1. Sign in with Google (grants Gmail readonly access)
2. Search for a patient by name using the fill-in-the-blank query builder
3. App syncs matching emails, extracts PDF text (with OCR fallback), and identifies lab reports
4. OpenAI extracts 30+ blood metrics and generates a clinical summary with attention points
5. View interactive report with charts, trends, and severity indicators
6. Export as PDF, Excel, or send via email

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4 + Framer Motion
- **Database:** PostgreSQL 16 + Prisma 7 (adapter pattern)
- **Auth:** Auth.js (NextAuth v5 beta) with Google OAuth
- **AI:** OpenAI API (gpt-4o / gpt-4o-mini)
- **PDF:** pdfjs-dist + Tesseract.js OCR fallback
- **Charts:** Recharts
- **Queue:** pg-boss for background report generation
- **Email:** Resend (optional, for sending reports)

## Prerequisites

- Node.js 20+
- PostgreSQL 16 (or use Docker)
- Google Cloud project with Gmail API enabled
- OpenAI API key

## Setup

### 1. Clone and install

```bash
git clone https://github.com/can-q0/emailP.git
cd emailP
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in your credentials:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` for dev) |
| `NEXTAUTH_SECRET` | Random secret for session encryption |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `OPENAI_API_KEY` | OpenAI API key |
| `RESEND_API_KEY` | *(Optional)* Resend API key for email sending |

### 4. Set up database

```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/
    api/
      ai/generate-report/    Background report generation
      gmail/sync/             Gmail fetch, PDF extraction, DB upsert
      patients/               CRUD, disambiguation, merge, autocomplete
      reports/                List, PDF export, Excel export, email send
    dashboard/                Main app page with query builder
    query/                    Standalone query page
    report/[reportId]/        Report viewer with charts and export
    patients/                 Patient management
    settings/                 User preferences
  lib/
    prisma.ts                 Prisma client (PrismaPg adapter)
    gmail.ts                  Gmail API client with token refresh
    openai.ts                 AI classification, extraction, summary
    email-parser.ts           Body/PDF/metadata extraction
    blood-metrics.ts          Metric normalization and reference ranges
    pdf.ts                    PDF text extraction + OCR fallback
    queue.ts                  pg-boss job queue
    jobs/                     Background workers (report, PDF merge)
  config/
    query-templates.ts        Query builder template
    report-layouts.ts         12 layout configs (reportType x format)
    blood-metrics.ts          Reference ranges with age/gender adjustments
  components/
    query-builder/            Typewriter query builder UI
    report/                   Report sections (summary, charts, timeline)
    charts/                   Line metric charts
    ui/                       Shared UI components
  hooks/                      useQueryBuilder, useTypewriter, useGmailSearch
```

## Scripts

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```
