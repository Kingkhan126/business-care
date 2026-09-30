# Architecture Overview

## Modular Monolith Design
BizEngine is structured as a **Modular Monolith** using Next.js 14 App Router. This approach balances simplicity, rapid developer velocity, and maintainability without premature microservice complexity.

```
       ┌─────────────────────────────────────────────────────────┐
       │                   Presentation Layer                    │
       │     (Next.js App Router, UI Components, AppShell)       │
       └────────────────────────────┬────────────────────────────┘
                                    │
       ┌────────────────────────────▼────────────────────────────┐
       │             Application Services & Validation           │
       │      (Zod Validation, AuthService, OrgService, etc.)    │
       └────────────────────────────┬────────────────────────────┘
                                    │
       ┌────────────────────────────▼────────────────────────────┐
       │             Authorization & Tenant Security             │
       │    (RBAC permission checks, assertTenantAccess guards)  │
       └────────────────────────────┬────────────────────────────┘
                                    │
       ┌────────────────────────────▼────────────────────────────┐
       │             Repositories & Database Access              │
       │        (UserRepository, OrgRepository, Prisma Client)   │
       └─────────────────────────────────────────────────────────┘
```

## Layer Responsibilities
1. **Presentation Layer (`app/`, `components/`)**: Handles UI rendering, responsive layouts, form interactions, and route navigation. Direct database queries inside client or UI components are strictly forbidden.
2. **Application Layer (`server/services/`, `lib/validation/`)**: Encapsulates business logic, input parsing, and workflow orchestration.
3. **Security Layer (`server/authorization/`, `middleware.ts`)**: Enforces server-side authentication, RBAC permission verification (`requirePermission`), and tenant boundary protection (`assertTenantAccess`).
4. **Data Access Layer (`server/repositories/`, `db/client.ts`)**: Encapsulates all Prisma database operations and parameter queries.
