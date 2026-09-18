# KaziWise LMS — Production Backend

A persistent, server-authoritative, multi-tenant, and RBAC-enforced Learning Management and Compliance Platform built with **Fastify**, **PostgreSQL**, **Prisma ORM**, **Postgres Row-Level Security (RLS)**, and **TypeScript**.

---

## 1. Environment Setup

### 1.1 Prerequisites
- **Node.js**: `v20.x` or `v22.x` (tested on Node `v22.17.1`)
- **Package Manager**: `pnpm` (`v9.x` or `v11.x`)
- **PostgreSQL**: PostgreSQL `v15` to `v18` (with `psql` command-line tools)

### 1.2 Environment File Configuration
Copy the sample environment file to create your local `.env`:

```bash
cp .env.example .env
```

### 1.3 Environment Variables Reference

| Variable | Description | Default / Example Value |
|---|---|---|
| `DATABASE_URL` | Application database connection string (connecting as non-superuser `kaziwise_app` to enforce Postgres RLS). | `postgresql://kaziwise_app:kaziwise_secure_pass@127.0.0.1:5433/kaziwise_dev?schema=public` |
| `TEST_DATABASE_URL` | Isolated database connection string used exclusively by Vitest suites. | `postgresql://kaziwise_app:kaziwise_secure_pass@127.0.0.1:5433/kaziwise_test?schema=public` |
| `MIGRATION_DATABASE_URL` | Superuser database connection string used for DDL migrations and applying RLS scripts. | `postgresql://postgres@127.0.0.1:5433/kaziwise_dev?schema=public` |
| `JWT_SECRET` | Secret key used to sign and verify short-lived access tokens (minimum 16 characters). | `kaziwise-super-secure-production-jwt-secret-key-32chars` |
| `REFRESH_JWT_SECRET` | Secret key used to sign and verify refresh tokens stored in `httpOnly` cookies. | `kaziwise-super-secure-production-refresh-jwt-secret-key-32chars` |
| `PORT` | HTTP port on which the Fastify server listens. | `3001` |
| `HOST` | Host address to bind the HTTP server. | `0.0.0.0` |
| `NODE_ENV` | Runtime environment (`development`, `test`, or `production`). | `development` |

---

## 2. Database Initialization & RLS Setup

KaziWise uses defense-in-depth tenant isolation: every query is scoped in application logic, and PostgreSQL Row-Level Security (RLS) is enforced at the database engine level.

### 2.1 Starting Local PostgreSQL (if running dedicated cluster on port 5433)
```bash
# Initialize data directory (one-time setup if needed)
mkdir -p /home/kimani/postgres_kaziwise
/usr/lib/postgresql/18/bin/initdb -D /home/kimani/postgres_kaziwise -U postgres --auth=trust

# Start the cluster on port 5433
/usr/lib/postgresql/18/bin/pg_ctl -D /home/kimani/postgres_kaziwise -o "-p 5433 -k /tmp" -l /home/kimani/postgres_kaziwise/logfile start
```

### 2.2 Creating Databases
```bash
psql -h 127.0.0.1 -p 5433 -U postgres -c "CREATE DATABASE kaziwise_dev;"
psql -h 127.0.0.1 -p 5433 -U postgres -c "CREATE DATABASE kaziwise_test;"
```

### 2.3 Applying Prisma Schema & Generating Client
```bash
# Push schema to the development database
pnpm run prisma:push
```

### 2.4 Enabling PostgreSQL Row-Level Security (RLS)
The `prisma/rls.sql` script creates the non-superuser application role `kaziwise_app`, enables and forces RLS on all tenant-owned tables, and creates session-based RLS policies:

```bash
# Apply RLS policies to development database
psql -h 127.0.0.1 -p 5433 -U postgres -d kaziwise_dev -f prisma/rls.sql

# Apply RLS policies to test database
psql -h 127.0.0.1 -p 5433 -U postgres -d kaziwise_test -f prisma/rls.sql
```

### 2.5 Seeding Initial Demo / Test Dataset
```bash
pnpm run seed
```

This seeds:
- Organisation: **KaziWise Technologies**
- Departments: **Engineering**, **Human Resources**
- Sample Course: **Information Security & Data Protection Compliance** (with 2 modules, lessons, content blocks, and multiple-choice questions)
- Sample Active Campaign: **Q3 Mandatory Compliance 2026**

---

## 3. Pre-Seeded User Accounts

All seed accounts use the default password: **`Password123!`**

| Role | Email | Permissions / Notes |
|---|---|---|
| **Org Admin** | `admin@kaziwise.com` | Full administrative rights: employees, courses, campaigns, org reports |
| **Manager** | `manager@kaziwise.com` | Direct reports scoping: team reports, direct report reminders |
| **Learner** | `learner@kaziwise.com` | Learner portal: course player, lesson completion, assessment submission |
| **Super Admin** | `superadmin@kaziwise.com` | Platform-level account (schema/auth only, UI deferred) |

---

## 4. Launching the Application

### 4.1 Development Mode (Hot Reload)
Starts the Fastify server using `tsx watch` with instant reloads on code changes:
```bash
pnpm run dev
```

### 4.2 Production Build & Run
Compile TypeScript to JavaScript in `dist/` and run using Node.js:
```bash
# Compile TypeScript to dist/
pnpm run build

# Start production server
pnpm start
```
The server will bind to `http://0.0.0.0:3001`.

### 4.3 Health Check Verification
Verify that the service is running:
```bash
curl -s http://127.0.0.1:3001/health
# Response: {"status":"ok","timestamp":"..."}
```

---

## 5. Testing & Quality Assurance

Run the automated Vitest test suite (41 tests across 5 test suites):

```bash
pnpm test
```

### Test Suites Breakdown

1. **Adversarial QA Suite (`tests/adversarial-bugs.test.ts`)**
   - **The wrong-assignment bug**: Verifies simultaneous assignments are graded and issued independently without cross-mutation.
   - **The audience-ignored bug**: Validates exact assignment generation for `ALL_EMPLOYEES`, `DEPARTMENT`, and `SELECTED_EMPLOYEES`.
   - **The manager-privilege-escalation bug**: Asserts `POST /campaigns/:id/launch` with a Manager token is rejected with `403 Forbidden`.
   - **The post-pass mutation bug**: Asserts that once an assignment is `PASSED`, further lesson-complete and attempt submissions are rejected with `409 Conflict (ASSIGNMENT_ALREADY_PASSED)`.
   - **The organisation-isolation bug**: Asserts Org A cannot read or mutate Org B resources at the application layer AND verifies Postgres RLS blocks direct queries at the engine level.

2. **RBAC Route Matrix (`tests/rbac-matrix.test.ts`)**
   - Tests all 3 active roles (`ORG_ADMIN`, `MANAGER`, `LEARNER`) across all protected endpoints, asserting `200` vs `403`.

3. **Features & Compliance (`tests/features.test.ts`)**
   - **FR-008**: Employee CSV and Excel (XLSX) batch import returning `{ imported: [...], rejected: [{row, reason}] }`.
   - **Public Certificate Verification**: `GET /api/v1/certificates/:id/verify` returns authenticity details without leaking PII.
   - **FR-020**: Late completions set `completedLateAt` on the assignment and `completedLate = true` on the certificate.
   - **Reports & Export**: Generates compliant XLSX reports based on filter criteria.

4. **Pure Scoring (`src/modules/assessment/scoring.test.ts`)**
   - Tests pure function `calculateScore`: 100%, 0%, partial scores, unanswered questions counted as wrong, empty question set guarded against division by zero / `NaN`.

5. **RBAC Policy Function (`src/auth/policy.test.ts`)**
   - Verifies the single callable `can(user, action, resource?)` policy module.

---

## 6. API Quick Reference & Curl Examples

### Authenticate (Login)
```bash
curl -X POST http://127.0.0.1:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kaziwise.com","password":"Password123!"}'
```
Returns `{ "accessToken": "<JWT>", "user": { ... } }` and sets the `refreshToken` cookie.

### List Courses (Authenticated)
```bash
curl -H "Authorization: Bearer <TOKEN>" http://127.0.0.1:3001/api/v1/courses
```

### Complete a Lesson (Learner)
```bash
curl -X POST http://127.0.0.1:3001/api/v1/me/assignments/<ASSIGNMENT_ID>/lessons/<LESSON_ID>/complete \
  -H "Authorization: Bearer <LEARNER_TOKEN>"
```

### Submit Assessment Attempt (Learner)
```bash
curl -X POST http://127.0.0.1:3001/api/v1/me/assignments/<ASSIGNMENT_ID>/attempts \
  -H "Authorization: Bearer <LEARNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": {
      "<QUESTION_ID_1>": "<OPTION_ID_A>",
      "<QUESTION_ID_2>": "<OPTION_ID_B>"
    }
  }'
```

### Verify a Certificate (Public — No Auth Required)
```bash
curl http://127.0.0.1:3001/api/v1/certificates/<VERIFICATION_CODE>/verify
```
Returns:
```json
{
  "valid": true,
  "certificateNumber": "CERT-...",
  "learnerName": "Chloe Decker (Learner)",
  "courseTitle": "Information Security & Data Protection Compliance",
  "completionDate": "2026-09-18T...",
  "completedLate": false
}
```
