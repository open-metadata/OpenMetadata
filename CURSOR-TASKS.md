Here’s a single, drop-in **Cursor task file** you can save as `CURSOR_TASKS_thirdeye_py_service.txt` (or paste into Cursor and say “run all tasks in order”). It’s designed so Cursor can implement the **Python (FastAPI + Strawberry GraphQL) ThirdEye backend**, wired **behind** OpenMetadata, reading **OpenMetadata MySQL (RO)** and writing to its own **`thirdeye`** schema. Each step includes **Acceptance Criteria**; Cursor should not proceed until they’re met.

---

# CURSOR TASKS — ThirdEye Python GraphQL Service (internal, proxied by OpenMetadata)

## 0) Branch + ADR (Python + GraphQL plan)

**Goal:** Track work on a feature branch and record decision.

**Actions**

* Create branch: `feat/thirdeye-py-graphql`.
* Add ADR `openmetadata-docs/adr/ADR-XXXX-thirdeye-py-graphql.md`:

  * Context: ThirdEye internal microservice; OM proxies `/api/v1/thirdeye/**`; Python chosen for analytics (FastAPI + Strawberry).
  * Decision: Single GraphQL endpoint; JWT validated against OM; reads OM MySQL (RO), writes own `thirdeye` schema.
  * Consequences: Clear isolation; independent scale; persisted queries & complexity limits for safety.

**Acceptance Criteria**

* Branch exists.
* ADR file has Context / Decision / Consequences committed.

---

## 1) New module scaffold: `thirdeye-py-service/`

**Goal:** Minimal FastAPI app with health route.

**Actions**

* Create directory structure:

```
thirdeye-py-service/
  requirements.txt
  README.md
  src/thirdeye/__init__.py
  src/thirdeye/app.py
  src/thirdeye/config.py
  src/thirdeye/auth.py
  src/thirdeye/db.py
  src/thirdeye/repo/om_read.py
  src/thirdeye/repo/te_write.py
  src/thirdeye/services/zi_score.py
  src/thirdeye/routers/health.py
  src/thirdeye/routers/dashboard.py
  src/thirdeye/graphql/schema.py
  src/thirdeye/graphql/loaders.py
  src/thirdeye/graphql/operations/get_zi_score.graphql
  src/thirdeye/migrations/001_init.sql
  tests/test_health.py
  Dockerfile
  .dockerignore
```

* `requirements.txt` (exact pins or loose are fine):

```
fastapi
uvicorn[standard]
strawberry-graphql
strawberry-graphql[fastapi]
aiodataloader
pydantic
SQLAlchemy
mysqlclient
alembic
httpx
python-jose[cryptography]
pyjwt
tenacity
prometheus_client
loguru
pytest
mypy
types-PyYAML
```

* `src/thirdeye/app.py`:

  * Create `FastAPI` app.
  * Mount `/api/v1/thirdeye/health` returning `{"status":"ok"}`.
  * Expose `/metrics` (Prometheus).

**Acceptance Criteria**

* `uvicorn thirdeye.app:app --port 8586` starts locally.
* `GET /api/v1/thirdeye/health` → `{"status":"ok"}`.

---

## 2) Configuration & DB setup (RO to OM, RW to `thirdeye`)

**Goal:** Connect to same MySQL server as OM; ensure `thirdeye` schema & tables.

**Actions**

* `config.py` (Pydantic Settings):

  * `OM_MYSQL_HOST`, `OM_MYSQL_PORT`, `OM_MYSQL_DB`
  * `OM_MYSQL_USER_RO`, `OM_MYSQL_PW_RO`   (read-only)
  * `THIRDEYE_MYSQL_USER`, `THIRDEYE_MYSQL_PW` (RW to `thirdeye` schema)
  * `JWT_ENABLED`, `JWT_JWKS_URL` or `JWT_PUBLIC_KEY`
  * `REFRESH_MINUTES`, `GRAPHQL_PLAYGROUND`, `LOG_LEVEL`
* `db.py`:

  * Create two SQLAlchemy engines:

    * `engine_om_ro` (RO creds) pointing to `openmetadata_db`.
    * `engine_te_rw` (RW creds) pointing to server; run `CREATE SCHEMA IF NOT EXISTS thirdeye`.
  * Provide `get_session_ro()` and `get_session_rw()` context managers.
* `migrations/001_init.sql`:

  * Create tables (idempotent checks acceptable):

```sql
CREATE TABLE IF NOT EXISTS thirdeye.health_score_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  score INT NOT NULL,
  meta JSON NULL
);

CREATE TABLE IF NOT EXISTS thirdeye.action_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  status ENUM('OPEN','IN_PROGRESS','DONE') DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

* On startup, run this SQL against RW connection.

**Acceptance Criteria**

* Service logs show successful connection to OM (RO) and creation/verification of `thirdeye` schema and tables.

---

## 3) OM data reads + ZI score service

**Goal:** Read minimal stats from OM schema and compute a basic ZI score.

**Actions**

* `repo/om_read.py` (RO engine):

  * Implement `get_table_counts()` → `{ "total": int, "active": int, "inactive_pct": float }` (fallback zeros if OM tables absent; treat “active” as recently updated if column exists).
* `services/zi_score.py`:

  * `compute_zi_score()` returns:

```python
{
  "score": int,
  "breakdown": {"storage": int, "compute": int, "query": int, "others": int},
  "metadata": {"totalTables": int, "activeTables": int, "inactivePercentage": float},
  "capturedAt": iso_datetime_str
}
```

* Insert a row in `thirdeye.health_score_history`.

* `routers/dashboard.py`:

  * `GET /api/v1/thirdeye/dashboard/zi-score` → compute on first run and cache (see step 7).

**Acceptance Criteria**

* Calling the endpoint returns well-formed JSON with sane defaults on empty DB.
* Row inserted into `thirdeye.health_score_history` on first call.

---

## 4) JWT auth (reuse OM tokens)

**Goal:** Protect everything except health & metrics with OM-issued JWTs.

**Actions**

* `auth.py`:

  * If `JWT_JWKS_URL` provided, fetch JWKS and validate RS256; otherwise use `JWT_PUBLIC_KEY`.
  * Validate `exp`, `nbf`, and `aud` (include env `JWT_AUDIENCES`, default `["openmetadata"]`).
  * Extract principal (`sub/email/roles`).
* Add FastAPI dependency `get_current_user()` and apply to all routes except `/health` and `/metrics`.

**Acceptance Criteria**

* `/health` works without auth.
* Protected routes 401 without/invalid token; 200 with valid OM JWT.

---

## 5) GraphQL schema (Strawberry) + router

**Goal:** Offer a single GraphQL endpoint for queries/mutations.

**Actions**

* `graphql/schema.py`:

  * Types: `ZIBreakdown`, `ZIMetadata`, `ZIScore`, `ActionItem`, `PageInfo`, `ActionItemEdge`, `ActionItemConnection`.
  * Query:

    * `ziScore: ZIScore!`
    * `actionItems(status: String, first: Int = 20, after: String, sortBy: String = "updatedAt", sortDir: String = "desc", search: String = null): ActionItemConnection!`
  * Mutation:

    * `createActionItem(title: String!): ActionItem!`
    * `updateActionItem(id: Int!, title: String, status: String): ActionItem!`
    * `deleteActionItem(id: Int!): Boolean!`
  * Implement resolvers using repo/services with cursor-based pagination (base64 id cursors) and search on title.

* `graphql/loaders.py`: stub a DataLoader pattern (`ByIdLoader`) for future batching.

* In `app.py`: mount Strawberry GraphQL at `/api/v1/thirdeye/graphql`, protected by JWT dependency; enable GraphiQL only if `GRAPHQL_PLAYGROUND=true`. Inject per-request context (user, sessions, loaders, request_id).

**Acceptance Criteria**

* POST `/api/v1/thirdeye/graphql` with valid token:

  * Query `ziScore` returns structure with `capturedAt`.
  * CRUD mutations work and persist records.

---

## 6) Guardrails: depth, complexity, persisted queries, error normalization

**Goal:** Stability and production safety.

**Actions**

* Add middleware to reject:

  * max query depth > 8 → HTTP 400 OM-style error JSON `{code, message, timestamp}`.
  * max “field count” complexity > 500 → same 400.
* Persisted queries:

  * If header `X-OM-Operation-Id` present, load matching file from `src/thirdeye/graphql/operations/` and execute it; ignore client query string. Return 400 if unknown id.
  * Seed `get_zi_score.graphql`.
* Error normalization:

  * Convert GraphQL errors to include `extensions: { code, requestId }` while preserving GraphQL response shape.

**Acceptance Criteria**

* Too-deep query → 400.
* `X-OM-Operation-Id: get_zi_score` works without sending a query string.
* GraphQL errors include `extensions.code` & `extensions.requestId`.

---

## 7) Background scheduler + in-memory cache

**Goal:** Keep ZI score fresh, reduce DB load.

**Actions**

* On app startup, schedule a task every `REFRESH_MINUTES`:

  * recompute ZI score
  * store in `health_score_history`
  * set in-memory cache (`ttl=REFRESH_MINUTES`)
* `ziScore` resolver returns cached value if fresh.

**Acceptance Criteria**

* Log indicates scheduler active.
* A new history row appears after interval elapses.

---

## 8) Action Items CRUD REST (optional parity) + standard errors

**Goal:** Optional REST parity (useful for non-GraphQL consumers) and consistent error format.

**Actions**

* `routers/action_items.py` (protected):

  * `GET /action-items`
  * `POST /action-items`
  * `GET /action-items/{id}`
  * `PATCH /action-items/{id}`
  * `DELETE /action-items/{id}`
* Use OM-style error JSON consistently.

**Acceptance Criteria**

* REST CRUD works; same DB as GraphQL mutations.

---

## 9) OpenMetadata Java proxy → Python service

**Goal:** OM remains the only public API surface.

**Actions (in `openmetadata-service`)**

* Add config:

```yaml
thirdEye:
  baseUrl: http://thirdeye-py-service:8586
  graphqlPlayground: false
  connectTimeoutMs: 2000
  readTimeoutMs: 5000
  retries: 1
```

* Implement/extend `ThirdEyeProxyResource`:

  * `GET /api/v1/thirdeye/health` → proxy to Python `/api/v1/thirdeye/health`.
  * `POST /api/v1/thirdeye/graphql` → proxy JSON `{query, variables, operationName}` (and header `X-OM-Operation-Id` if present).
  * (Optional) REST action-items CRUD proxies.
* Forward `Authorization` header verbatim.
* Circuit breaker & metrics (reuse OM patterns).

**Acceptance Criteria**

* Hitting `:8585/api/v1/thirdeye/graphql` via OM returns Python service results.
* Transport failures map to `{code:503, message:"ThirdEye unavailable"}`.

---

## 10) Docker & Compose (dev)

**Goal:** Easy local bring-up.

**Actions**

* `thirdeye-py-service/Dockerfile` (python:3.11-slim; install build deps for `mysqlclient`; run `uvicorn thirdeye.app:app --host 0.0.0.0 --port 8586`).
* Root `docker/docker-compose-thirdeye.yml`:

  * `openmetadata-mysql` (if not already running elsewhere).
  * `thirdeye-py-service` with env vars and depends_on MySQL.
  * `openmetadata-service` pointed to `thirdeye-py-service` service name.
* Dev exposes `8586`; production won’t expose ThirdEye.

**Acceptance Criteria**

* `docker compose -f docker/docker-compose-thirdeye.yml up --build` starts all.
* `curl :8585/api/v1/thirdeye/health` → ok (proxied).
* GraphQL query via OM returns ZI score JSON.

---

## 11) Kubernetes (internal only)

**Goal:** Keep ThirdEye private in cluster.

**Actions**

* `deploy/k8s/thirdeye/deployment.yaml` (liveness `/api/v1/thirdeye/health`, env vars).
* `deploy/k8s/thirdeye/service.yaml` (ClusterIP 8586).
* `deploy/k8s/thirdeye/networkpolicy.yaml` allowing ingress only from OM pods (label `app=openmetadata-service`), deny others.
* **No Ingress** for ThirdEye.

**Acceptance Criteria**

* Manifests validate; OM pod can reach ThirdEye via service DNS; ThirdEye is not externally exposed.

---

## 12) CI & Docs

**Goal:** Tests, linting, and ops docs.

**Actions**

* GitHub Actions job (trigger on `thirdeye-py-service/**`):

  * Python 3.11
  * `pip install -r requirements.txt`
  * `pytest -q`
  * `mypy src/thirdeye`
  * Build Docker image
* Update `thirdeye-py-service/README.md` (use the provided README content).
* Add `thirdeye-py-service/docs/mysql_users.sql` with RO/RW grants:

```sql
CREATE USER 'om_ro'@'%' IDENTIFIED BY '***';
GRANT SELECT ON `openmetadata_db`.* TO 'om_ro'@'%';

CREATE USER 'thirdeye_rw'@'%' IDENTIFIED BY '***';
GRANT CREATE, ALTER, INDEX, INSERT, UPDATE, DELETE, SELECT ON `thirdeye`.* TO 'thirdeye_rw'@'%';
FLUSH PRIVILEGES;
```

**Acceptance Criteria**

* CI passes on PR.
* README present and accurate.

---

## Validation Checklist (run before merge)

* [ ] Health: `GET :8585/api/v1/thirdeye/health` via OM → ok
* [ ] GraphQL ZI score via OM → returns valid JSON
* [ ] JWT enforced (401 without token)
* [ ] Background scheduler inserts history rows
* [ ] Action Items CRUD works (GraphQL and optional REST)
* [ ] Guardrails block deep/complex queries; persisted query works
* [ ] Metrics exposed at `/metrics`
* [ ] ThirdEye not externally exposed in K8s

---

## Notes

* If OM does not expose JWKS, paste PEM in `JWT_PUBLIC_KEY`.
* For OM schema variability, keep queries tolerant (fallback 0s and don’t crash).
* Keep all ThirdEye access **through OM proxy** only—no direct public access.

---

**End of file.**
