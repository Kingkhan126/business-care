# Production Deployment Guide & Operations Runbook

**Platform:** BizEngine — Production-grade Business Management & Accounting Platform  
**Target Environments:** Vercel (Serverless Edge) / AWS ECS / Docker / Traditional Node.js  
**Database:** PostgreSQL 14+ with Connection Pooling (PgBouncer)  
**Object Storage:** S3-Compatible Cloud Storage (Cloudflare R2 / AWS S3 / MinIO)  

---

## 1. Local Development Setup

### Prerequisites
- Node.js `>= 20.14.0` (LTS recommended)
- PostgreSQL 14+ running locally or in Docker
- npm 10+

### Step-by-Step Local Initialization
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy environment template:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` with your local database connection and auth secret:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/bizengine_db?schema=public"
   AUTH_SECRET="development-secret-key-32chars-minimum!!"
   NODE_ENV="development"
   APP_URL="http://localhost:3000"
   ```
4. Generate Prisma Client and apply migrations:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```
5. Seed initial roles, permissions, chart of accounts, and master data:
   ```bash
   npm run prisma:seed
   ```
6. Start the development server:
   ```bash
   npm run dev
   ```

---

## 2. Production Database Architecture

### Requirements
- **PostgreSQL Version:** 14 or higher.
- **SSL:** `sslmode=require` must be configured for all cloud-hosted database connections.
- **Connection Pooling:** Serverless functions (e.g. Vercel) scale horizontally and create new connections per invocation. A connection pooler (e.g., PgBouncer, Neon pooling endpoint, Supabase port 6543, or AWS RDS Proxy) is mandatory to prevent connection exhaustion (`max_connections`).

### Connection String Format
```text
postgresql://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require&connection_limit=10&pgbouncer=true
```

---

## 3. Prisma Production Schema Deployment

### Development vs Production Command Policy
- **Development:** Use `npx prisma migrate dev` when iterating on `prisma/schema.prisma`.
- **Production CI/CD:** **NEVER** use `prisma db push` or `prisma migrate dev` on a production database. Always use the idempotent, non-destructive deployment command:
  ```bash
  npm run prisma:deploy
  # equivalent to: npx prisma migrate deploy
  ```

### Migration History
- All schema changes are tracked under [`prisma/migrations`](file:///d:/app-platform/prisma/migrations).
- Baseline migration: `prisma/migrations/0_init/migration.sql` captures the certified Phase 1–7 schema.

---

## 4. Environment Variables Reference

| Variable | Required | Scope | Purpose |
| :--- | :---: | :---: | :--- |
| `DATABASE_URL` | **Yes** | Server | PostgreSQL connection URI with pooling & SSL enabled. |
| `AUTH_SECRET` | **Yes** | Server | 32+ character HMAC-SHA256 secret. Application aborts in production if omitted. |
| `NODE_ENV` | **Yes** | Server | Must be set to `production` on deployment hosts. |
| `APP_URL` | Recommended | Server | Canonical public domain URL (e.g. `https://app.yourcompany.com`). |
| `PORT` | Optional | Server | Internal port (defaults to `3000`). |
| `S3_BUCKET` | **Yes** (Serverless) | Server | S3/R2 bucket name for persistent receipts and logos. |
| `S3_REGION` | **Yes** (Serverless) | Server | Storage region (`us-east-1` for AWS, `auto` for Cloudflare R2). |
| `S3_ACCESS_KEY_ID` | **Yes** (Serverless) | Server | Storage provider API access key ID. |
| `S3_SECRET_ACCESS_KEY`| **Yes** (Serverless) | Server | Storage provider API secret access key. |
| `S3_ENDPOINT` | Optional | Server | Custom endpoint URL (required for Cloudflare R2 / MinIO). |

---

## 5. Cloud Object Storage Setup (Cloudflare R2 / AWS S3)

To ensure uploaded expense receipts, invoices, and organization logos persist across serverless restarts:

### Option A: Cloudflare R2 (Recommended — Zero Egress Fees)
1. In the Cloudflare dashboard, navigate to **R2** and create a bucket: `bizengine-production`.
2. Generate an **R2 API Token** with `Object Read & Write` permissions.
3. Configure environment variables:
   ```env
   S3_BUCKET="bizengine-production"
   S3_REGION="auto"
   S3_ACCESS_KEY_ID="<your-r2-access-key-id>"
   S3_SECRET_ACCESS_KEY="<your-r2-secret-access-key>"
   S3_ENDPOINT="https://<your-account-id>.r2.cloudflarestorage.com"
   ```

### Option B: AWS S3
1. Create an AWS S3 bucket: `bizengine-production` with **Block Public Access: ON**.
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` policies on the bucket.
3. Configure environment variables:
   ```env
   S3_BUCKET="bizengine-production"
   S3_REGION="us-east-1"
   S3_ACCESS_KEY_ID="<your-aws-access-key>"
   S3_SECRET_ACCESS_KEY="<your-aws-secret-key>"
   S3_ENDPOINT=""
   ```

---

## 6. Vercel Deployment Runbook

1. **Import Repository:** Connect GitHub/GitLab repository to Vercel.
2. **Framework Preset:** Select `Next.js`.
3. **Build & Output Settings:**
   - Build Command: `npm run build`
   - Install Command: `npm install`
4. **Environment Variables:**
   - Add `DATABASE_URL`, `AUTH_SECRET`, `NODE_ENV=production`, `APP_URL`.
   - Add S3 storage variables (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`).
5. **Database Migration Step:**
   - Run `npx prisma migrate deploy` in your CI/CD pipeline or via deployment hook before traffic cutover.
6. **Deploy & Verify:**
   - Verify health check at `https://your-domain.vercel.app/api/health` returns status `200` with `status: "healthy"`.

---

## 7. Docker / Container Deployment Runbook

For sovereign self-hosting on AWS ECS, GCP Cloud Run, or Kubernetes:

```dockerfile
# Multi-stage production Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["npm", "run", "start"]
```

---

## 8. Operational Health, Monitoring & Rollbacks

- **Liveness & Readiness Probe:** `GET /api/health`
  - Validates active database connectivity via `SELECT 1`.
  - Returns HTTP 200 `{ status: "healthy", database: "connected" }`.
  - Returns HTTP 503 on database disconnection.
- **Rollback Procedure:**
  - Code rollback: Re-deploy previous Git commit tag in Vercel or roll back container image tag.
  - Schema rollback: Prisma migrations are designed additively; if needed, apply compensating migration scripts.
