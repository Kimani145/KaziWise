# KaziWise LMS — Production Backend

A persistent, server-authoritative, multi-tenant, RBAC-enforced Learning Management and Compliance Platform built with Fastify, PostgreSQL (Prisma ORM), Row-Level Security (RLS), and TypeScript.

---

## Architecture & Locked Decisions

1. **Course Versioning**: Edit-in-place with an incrementing integer `courseVersion` on `Course`, copied onto `Assignment` and `Certificate` at creation time.
2. **Database & Multi-Tenancy**: PostgreSQL with Row-Level Security (RLS) enabled on all tenant-owned tables, keyed to `current_setting('app.current_org_id', true)`. Application layer queries also inject `organisationId`.
3. **Certificate Authority**: Campaign-level `certificateEnabled` is the **sole runtime authority** for issuance. Course-level `certificateEnabled` acts only as a creation-time default.
4. **Manager Scoping**: Flat direct-report scoping (`WHERE managerId = currentUser.id`).
5. **State Machine & Post-Pass Protection**:
   - `ASSIGNED` -> `STARTED` -> `IN_PROGRESS` -> `COMPLETED` (unlocked for assessment) -> `PASSED` / `FAILED`.
   - Once an `Assignment` reaches `PASSED`, further lesson completion or assessment submissions return `409 Conflict` (`ASSIGNMENT_ALREADY_PASSED`).
6. **Centralized RBAC**: One policy function `can(user, action, resource?)` called at the route boundary (`requirePermission(action)`).
7. **Assignment Resolution**: Every learner mutation (`completeLesson`, `submitAssessment`) explicitly requires `assignmentId` in the request and enforces an IDOR check (`assignment.userId === req.user.id`).
8. **Overdue Status**: Derived read-time fact (`deadline < now() AND status != PASSED`), never an editable stored flag. Late completion is permanently recorded via `completedLateAt` and `certificate.completedLate`.

---

## Getting Started

### Prerequisites
- Node.js >= 20
- PostgreSQL >= 15
- pnpm

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### Database Setup & Migrations
```bash
# Push Prisma schema to PostgreSQL
pnpm run prisma:push

# Apply PostgreSQL Row-Level Security (RLS) policies and kaziwise_app role
psql $DATABASE_URL -f prisma/rls.sql

# Seed initial development data
pnpm run seed
```

### Running the Server
```bash
# Development mode with hot-reload
pnpm run dev

# Production build & run
pnpm run build
pnpm start
```

### Running Tests
```bash
pnpm test
```
The test suite runs 41 automated tests covering:
- Pure scoring function edge cases (empty set NaN guard, unanswered questions as wrong, partial correct).
- Centralized RBAC policy unit tests.
- 5 non-negotiable adversarial QA tests against PostgreSQL.
- Complete 3 roles × protected routes RBAC matrix.
- Employee CSV/Excel import with per-row imported/rejected reporting.
- Public certificate verification without PII leakage.
- Derived overdue and late completion flags.

---

## Seed Credentials (Development)
- **Org Admin**: `admin@kaziwise.com` / `Password123!`
- **Manager**: `manager@kaziwise.com` / `Password123!`
- **Learner**: `learner@kaziwise.com` / `Password123!`
