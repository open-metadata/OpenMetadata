# ARCHITECTURE

The system map: what OpenMetadata *is as a running system*, where its parts live, and the boundaries
that actually hold. Not the product pitch (see README) and not a how-to (see
[DEVELOPER.md](DEVELOPER.md), [`skills/standards/`](skills/standards/), and
[`.claude/rules/`](.claude/rules/)). Structural claims trace to the measured module graph or a file
path; numbers come from a read-only audit of this tree (module edges from the POMs; package/import
counts by grep/Tarjan).

---

## PART 1 — Bird's-eye view

OpenMetadata is **one Java backend** (`openmetadata-service`, Dropwizard/JAX-RS) fronting a
**MySQL/Postgres** catalog and an **Elasticsearch/OpenSearch** index, with a **React SPA**
(`openmetadata-ui`) and a **Python ingestion framework** (`ingestion/`) that feeds the catalog *through
the same REST API*. Everything is typed by **904 JSON Schemas** in `openmetadata-spec`, from which the
Java, Python, and TypeScript models are generated (Part 3). The backend is a **mid-graph hub**: the
operator, MCP server, integration tests, and distribution all depend on it; it depends only on `common`,
`openmetadata-spec`, and the shaded search clients.

**Path A — an API request** (e.g. `POST /v1/tables`). Enters `openmetadata-service` at
`OpenMetadataApplication.java` (Jersey). A JAX-RS resource in `service/resources/**` (e.g.
`resources/databases/…`) delegates to a repository in `service/jdbi3/**` (extends `EntityRepository`),
which persists via `jdbi3/CollectionDAO` / `EntityDAO` (JDBI SQL-objects; 129 sub-DAOs) → the SQL DB.
A non-GET response also fans out to `service/events/` (change events) and `service/search/` (index
update). **Exit:** JSON response + a persisted row + an async index write. *A "create/update returns the
wrong field" bug lives in `resources/` or `jdbi3/` — or in the schema that typed it.*

**Path B — an ingestion run.** Starts in `ingestion/` (Python), triggered by Airflow or the `metadata`
CLI (`ingestion/src/metadata/__main__.py`). A connector's `<Name>Source` in
`ingestion/.../source/<type>/<name>/metadata.py` is loaded via its `service_spec.py` (`ServiceSpec`,
resolved by `DefaultSourceLoader`); `connection.py` opens the source system; the topology
(`DatabaseServiceSource` producers/processors) *yields* entities; the sink
(`ingestion/.../sink/metadata_rest.py`) **POSTs them to the backend REST API** — i.e. Path A. **Exit:**
catalog rows created/updated. *A "Snowflake tables missing" bug lives in
`ingestion/.../source/database/snowflake/{connection,metadata}.py`, not in the backend.*

**Path C — a search query.** The SPA issues it from `openmetadata-ui/.../src/rest/` → the backend
`resources/search/SearchResource` → `service/search/` (294 files) → ES/OS via the **shaded** `es.*`/`os.*`
clients (`openmetadata-shaded-deps`). Indexes are (re)built by `service/search/indexes/*Index.java` on
entity writes (Path A) or by a reindex app in `service/apps/`. **Exit:** ranked results rendered by
`ui/src/components` + `ui/src/pages`. *"Stale/incorrect results" → `service/search/` or the reindex app;
"search box is broken" → `ui/src/components` + `ui/src/rest`.*

---

## PART 2 — Codemap

### The 12 Maven modules + the ingestion tree
Dependencies/dependents are the **measured Maven edges** (module POMs); `ui → ui-core-components` is a
**yarn/npm** edge, invisible to Maven.

| Module | Responsibility (one line) | Entry point | Depends on → / ← depended by | Look here first |
|---|---|---|---|---|
| `openmetadata-spec` | The 904 JSON Schemas + generated POJOs — the typing source of truth | `src/main/resources/json/schema/` | → `common` · ← `sdk`, `service` | `…/json/schema/entity/` |
| `common` | Shared utilities (`CommonUtil`, `nullOrEmpty`, …) | `common/…/common/utils/CommonUtil.java` | → none · ← `spec`, `service` | `…/common/utils/` |
| `openmetadata-shaded-deps` | ES + OS Java clients relocated behind `es.*`/`os.*` so both link at once | `elasticsearch-dep/pom.xml`, `opensearch-dep/pom.xml` | → external only · ← `service` | the two child poms (do **not** edit) |
| `openmetadata-service` | The core backend: REST API, repositories, migrations runner, search, apps | `…/service/OpenMetadataApplication.java` | → `common`, `spec`, `es-deps`, `os-deps` · ← `k8s-operator`, `mcp`, `integration-tests`, `dist` | `service/resources/` |
| `openmetadata-sdk` | Java client SDK for the API | `…/sdk/client/OpenMetadata.java` | → `spec` · ← `integration-tests` | `…/sdk/client/` |
| `openmetadata-k8s-operator` | Kubernetes operator running OM jobs | `…/operator/OMJobOperatorApplication.java` | → `service` (provided) · ← `integration-tests` (test) | `…/operator/` |
| `openmetadata-mcp` | MCP server exposing OM to agents | `…/mcp/` (e.g. `AuthEnrichedMcpContextExtractor.java`) | → `service` · ← `integration-tests`, `dist` | `…/mcp/` |
| `openmetadata-integration-tests` | Backend API ITs (`*IT.java`, concurrent) | `src/test/java/org/openmetadata/it/tests/` | → `sdk`, `service`, `mcp`, `k8s` (test) · ← none | `…/it/tests/` |
| `openmetadata-ui-core-components` | Canonical React component library (react-aria + `tw:`) | `…/ui/src/components/index.ts` | → none (Maven) · ← `ui` (via npm) | `…/ui/src/components/` |
| `openmetadata-ui` | The React SPA | `…/ui/src/App.tsx` | → none (Maven); → `ui-core-components` (npm) · ← `dist` | `…/ui/src/components/` |
| `openmetadata-dist` | Packaging/assembly of the shippable server | `openmetadata-dist/pom.xml` | → `service`, `mcp`, `ui` · ← none | the assembly pom |
| `openmetadata-clients` | Published client artifacts | `openmetadata-clients/openmetadata-java-client/pom.xml` | → none · ← none (**isolated** in the Maven graph) | `openmetadata-java-client/` |
| `ingestion/` (tree, not a Maven module) | Python framework + 120+ connectors; writes to the API | `ingestion/src/metadata/__main__.py` (`metadata` CLI) | consumes the backend REST API (Path B) | `…/ingestion/source/` |

### `openmetadata-service` internals (package = `…/service/`; 1,777 main `.java`)
Intended flow (sampled, 08a Pass 2): **`resources/*Resource` → `jdbi3/*Repository` → `jdbi3/CollectionDAO`/`EntityDAO` → SQL.** But the packages are **not** acyclically layered (Part 3).

| files | dir | role |
|---|---|---|
| 294 | `search/` | ES/OS indexing + query (`indexes/*Index.java`) |
| 233 | `resources/` | JAX-RS entry points; largest domains `ai/` (34, flat, grew its own seed/service tier) and `services/` (32, sub-packaged) |
| 160 | `apps/` | pluggable applications / schedulers (incl. reindex) |
| 157 | `migration/` | migration runner (`MigrationWorkflow`) |
| 147 | `jdbi3/` | repositories (`EntityRepository`) + DAOs (`CollectionDAO`, 129 sub-DAOs) |
| 128 | `util/` · 98 `security/` · 93 `governance/` · 27 `events/` | shared utils · authN/Z · workflow engine · change events |

### `openmetadata-ui` internals (`SRC = …/ui/src`; 4,725 ts/tsx, 23 dirs; layering is convention-only — no path aliases)
| ts/tsx | dir | role |
|---|---|---|
| 2,400 | `components/` | UI; strongly bidirectional with `utils/` (see cycles, Part 3) |
| 887 | `generated/` | codegen types (quicktype); a **pure sink** |
| 573 | `utils/` | shared helpers/stores |
| 399 | `pages/` | route screens (compose `components`) |
| 116 | `rest/` | the API layer (the only intended caller of the backend) |
| 99 `hooks/` · 97 `constants/` · 22 `context/` | shared leaves (near one-directional) |

### `ingestion/src/metadata/` internals
| dir | role |
|---|---|
| `ingestion/…/source/{database,dashboard,pipeline,messaging,metadata,storage,search,mlmodel,api}/` | the connectors (per family); ~97 carry a `service_spec.py` |
| `ingestion/…/api/` | the plugin base classes (`step.py`, `steps.py` — `Source`, `create()`) |
| `ingestion/…/sink/` | `metadata_rest.py` — posts entities to the backend API |
| `ingestion/…/source/database/{common_db_source,database_service}.py` | the SQL/topology bases connectors extend |
| `generated/` | Pydantic models (datamodel-code-generator); **gitignored** |

---

## PART 3 — Invariants

The boundaries the code **actually keeps** (08a measured them ≥ ~95%), plus schema-first and
migration append-only. "Not enforced" is stated plainly. Documented rules the code does **not** keep are
listed at the end as non-invariants, so they aren't mistaken for these.

**I1 — Modules form an acyclic, downward-only dependency graph.** Every internal Maven edge points from
a higher-level consumer to a lower-level provider; **0 cycles across all 12 modules** (08a Pass 1,
OBSERVED). *Enforces:* **not enforced** — there is no `maven-enforcer` ban-cycles rule; it holds by
construction. *Breaks if violated:* the reactor can no longer order the build; module boundaries dissolve.
*Known cosmetic defects (not cycles):* two declared-order inversions (`spec→common`, `integration-tests→mcp`)
and two duplicate `<dependency>` blocks.

**I2 — Every connector satisfies the ServiceSpec plugin contract.** A connector ships
`{__init__, service_spec, metadata, connection}.py`, a `<Name>Source` extending a
`CommonDbSourceService`/`CommonNoSQLSource`/`DatabaseServiceSource` base, a `create()` classmethod that
raises `InvalidSourceException`, and a top-level `ServiceSpec`. *Measured (now OBSERVED, upgrading 08a's
n=19 sample):* ~97 connectors, **all** with `service_spec.py`; **94/95 `metadata.py` carry
`create()`+`InvalidSourceException` = 98.9%**. *Enforces:* **not enforced by a lint** — `ServiceSpec` is
imported *dynamically at runtime* (`DefaultSourceLoader`), so a broken contract fails at ingestion time,
not at commit. *Breaks if violated:* the connector silently fails to load/register. *Known exceptions:*
`query` and `dbt` (no live connection — principled). Contract source:
[`skills/standards/service_spec.md`](skills/standards/service_spec.md).

**I3 — Generated code is a pure sink; source imports it only as types.** No generated artifact imports
application code — frontend `generated/` imports **0** from `components|pages|rest|utils|hooks|context`;
Python has **0** runtime `import metadata.generated…`; Java POJOs live in `openmetadata-spec/target/` and
depend only on the spec (08a Pass 3+4, OBSERVED). The inbound corollary — *source imports generated only
as types* — holds at **1,736/1,738 = 99.9%** in Python (one exception: `spline/utils.py` uses generated
ANTLR parsers at runtime). *Enforces:* **partially** — the agent harness blocks *edits* to generated trees
(`.claude/settings.json` PreToolUse hook + [`.claude/rules/schema-first.md`](.claude/rules/schema-first.md));
the *import-direction* itself is **not lint-enforced**. *Breaks if violated:* a hand-edit is overwritten by
the next `make generate` (and, for committed UI types, reverted by CI); runtime coupling to generated code
breaks regeneration.

**I4 — Schema-first: schemas generate models, never the reverse.** The **904** JSON Schemas under
`openmetadata-spec/src/main/resources/json/schema/` are the source of truth. Generation direction is
**schema → code**, by four generators: **jsonschema2pojo** → Java POJOs (`openmetadata-spec/target/…`),
**datamodel-code-generator** → Python Pydantic (`ingestion/src/metadata/generated/`, gitignored),
**quicktype** → TypeScript (`openmetadata-ui/…/src/generated/`, committed), **ANTLR** → FQN parsers
(Python + JS). *Enforces:* **partially** — `typescript-type-generation.yml` regenerates the committed UI
types on schema changes and fails/auto-commits on drift; Python + Java outputs are regenerated by the
build; the edit-block hook covers all three (I3). *Breaks if violated:* editing a model directly is lost on
the next `make generate`; schema↔model drift. Runbook:
[`.claude/rules/schema-first.md`](.claude/rules/schema-first.md).

**I5 — Migrations are append-only above the 2.0 baseline.** Files under
`bootstrap/sql/migrations/native` are never edited once shipped; a change is a *new* version. Everything
below 2.0.0 is frozen into `bootstrap/sql/migrations/baseline` and must never be re-added — the runner
filters that range out on baseline-managed databases (`bootstrap/MIGRATION_SYSTEM.md`). *Enforces:*
**partially** — the floor and the 2.0 upgrade gate are enforced at runtime, but append-only above the
floor is not (no CI check, and the stored per-version checksum is not validated). *Breaks if violated:*
an edited applied migration **silently** never re-runs on existing databases (its version is already in
`SERVER_CHANGE_LOG`) yet *does* run on fresh installs → schema drift with no error; a re-added pre-2.0
version never runs at all. Runbook: [`.claude/rules/migrations.md`](.claude/rules/migrations.md).

### Non-invariants — documented rules the code does NOT keep (do not treat as invariants)
Stated with measured counts so they aren't mistaken for boundaries that hold (08a):
- **Java `resources → jdbi3 → DAO` layering is not acyclic.** `resources ↔ jdbi3` is a mutual cycle
  (130/99) and **18 of 21** service package-pairs are cyclic; only `security/` is a partial sink. The
  intended one-way flow (I-would-be) is contradicted by 99 repository→resource imports (much of it
  misplaced value types under `resources/`).
- **"Use `ui-core-components`, not Ant Design" does not hold.** antd is imported by **864** UI files vs
  **522** for the wrapper (~1.65×), 68.5% edited in the last 90 days — an active-but-stalled migration.
- **"Generated types go through an API layer" does not hold.** **1,292** components/pages import
  `generated/` directly vs **93** in `rest/` (~13.9:1); there is no anti-corruption layer.
