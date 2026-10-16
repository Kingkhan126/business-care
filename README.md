# BizEngine

A multi-organization business management and accounting application built with Next.js 14, React 18, TypeScript, PostgreSQL, and Prisma.

## Implemented modules

- Organizations, team membership, roles, invitations, and audit logs
- Customers, estimates, sales orders, invoices, customer payments, and credits
- Suppliers, purchase orders, vendor bills, vendor payments, and credits
- Product/service catalog, warehouses, stock balances, and adjustments
- Chart of accounts, journal entries, posting, reversals, and accounting periods
- General ledger, trial balance, profit and loss, and balance sheet
- Bank accounts, CSV imports, transaction matching, transfers, and reconciliation
- Direct expenses, employee claims, approvals, posting, payment, and receipt attachments
- A permission-aware dashboard using ledger financial totals

Forecasting, the general Reports hub, and the legacy Purchases landing page remain placeholders. Financial statements are available under Accounting. Provider-connected bank feeds and foreign-exchange conversion are not implemented.

## Local setup

Requirements: Node.js 20 or 22, npm, PostgreSQL, and optionally S3-compatible storage.

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and configure a local `DATABASE_URL`, a strong `AUTH_SECRET`, `APP_URL=http://localhost:3000`, and `NODE_ENV=development`.
3. Apply committed migrations with `npm run prisma:deploy`.
4. Initialize a new development database with `npm run prisma:seed`.
5. Start the application with `npm run dev`.

The development seed creates demo accounts including `owner@acme.com`, `admin@acme.com`, and `staff@acme.com` with password `Password123!`. Use it only in a dedicated development database.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run check` runs these checks together. Unit tests mock database delegates; PostgreSQL integration tests run separately:

```powershell
$env:TEST_DATABASE_URL = "postgresql://USER:PASSWORD@localhost:5432/bizengine_integration_test"
npm run test:integration
```

Create that dedicated database first. Its name must end with `_test`. The integration command applies migrations only to `TEST_DATABASE_URL` and verifies real concurrency, rollback, tenant references, report reversals, safe responses, and dashboard access. Test fixtures are isolated by run and cleaned up without truncating the database. The suite uses temporary database triggers to inject persistence failures, so its database user must own the test schema.

GitHub Actions runs type checks, lint, unit tests, PostgreSQL integration tests, and the production build on pull requests and pushes to main/master.

## Architecture

- `app/`: pages, API route handlers, and application entry points
- `components/`: interface components and application shell
- `server/services/`: authorization, workflows, calculations, and transactions
- `server/repositories/`: database access
- `lib/validation/`: request schemas and pagination validation
- `lib/auth/`: sessions, password hashing, and signing configuration
- `lib/storage/`: local disk and S3-compatible attachments
- `prisma/`: schema, migrations, and development seed
- `tests/unit/`, `tests/integration/`: verification suites

See [architecture](docs/architecture.md), [deployment](docs/deployment.md), and [reliability changes](docs/reliability.md).

## Deployment

Configure PostgreSQL, a production `AUTH_SECRET` of at least 32 characters, and persistent storage. Apply migrations with `npm run prisma:deploy` before starting the new application version, then run `npm run build` and `npm start`.

The document counter migration is required for document creation. It allocates numbers atomically within each document transaction and initializes above existing imported numbers. Deploy every writer together; older application versions still use count-based numbering and must not keep writing during the rollout.

The dashboard labels receivables, unpaid expenses, and cash totals in the organization's currency and excludes other currencies from those totals. Individual bank accounts retain their own currency. No exchange rate is assumed.

Vercel uses the committed `vercel.json` build command (`npm run vercel-build`) to apply migrations before building the new release. Set `DIRECT_URL` for migrations if the runtime URL uses a pooler, and use a separate database for each preview environment. `/api/health` checks both database connectivity and the required numbering table.
