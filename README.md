# Applications Platform

A production-oriented replacement for a Google Form application workflow: multi-step form with drafts,
document upload, submission with reference numbers, status tracking, and an admin console.

> **Note on form content:** no source Google Form was provided when this was built. The application form in
> `lib/forms/definition.ts` is a representative placeholder (personal info → contact → employment status with
> conditional fields → documents). The form UI, validation, review screen, and admin views are all
> **schema-driven** from that one file — replacing it with your real questions does not require touching any
> other code.

## Features implemented

- Email/password auth: bcrypt hashing, signed JWT session cookies, rate-limited login, generic error messages
- Route-protecting middleware (server-side; role checks are re-verified in every route handler too)
- Multi-step application wizard with autosave, save-and-resume drafts, conditional fields, review step, and
  confirmation-before-submit
- Idempotent submission (no duplicate records on double-click), auto-generated reference numbers
  (`APP-YYYY-XXXXXX`)
- Centralized application status model with a single source of truth for legal transitions
  (`lib/applications/status.ts`)
- Document upload with MIME + magic-byte validation, random non-guessable storage keys, and short-lived
  signed download URLs (local-disk storage for dev — see "Known limitations")
- Admin console: applications list (search/filter/pagination), application detail with status change +
  history, CSV export, user management (role/active toggles)
- Audit logging for status changes, application views, exports, and role changes
- IDOR-safe authorization: every application/document access is checked against the caller's own user id
  (or admin role) server-side — never trust a URL parameter or client-supplied role
- Unit tests for status transitions, permission checks, and schema-driven validation (including conditional
  field stripping)

## Known limitations (explicitly not implemented — not faked)

- **Object storage**: uses local disk (`storage/uploads/`) via a small `ObjectStorage` interface
  (`lib/storage/index.ts`). Swap in an S3/GCS-backed implementation of that interface for production; no
  caller code needs to change.
- **Email notifications**: only in-app-shaped data exists (no email sending). `Notification` model is in the
  schema; wiring an email provider is a follow-up.
- **Rate limiting**: in-memory, single-instance only. Replace with a shared store (e.g. Upstash Redis) before
  running multiple server instances.
- **E2E tests**: only unit tests are included. Integration/E2E (Playwright) would be the next addition.
- **Forgot/reset password**: pages are not implemented; only login/register/logout exist.

## Tech stack

Next.js (App Router) · TypeScript · PostgreSQL · Prisma · Tailwind CSS · Zod · React Hook Form patterns
(implemented directly with `useState` for this form; swap to `react-hook-form` if you prefer)

## Local development

```bash
npm install
cp .env.example .env
# edit .env: set DATABASE_URL to a real Postgres instance, and AUTH_SECRET
# generate a secret with: openssl rand -base64 32

npx prisma generate
npx prisma db push        # creates tables from prisma/schema.prisma
npm run prisma:seed       # creates an admin + sample user + sample applications

npm run dev
```

Seed accounts:
- Admin: `admin@example.com` / `AdminPass123!`
- User: `applicant@example.com` / `UserPass123!`

## Testing

```bash
npm test
```

## Production deployment (Vercel + managed Postgres)

1. Provision a PostgreSQL database (Neon, Supabase, RDS, etc.) and set `DATABASE_URL` in Vercel's
   environment variables.
2. Set `AUTH_SECRET` to a long random value (never reuse the dev value).
3. Run `npx prisma migrate deploy` against production as part of your deploy step.
4. Replace `lib/storage/index.ts`'s `LocalDiskStorage` with an S3/GCS implementation before deploying —
   local disk storage does not persist across serverless invocations.
5. Ensure cookies are only ever set over HTTPS (already handled: `secure` is `true` when
   `NODE_ENV === "production"`).

## Architecture

```
app/
  (marketing)/        landing, privacy, terms, contact
  (auth)/              login, register
  dashboard/            user dashboard
  application/          new draft + multi-step wizard + read-only summary
  admin/                overview, applications, users
  api/                  auth, applications, documents, admin routes
lib/
  auth/                password hashing, session/JWT, rate limiting
  db/                   Prisma client singleton
  forms/                schema-driven form definition (swap this for your real form)
  validation/           Zod schemas generated from the form definition
  applications/         centralized status transition model
  permissions/           authorization checks (IDOR prevention)
  storage/               object storage interface + local dev implementation, signed URLs, file-signature check
prisma/
  schema.prisma          database schema
  seed.ts                 dev seed data
tests/unit/               status, permissions, validation tests
```

## Database schema summary

`User` → `Application` (1:many) → `ApplicationStatusHistory`, `Document`, `AdminNote` (1:many each).
`AuditLog` references the acting `User`. Indexes on `email`, `referenceNumber`, `status`, `createdAt`, and
foreign keys.

## Permission model

- `USER`: create/edit own drafts, submit own applications, view own application status and history
- `ADMIN`: everything a user can do, plus view/search all applications, change status (only along legal
  transitions), add internal notes, manage users, export data
- Every check happens server-side in the route handler / server component, using the session's signed role
  — middleware is an additional layer, not the only one
