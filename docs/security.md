# Security Architecture & Risk Mitigations

## Security Architecture Controls

1. **Authentication**:
   - HTTP-only, `SameSite=Lax` signed JWT session cookies.
   - Passwords hashed with `bcryptjs` using a work factor of 12.
   - Protection against session fixations and token tampering via `jose` signature verification.

2. **Authorization & RBAC**:
   - Every protected API route handler and server action enforces `requirePermission(user, perm)`.
   - Dynamic permissions checked server-side against role assignments.

3. **Multi-Tenant Isolation**:
   - `assertTenantAccess(user, targetOrgId)` checks match between active session org ID and requested tenant resource.
   - Prevents Insecure Direct Object References (IDOR).

4. **Input Validation**:
   - Zod validation schemas reject malformed or unexpected payloads before reaching business logic.

5. **Secrets Security**:
   - Private environment variables (`DATABASE_URL`, `AUTH_SECRET`) are never exposed to the client bundle.
