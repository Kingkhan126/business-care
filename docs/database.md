# Database & Schema Architecture

## Schema ERD Overview (Phase 1)

```mermaid
erDiagram
    User ||--o{ OrganizationMember : "has"
    User ||--o{ AuditLog : "acts"
    Organization ||--o{ OrganizationMember : "owns"
    Organization ||--o{ Role : "defines"
    Organization ||--o{ AuditLog : "records"
    Role ||--o{ OrganizationMember : "assigns"
    Role ||--o{ RolePermission : "contains"
    Permission ||--o{ RolePermission : "mapped"

    User {
        string id PK
        string email UK
        string passwordHash
        string name
        enum status
    }

    Organization {
        string id PK
        string name
        string currency
        string timezone
    }

    OrganizationMember {
        string id PK
        string organizationId FK
        string userId FK
        string roleId FK
        enum status
    }

    Role {
        string id PK
        string organizationId FK
        string name
        boolean isSystem
    }

    Permission {
        string id PK
        string code UK
        string category
    }

    AuditLog {
        string id PK
        string organizationId FK
        string actorId FK
        string action
    }
```

## Multi-Tenant Isolation Strategy
- **Shared Database, Shared Schema**: Every tenant entity is explicitly associated with an `organizationId`.
- **Query Scoping**: Server-side repository methods and `assertTenantAccess` enforce that `organizationId` matches the authenticated session's `activeOrganizationId`.
- **Foreign Key Cascade & Deletion Safeguards**: Referential integrity is enforced at the database level with explicit ON DELETE actions (Cascade/Restrict).
