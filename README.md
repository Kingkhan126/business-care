# BizEngine — Industrial Business Management & Accounting Platform

A production-grade, multi-tenant business management and accounting platform built with Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, and Prisma ORM.

> **Phase 1 Status**: Industrial Engineering Foundation Completed. Includes multi-organization architecture, granular role-based access control (RBAC), server-side tenant isolation, responsive application shell, original design system, development seed system, audit log framework, and unit testing foundation.

---

## 1. What the Project Is

**BizEngine** is a comprehensive business management and accounting platform designed for non-technical business owners, accountants, sales, and operations teams. It serves as an integrated system for managing customers, vendors, estimates, invoices, payments, inventory, purchase orders, expenses, banking feeds, general ledger accounting, financial statements, and predictive forecasting.

Phase 1 establishes the **Industrial Foundation** upon which future business modules will be incrementally built.

---

## 2. Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Backend**: Next.js Server Components, Server Actions, Route Handlers, Zod Validation
- **Database & ORM**: PostgreSQL, Prisma ORM (Typed client & migration engine)
- **Authentication & Security**: HTTP-only JWT session cookies (`jose`), bcrypt password hashing (Cost 12), Server-side tenant isolation guards
- **Testing**: Vitest unit test suite
- **Tooling**: ESLint, TypeScript (Strict Mode), npm scripts

---

## 3. Prerequisites

- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x` or higher
- **PostgreSQL**: A running PostgreSQL instance (local or hosted, e.g., Neon, Supabase, RDS)

---

## 4. Installation

```bash
# 1. Clone or navigate to the repository
cd app-platform

# 2. Install dependencies
npm install

# 3. Environment configuration
cp .env.example .env
```

---

## 5. Environment Variables

Create `.env` in the root directory:

```env
# Primary PostgreSQL Database Connection URL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bizengine_db?schema=public"

# Session Secret Key (Must be at least 32 characters in production)
AUTH_SECRET="industrial-super-secret-key-32chars-minimum!!"

# Application Base URL
APP_URL="http://localhost:3000"

# Node Environment
NODE_ENV="development"
```

---

## 6. Database Setup & Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Apply migrations / push schema
npx prisma db push

# Create production migration
npx prisma migrate dev --name init_phase1_foundation
```

---

## 7. Development Seed System

Populates system permissions, default roles (Owner, Admin, Manager, Accountant, Member, Viewer), a demo organization (*Acme Global Enterprises*), demo users, and initial audit logs.

```bash
npm run prisma:seed
```

### Seed Account Credentials:
- **Owner**: `owner@acme.com` / `Password123!`
- **Admin**: `admin@acme.com` / `Password123!`
- **Staff Member**: `staff@acme.com` / `Password123!`

---

## 8. Development Commands

```bash
# Start local development server
npm run dev

# Run TypeScript type check
npx tsc --noEmit

# Run ESLint
npm run lint
```

---

## 9. Testing

Execute the Vitest unit test suite covering RBAC authorization, tenant isolation, Zod validation, and password/JWT utilities:

```bash
npm test
```

---

## 10. Production Build

Verify production compilation:

```bash
npm run build
npm run start
```

---

## 11. Architecture Overview

The codebase is organized with strict separation between presentation, application logic, domain services, database access, and infrastructure:

```
app-platform/
├── app/
│   ├── (auth)/              # Login and Register pages
│   ├── (dashboard)/         # AppShell wrapped pages (Dashboard, Org, Users, Audit, Settings)
│   ├── api/                 # Route handlers (Auth, Organization, Health)
│   ├── layout.tsx           # Root HTML layout
│   └── page.tsx             # Root page (redirect handler)
├── components/
│   ├── ui/                  # Design system (Button, Input, Select, Card, Badge, Dialog, Table, etc.)
│   ├── layout/              # AppShell, Header, Sidebar, OrganizationSwitcher, UserMenu
│   └── shared/              # FutureDomainPlaceholder
├── server/
│   ├── authorization/       # RBAC & tenant isolation security guards
│   ├── repositories/        # Database access abstractions (UserRepository, OrgRepository, etc.)
│   └── services/            # Business domain services (AuthService, OrgService, AuditService)
├── db/
│   ├── client.ts            # Singleton Prisma Client
│   └── seed/                # Seed scripts
├── lib/
│   ├── auth/                # JWT session management & password hashing
│   ├── errors/              # Application error hierarchy
│   ├── logging/             # Structured logger with sensitive data redaction
│   ├── utils/               # Class merging & formatting utilities
│   └── validation/          # Zod validation schemas
├── types/                   # Domain TypeScript interfaces
└── docs/                    # Architecture, Database, Security, Development & Roadmap docs
```

---

## 12. Phase 1 Scope & Implementation Checklist

- [x] Next.js 14 App Router TypeScript Foundation
- [x] Responsive Application Shell (360px to 1440px+)
- [x] Custom Business SaaS Design System (`components/ui/`)
- [x] PostgreSQL & Prisma Schema (`User`, `Organization`, `OrganizationMember`, `Role`, `Permission`, `RolePermission`, `AuditLog`)
- [x] Development Seed System (`prisma/seed.ts`)
- [x] Server-Side Tenant Isolation (`assertTenantAccess`)
- [x] Granular Role-Based Access Control (`hasPermission`, `requirePermission`)
- [x] Secure JWT Cookie Session Management
- [x] Structured Logging Abstraction with Sensitive Data Redaction
- [x] Error Handling Hierarchy & Boundary UI
- [x] Unit Testing Setup & Passing Test Suite
- [x] Architecture & Engineering Documentation (`docs/`)

---

## 13. Future Phase Roadmap

- **Phase 2 — Commercial Core**: Customers, Sales Quotes / Estimates, Invoices, Payments & Receivables.
- **Phase 3 — Procurement & Inventory**: Vendors, Purchase Orders, Goods Receipt, Product Catalog, Warehouse Inventory.
- **Phase 4 — Financials & Accounting**: Expense Management, Bank Feeds, Chart of Accounts, Double-Entry General Ledger.
- **Phase 5 — Intelligence & Forecasting**: Profit & Loss Statements, Balance Sheets, Cash Flow Forecasting, Predictive Analytics.
