# Shipshape — Release Checklist

A responsive single-page release checklist built with React, Node.js/Express, Apollo GraphQL, and PostgreSQL. It supports creating, searching, filtering, expanding, and deleting releases; tracking a fixed 10-step checklist; and editing release notes. Status is derived on the server and is never directly editable.

## Tech choice and design decisions

- **Frontend:** React 18 + Vite, Apollo Client for GraphQL, Lucide icons, and plain CSS. This keeps the UI small and avoids a heavy component framework.
- **Backend/API:** Node.js + Express 5 + Apollo Server 4, with GraphQL as the application API. `/health` is a small operational health endpoint.
- **Database:** PostgreSQL 16, because the assignment explicitly requires PostgreSQL or MySQL. The request also says “Use MERN”; MERN's MongoDB conflicts with the mandatory SQL requirement, so this implementation prioritizes the explicit SQL database requirement while retaining React, Express, and Node. If a reviewer strictly requires MongoDB, that is a deliberate alternative requirement and the persistence layer would need to be changed.
- **Release model:** `releases` stores the release name, due date, notes, completed step indexes, and timestamps. Checklist labels are immutable application constants shared by every release; a separate steps table would add needless duplication for the stated use case.
- **Step representation:** `completed_steps INTEGER[]` stores only completed indexes. Missing indexes are incomplete. The API validates each index and normalizes duplicate/invalid indexes on read.
- **Derived status:** zero completed steps = `planned`; one to nine = `ongoing`; all ten = `done`. Status is computed from completion state on the server and returned by GraphQL.
- **Dates:** `TIMESTAMPTZ` stores the due date as an absolute instant. The UI accepts local date/time input and sends an ISO timestamp.
- **UX:** expandable release cards keep the list scannable; progress bars and status pills communicate progress; optimistic step updates make checkboxes feel responsive; search and status filtering are client-side for a small single-user app. Mutations and server-side input validation remain authoritative.
- **No user management:** as requested, the app has no authentication or multi-user permissions. Do not expose it publicly with sensitive release data without adding auth.
- **Database initialization:** API startup creates the table and index if missing. For a larger production system, replace this lightweight bootstrap with versioned migrations.
- **Testing:** Node's built-in test runner covers status derivation and release normalization. A read-only Autocannon script measures GraphQL API behavior under load.

## Features

- View releases sorted by due date.
- Create a release with mandatory name and due date/time plus optional notes.
- Check/uncheck any of the ten release steps.
- See computed status and progress percentage update as steps change.
- Add/edit release-specific notes.
- Delete releases with a confirmation prompt.
- Search by release name and filter by status.
- Responsive desktop/mobile layouts, loading/error/empty states, and a database health indicator area.

## Run locally (Docker — recommended)

Prerequisites: Docker Desktop / Docker Engine with Compose.

```bash
git clone <your-github-repository-url>
cd release-checklist-tool
docker compose up --build
```

Open the UI at <http://localhost:5173>, GraphQL Playground/Apollo landing page at <http://localhost:4000/graphql>, and health check at <http://localhost:4000/health>.

Stop services with `Ctrl+C`, or run `docker compose down`. To delete local database data too, run `docker compose down -v` (destructive).

## Run locally without Docker

Prerequisites: Node.js 20+ and PostgreSQL 15+.

1. Create a PostgreSQL database and user, or use the defaults from `docker-compose.yaml`.
2. Set the API environment variable `DATABASE_URL`, for example:
   `postgres://releasecheck:releasecheck_dev@localhost:5432/releasecheck`
3. Install and start the API:

   ```bash
   npm install
   npm run dev:server
   ```

4. In another terminal, start the UI:

   ```bash
   npm run dev:client
   ```

5. Visit <http://localhost:5173>. The default browser API URL is `http://localhost:4000/graphql`.

Optional API variables: `PORT` (default `4000`), `DATABASE_URL`, `DB_POOL_MAX` (default `10`), `CLIENT_ORIGIN` (comma-separated allowed origins; defaults to permissive CORS for local development), and `NODE_ENV`.

## GraphQL API

GraphQL uses one HTTP endpoint: **`POST /graphql`**. The API accepts GraphQL operations rather than separate REST routes.

### Queries

- `releases: [Release!]!` — all releases sorted by due date, then ID.
- `release(id: ID!): Release` — one release, or `null` if not found.
- `steps: [String!]!` — the fixed checklist labels.

### Mutations

- `createRelease(input: CreateReleaseInput!): Release!` — create a release. `name` and ISO-compatible `date` are required; `additionalInfo` is optional.
- `updateRelease(id: ID!, input: UpdateReleaseInput!): Release!` — update name, date, and/or additional information. The UI currently uses this to save notes.
- `setStepCompleted(id: ID!, stepIndex: Int!, completed: Boolean!): Release!` — mark one step on/off.
- `deleteRelease(id: ID!): Boolean!` — returns `true` if a release was deleted and `false` if it did not exist.

### Example requests

List releases:

```graphql
query {
  releases {
    id name date status additionalInfo completedSteps
    steps { index label completed }
  }
}
```

Create a release (send as the `input` variable):

```graphql
mutation Create($input: CreateReleaseInput!) {
  createRelease(input: $input) { id name date status }
}
```

Variables:

```json
{
  "input": {
    "name": "v2.4.0 release",
    "date": "2026-11-01T15:00:00.000Z",
    "additionalInfo": "Confirm staging smoke tests before rollout."
  }
}
```

Mark step 0 complete:

```graphql
mutation {
  setStepCompleted(id: "1", stepIndex: 0, completed: true) { id status completedSteps }
}
```

Health endpoint: `GET /health` returns `200 {"status":"ok","database":"connected"}` when the DB is reachable, otherwise HTTP 503.

## Database schema

The API initializes this PostgreSQL table automatically:

```sql
CREATE TABLE releases (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL CHECK (length(trim(name)) > 0),
  due_date TIMESTAMPTZ NOT NULL,
  additional_info TEXT NOT NULL DEFAULT '',
  completed_steps INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX releases_due_date_idx ON releases (due_date ASC);
```

The `Release` GraphQL type additionally exposes a derived `status`, `steps`, and ISO-formatted timestamps. These are computed by the API, not separately persisted.

## Automated tests

```bash
npm install
npm test
```

Tests cover all three status states and normalization of completed step indexes. They are unit tests and do not require a running database. Build the frontend with `npm run build`.

## API stress test and optimization experiment

The repository includes a read-only GraphQL load test using Autocannon:

```bash
# Start the API and database first, then in another terminal:
cd server
npm install
CONNECTIONS=25 DURATION=20 npm run stress
CONNECTIONS=50 DURATION=20 npm run stress
CONNECTIONS=100 DURATION=20 npm run stress
```

`STRESS_URL` can point at a deployed API. This test queries `releases { id name status }`; it does not create or mutate data. Observe requests/sec, latency percentiles, errors, timeouts, and non-2xx responses. Repeat with increasing `CONNECTIONS` until latency/error rates cross your chosen threshold. Run tests against a staging deployment, not a production API serving users.

**Do not claim a concurrent-user limit without actually running the test on the target deployment.** Results depend on hosting tier, database tier, region, data volume, and network. Record your measured results in the table below after running it:

| Build / configuration | Concurrent connections | Requests/sec | p95 latency | Errors/timeouts | Notes |
|---|---:|---:|---:|---:|---|
| Baseline (before optimization) | _measure_ | _measure_ | _measure_ | _measure_ | Record the first run and breaking point |
| Optimized | _measure_ | _measure_ | _measure_ | _measure_ | Record after each documented change |

### Optimization ideas to test and document

1. **Pool sizing:** tune `DB_POOL_MAX` relative to the database's connection limit. More connections are not always faster.
2. **Query and index review:** use `EXPLAIN (ANALYZE, BUFFERS)` on the list query with realistic data. The due-date index supports the default sort.
3. **Pagination:** for a large release history, add cursor pagination rather than returning every row.
4. **Caching:** consider short-lived caching for read-heavy list queries; invalidate it on every mutation. Do not cache mutable checklist data without correct invalidation.
5. **Payload and execution limits:** keep response fields minimal for list screens and add request-size, query-depth, and rate limits before public exposure.
6. **Infrastructure:** keep API and database in the same region, add CPU/memory monitoring, and scale database/API independently where hosting supports it.
7. **Measure one change at a time:** run the same warm-up, duration, connection count, data volume, and region against baseline and optimized versions. Compare error rate and p95/p99 latency, not just peak throughput.

This repository contains a practical baseline and measurement script; it does **not** invent benchmark results or claim a measured optimization delta. To satisfy the video requirement, run both experiments, fill in the table, deploy the API and UI, then record a 2–5 minute Loom/screen recording with your face visible. Show the initial breaking point, explain the optimization you actually tried, and show the final measured constraint. Speak in English as requested.

## Deployment

The app can be deployed as two services plus a managed PostgreSQL database (Render, Railway, Fly.io, etc.) or via Docker Compose on a suitable host.

1. Provision managed PostgreSQL and copy its connection URL. Use SSL settings required by your provider; if the provider requires `sslmode=require`, include it in the URL.
2. Deploy `server/` as a Node service using `npm install` and `npm start`; set `DATABASE_URL`, `NODE_ENV=production`, `PORT` (provided by the host), `CLIENT_ORIGIN` to your deployed UI origin, and an appropriate `DB_POOL_MAX`.
3. Deploy `client/` as a static Vite site using `npm install` and `npm run build`, with `client` as the root directory. Set `VITE_GRAPHQL_URL` to the deployed API's full `/graphql` URL at build time.
4. Confirm `/health`, run a GraphQL query in the deployed API, and test create/update/check/uncheck/delete in the deployed UI.
5. Put both deployed URLs and the Loom demo URL in your submission notes. This environment cannot deploy to an account you have not connected or record a video on your behalf.

For a static host, set `VITE_GRAPHQL_URL` before building; Vite embeds it in the generated bundle. Keep the UI origin in the API's `CLIENT_ORIGIN` allowlist. Do not commit database credentials.

## Project structure

```text
release-checklist-tool/
├── client/                 # React + Vite SPA
│   ├── src/main.jsx        # UI, Apollo operations, components
│   ├── src/styles.css      # Responsive styling
│   ├── Dockerfile
│   └── vite.config.js
├── server/                 # Express + Apollo GraphQL API
│   ├── src/db.js           # PostgreSQL pool, schema bootstrap, status mapping
│   ├── src/schema.js       # GraphQL schema and resolvers
│   ├── src/index.js        # HTTP server and health check
│   ├── src/stress.js       # Autocannon load test
│   ├── test/status.test.js
│   └── Dockerfile
├── docker-compose.yaml
├── package.json
└── README.md
```
