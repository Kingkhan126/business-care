# Developer Guide & Workflows

## Quality Gates & Checklist
Before pushing code or opening PRs, verify:

1. **Type Checking**:
   ```bash
   npx tsc --noEmit
   ```
2. **Linting**:
   ```bash
   npm run lint
   ```
3. **Unit Tests**:
   ```bash
   npm test
   ```
4. **Production Build**:
   ```bash
   npm run build
   ```

## Coding Conventions
- **Strict TypeScript**: Avoid `any` types. Use explicit Zod schemas or Prisma-generated interfaces.
- **Server vs Client Components**: Use Server Components by default. Keep `"use client"` directive restricted to leaf interactive components.
- **Sensitive Logging**: Always use `logger` abstraction from `@/lib/logging` to automatically redact passwords and tokens.
