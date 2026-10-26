# DEVELOPER.md — AI-Assisted Development Guide for OpenMetadata

This guide helps developers (and AI agents like Claude Code, Codex, Copilot) write correct, production-quality code in the OpenMetadata codebase. It covers the preferred workflow for each language, architecture patterns you must understand, and how to use the available skills.

For environment setup, build commands, and coding standards, see [AGENTS.md](AGENTS.md).
For connector-specific development, see [skills/README.md](skills/README.md).

---

## Table of Contents

- [Preferred Workflow by Language](#preferred-workflow-by-language)
- [Using the Skills](#using-the-skills)
- [Architecture Deep Dives](#architecture-deep-dives)
  - [Schema-First Design](#schema-first-design)
  - [Entity Model and Registry](#entity-model-and-registry)
  - [REST Resource Pattern](#rest-resource-pattern)
  - [JDBI3 Data Access Layer](#jdbi3-data-access-layer)
  - [Database Migrations](#database-migrations)
  - [Change Events and Audit](#change-events-and-audit)
  - [Authorization (RBAC)](#authorization-rbac)
  - [Search Infrastructure](#search-infrastructure)
  - [Python Ingestion Topology](#python-ingestion-topology)
  - [Frontend Patterns](#frontend-patterns)
- [Cross-Cutting Patterns](#cross-cutting-patterns)

---

## Preferred Workflow by Language

### Java Backend

```
1. /planning          — Design the approach (which entities, endpoints, migrations?)
2. /tdd               — Write a failing integration test in openmetadata-integration-tests/
3.                       Implement in openmetadata-service/
4.                       mvn spotless:apply
5. /test-enforcement   — Verify 90% coverage, integration tests for all endpoints
6. /verification       — Show passing test output
7. /code-review        — Run java-reviewer agent for Kafka-grade quality check
```

**Key rules:**
- Start with the JSON schema if adding/modifying an entity (`openmetadata-spec/`)
- Always write the integration test first — it proves the API contract works
- Methods must be 15 lines or fewer, no magic strings, no convoluted if/else chains
- Run `mvn spotless:apply` before every commit
- Every new REST endpoint needs a corresponding `*IT.java` in `openmetadata-integration-tests/`

### React/TypeScript Frontend

```
1. /planning          — Identify components, state management, API contracts
2. /tdd               — Write Jest test for the component
3.                       Implement the component
4.                       yarn lint:fix
5. /test-enforcement   — Verify Jest coverage + Playwright E2E if user-facing
6. /verification       — Show lint + test output
7. /code-review        — Run frontend-reviewer agent
8. /ui-pr-recording    — When creating a UI feature/task PR: run Docker, record the feature, upload
```

**Key rules:**
- Use components from `openmetadata-ui-core-components`, never Ant Design
- All Tailwind classes use `tw:` prefix, all colors use CSS custom properties
- No string literals in JSX — use `t('label.key-name')` from `useTranslation()`
- No `any` type — use generated types from `generated/` or define proper interfaces
- New keys go in `locale/languages/en-us.json` using kebab-case under the appropriate namespace
- Run `yarn parse-schema` after any connection schema changes

### Python Ingestion

```
1. /planning          — Choose connector architecture (SQLAlchemy vs REST vs SDK)
2. /connector-standards — Load the relevant standards
3. /tdd               — Write pytest tests first
4.                       Implement using topology pattern
5.                       make py_format && make py_format_check
6. /test-enforcement   — Verify 90% coverage
7. /verification       — Show test + lint output
8. /connector-review   — Full review against golden standards (for connectors)
```

**Key rules:**
- Use pytest style — plain `assert`, no `unittest.TestCase`
- Use the topology pattern (`ServiceSpec` + `TopologyNode`) for all connectors
- Keep connector-specific logic in the connector's directory, not in shared files
- Use generators (`yield`) for streaming entities — never accumulate in memory
- Implement pagination for all REST API calls
- Reuse HTTP sessions — create one `requests.Session()` per connector lifetime

---

## Locked Python commands

Run `make install_dev` for the slim development profile or `make install_test` for
all connector and test dependencies. Both synchronize `ingestion/uv.lock` with
`uv sync --locked` into the existing repository `env/`; they remove packages outside
the selected profile. `make install` and `make install_all` retain their base and
all-connector selections. Set `OM_VENV_DIR` to a repository directory name to reuse
another existing application environment, or explicitly set `OM_PYTHON_ENVIRONMENT`
to an absolute task-specific venv path. No `ingestion/.venv` is created.

Formatting, generation and coverage tools use explicit caches under
`ingestion/.nox/{style,generation,coverage,dev-tools}`. These tool profiles do not prune the
application's connector drivers. The runner bootstraps pinned uv in the selected
venv if needed; setuptools/setup.py remain the packaging authority.

```sh
make install_dev
make generate ARGS=--python-only
make py_format_check
make static-checks
make unit_ingestion ARGS='-k selected_test --maxfail 1'
make run_ometa_integration_tests ARGS='--standalone --workers 0 tests/integration/sdk'
```

Make commands work from the root and `ingestion/`, except `make generate`, which
is root-only. `nox -f ingestion/noxfile.py -s unit-tests -- -k selected_test` also
works from the root. Direct Nox sessions synchronize their own session venv;
`--no-venv` selects the same application/tool environment as Make. Type checking
uses the full test profile because it checks optional connector imports.

Project profiles first synchronize generation tools and generate stale Python
models, then install the editable project. Test synchronization provisions and
verifies the release-pinned English, Spanish, Italian and Polish spaCy models;
downloads require the GitHub release-asset host. Repeated nested Make/Nox calls
reuse preparation only when the profile, environment and dependency inputs match.
The generation manifest hashes the lock and runner, and Python generation omits
timestamps so repeated output is byte-identical. Full generation still includes
the UI parser; use `--python-only` when UI changes are not intended.

The managed Airflow API CI lane uses the `api` profile: the test dependencies plus
the local API project and its dependencies, resolved in the same lock. Run it locally
with `python scripts/python_environment.py --profile api -- make coverage_apis`.
The legacy `install_apis` packaging command remains separate pending artifact work.
Run commands sharing an application environment sequentially.

Routine CI and the cache warmer use the same profile action. Cache keys include
the lock, profile, full interpreter identity, OS and architecture; every restore
is followed by locked synchronization. Coverage jobs require every expected
suite artifact before combining reports; Sonar uploads remain optional. Startup
attempt logs are retained separately, and service readiness waits are bounded by
`SERVICE_READY_TIMEOUT_SECONDS` (default 300 seconds per service).

### Dependency updates

Dependabot proposes weekly `uv.lock` updates within the existing constraints,
including dependencies composed by `setup.py`. Tooling minor/patch updates are
grouped separately from runtime updates; major updates remain individual. Shared
pins and bounds in `setup.py` remain maintainer-managed. A pinned dependency cannot
advance until its constraint is deliberately changed. The old urllib3 exclusion
is removed: Tableau 0.40 allows urllib3 2.x, which the current lock already uses.

Resolve and test a candidate outside the checkout:

```sh
python scripts/refresh_python_dependencies.py --package urllib3 \
  --output-dir /tmp/om-python-candidate -- \
  python scripts/python_environment.py --profile test -- make unit_ingestion
```

Repeat `--package` for coupled updates, or use `--all` for a broad refresh.
The output directory must be empty. `report.json`, both locks, and complete
resolution/validation logs remain there even after failure. The accepted lock and
existing application environment are preserved. Inspect the candidate diff, then
use a new output directory and `--accept` to resolve, validate, and replace only
the lock. Acceptance refuses concurrent checkout edits or validation that changes
the candidate's lock/source files. The normal install/test commands never refresh.

The weekly/manual `Python dependency canary` workflow runs a targeted test sample
against an isolated broad refresh, retains evidence for 14 days, and has only read
permissions. It neither accepts a lock nor opens a PR. Its sample is an early
compatibility signal; dependency PRs still need the ordinary supported CI matrix
and relevant connector tests before merge.

The weekly/manual `Python constraint review` runs Mondays at 07:00 UTC on the
default branch. It evaluates every `setup.py` extra, checks stable non-yanked PyPI
releases, and reports upgrades blocked by shared pins or upper bounds. The report
includes locked versions, Python 3.10/3.11/3.12 release compatibility, affected
extras, requirement markers, and adjacent constraint comments. This is an advisory
check: file `Requires-Python` metadata does not prove platform wheel availability,
marker applicability, or that the complete dependency graph can resolve.

```sh
python scripts/review_python_constraints.py scan --output-dir /tmp/om-constraint-review
```

Local scanning writes only `report.json` and `report.md`; it does not change
constraints, refresh the lock, install candidate packages, or contact GitHub.
The workflow's separate issue-writing job maintains one bot-owned review issue,
mentions `@open-metadata/ingestion` for newly actionable constraint/version pairs,
and leaves unchanged reports untouched. New findings reopen a closed issue;
human notes outside its marked report section are preserved. Index failures fail
the scan and prevent publication. The issue-writing permission is confined to the
report job, and publication never runs on PR events. Security alerts remain
independent. Review each finding before changing its shared constraint and using
the tested refresh flow above.

The ingestion CODEOWNERS review Python updates and own the refresh command; CI
owners review the canary. For a security fix, use a narrow package refresh and
deliberately adjust its shared constraint if necessary. Record the advisory,
compatibility evidence, owner, and review/removal date for any temporary exception;
do not add a blanket ignore or override to bypass resolution. Keep the existing
tested metadata exceptions narrow. To roll back locally, restore the saved
`accepted.uv.lock` and synchronize the same profile with `--locked`. For an already
merged update, use a new revert commit with the earlier lock and matching manifests,
then rerun its checks. Never rewrite reviewed history.

Dependency maintenance belongs to `@open-metadata/ingestion`; workflow changes
also require the existing `.github` owners. Review shared constraints, build-tool
pins, image roots and metadata exceptions when their dependencies change. The
weekly constraint report is the review queue, not permission to lift bounds.
For a temporary exception, record its exact package/version, reason or advisory,
owner, regression command, removal condition and next review date in the PR.
Check whether the upstream fix now permits removing it before renewing it.
The SQLAlchemy/IBMi exception must retain its dialect regression; the image's
psycopg2 substitution must retain its exact-version metadata and native checks.
Remove the IBMi override when upstream metadata supports SQLAlchemy 2 and the
dialect regression passes without the override. Remove the psycopg2 substitution
only after binary-driver authentication/startup passes on both image architectures.
Revisit the image mysqlclient pin and build-backend pin on Airflow/backend updates;
changing them requires clean artifact, native-driver and startup checks.

Retire dependencies only after checking imports, CLI/script use, published extras
and downstream requirements. Compare wheel metadata and both lock changes, retain
any runtime dependency previously supplied transitively, and test affected public
commands/connectors from installed artifacts. `google-cloud` was an empty legacy
distribution; concrete Google client libraries remain required. `memory-profiler`
had no callers; runtime metrics and diagnostics use the now-direct `psutil`
dependency. Optional developer profiling tools can be installed separately.

Downstream repositories keep their own environment authority. A locked upstream
sync is exact and removes unrelated overlay packages: install Collate into its
own environment or derive and test a combined environment instead of syncing the
upstream-only profile after installing it. Check the downstream revision,
package constraints, module overlays, CLI entry points and final image environment
against the actual upstream wheels before adopting an update.
Both distributions publish the `metadata` command. Install the SDK first, generate
and build Collate's models, then install Collate last so its entry point remains
active. A source-only Collate wheel lacks the additional generated models needed
by its CLI; dependency resolution alone does not establish compatibility.

### Python artifacts and images

Build both distributions once, then validate those exact bytes in clean wheel
and sdist environments outside the checkout:

```sh
python scripts/build_python_artifacts.py build --output-dir /tmp/om-python-artifacts
python scripts/build_python_artifacts.py validate --output-dir /tmp/om-python-artifacts
python scripts/build_python_artifacts.py check --output-dir /tmp/om-python-artifacts
```

The build output directory must be empty. Python-only generation runs through its
locked tooling profile before packaging. Setuptools remains the backend, with
hash-checked build constraints in `ingestion/build-constraints.txt`; wheels are
built from their sdists. The output retains both pairs, SHA256 sums, a manifest,
and validation reports. Validation checks installed versions, CLI startup,
generated-model/parser imports, packaged resources, dependency consistency, and
absence of source/editable dependencies. Airflow receives a private temporary
home during validation. The release workflow builds once, checks those artifacts
on Python 3.10/3.11/3.12, and only then exposes the existing upload credentials
to a separate job that verifies and uploads the original artifacts.

Images use `ingestion/images/runtime/uv.lock`, independently of the development
lock: their final environment includes Airflow, selected providers, source-built
psycopg2, and the existing mysqlclient 2.1.1 pin. Runtime dependency constraints
still come from `setup.py`; image extra aliases are checked against the actual
built wheel metadata. Both architectures use built wheels in an isolated venv,
without a source checkout or editable project in the runtime image. CI and
release Dockerfiles use the same builder and lock; `RI_VERSION` must match the
source artifact version. `INGESTION_DEPENDENCY` accepts existing extras and
comma-separated selections, including an empty base-only selection. Automatic
DB2 installation remains AMD64-only. Required providers remain installed instead
of being removed after dependency resolution.

The image policy replaces psycopg2-binary with psycopg2 at its exact tested
version and checks that replacement explicitly; ordinary `pip check` cannot
represent that distribution-name substitution. The existing exact
sqlalchemy-ibmi metadata exception also applies, with its SQLAlchemy constraint
checked rather than ignored. No published package metadata is rewritten.

After changing dependency constraints, rebuild artifacts, check/update image
aliases, and deliberately refresh the image lock before testing the images:

```sh
python scripts/python_image_environment.py manifest --artifacts /tmp/om-python-artifacts
# Use manifest --write only when the checked aliases/image policy need updating.
uv lock --project ingestion/images/runtime
uv lock --check --project ingestion/images/runtime
python scripts/python_image_environment.py export --artifacts /tmp/om-python-artifacts \
  --kind airflow --extras slim --architecture arm64 --output-dir /tmp/om-image-runtime
```

Exports retain package hashes and the selected lock identity. Dependabot checks
both locks weekly without changing shared constraints. Base images are pinned by
multi-architecture digest. Debian repositories and native driver downloads remain
external build inputs: the Python lock does not freeze OS packages, native
compiler output, or optional classification-model downloads. Validate native
inputs using `/opt/openmetadata-runtime/native-packages.txt` and
`/oracle-instantclient.sha256`, which record the actual OS versions and Oracle
archive checksum used by each build. Validate native
imports after cleanup and test both image architectures before a release; a lock
check alone is insufficient. Neither the local artifact commands nor Docker
builds publish anything.

Airflow's Bookworm base cannot load mysql-connector-python 26.7's optional C
extension, which requires OpenSSL 3.2. Its normal connection API falls back to
Python (tested against MySQL on both architectures); explicitly requesting
`use_pure=False` fails on that base. The separate mysqlclient driver remains
native. The operator's Trixie base supports the C extension.

## Using the Skills

### Slash Commands Quick Reference

| Command | When to use | What it does |
|---------|-------------|-------------|
| `/planning` | Starting any non-trivial task | Brainstorm approaches, get approval, create step-by-step plan |
| `/tdd` | Implementing any feature or fix | Guides RED-GREEN-REFACTOR cycle for Java/Python/TypeScript |
| `/test-enforcement` | Before creating a PR | Checks 90% coverage, integration tests, Playwright E2E |
| `/verification` | Before claiming "done" | Requires actual test output as evidence |
| `/code-review` | Before or during PR review | Two-stage review: spec compliance then code quality |
| `/systematic-debugging` | Bug with unclear root cause | 4-phase: gather evidence, hypothesize, verify, fix |
| `/playwright` | Adding E2E tests | Generates zero-flakiness Playwright tests following handbook |
| `/connector-standards` | Before connector work | Loads all 23 connector development standards |
| `/connector-review` | Reviewing connector PRs | Multi-agent review against golden standards |
| `/scaffold-connector` | Building a new connector | Generates JSON Schema, Python boilerplate, AI context |
| `/test-locally` | Testing in full environment | Builds and deploys local Docker stack |
| `/ui-pr-recording` | Creating a PR for a UI feature or feature task | Runs the PR build in Docker with sample data and embeds a verified GitHub-hosted recording in the PR description |

### Workflow Routing

The `openmetadata-workflow` meta-skill (loaded at session start) routes tasks automatically:

| Task | Skills triggered in order |
|------|--------------------------|
| New feature (multi-file) | `/planning` -> `/tdd` -> `/test-enforcement` -> `/verification` |
| Bug fix | `/systematic-debugging` -> `/tdd` -> `/verification` |
| New API endpoint | `/planning` -> `/tdd` -> `/test-enforcement` (must include IT) |
| New connector | `/connector-standards` -> `/scaffold-connector` -> `/test-enforcement` |
| UI component | `/tdd` -> `/test-enforcement` (Jest + Playwright) |
| PR review | `/code-review` -> `/test-enforcement` |

---

## Architecture Deep Dives

### Schema-First Design

OpenMetadata uses a single-source-of-truth approach: JSON Schema definitions drive code generation across all languages.

**The pipeline:**
```
openmetadata-spec/src/main/resources/json/schema/
    │
    ├── entity/          → Entity definitions (table.json, dashboard.json, ...)
    │   ├── data/        → Data entities (table, topic, dashboard, pipeline, ...)
    │   ├── services/    → Service entities (databaseService, dashboardService, ...)
    │   │   └── connections/  → Connection configs per service type
    │   ├── teams/       → Team/user entities
    │   ├── policies/    → Governance entities
    │   └── feed/        → Activity feed entities
    │
    ├── api/             → API request/response objects (createTable.json, ...)
    │
    └── type/            → Shared type definitions (entityReference.json, tagLabel.json, ...)

                    ↓ Code generation ↓

Java POJOs:     jsonschema2pojo → openmetadata-spec/target/generated-sources/
Python models:  datamodel-code-generator → ingestion/src/metadata/generated/
TypeScript:     QuickType → openmetadata-ui/.../ui/src/generated/
UI forms:       parseSchemas.js → resolved JSON for RJSF auto-rendering
```

**When you modify a schema:**
1. Edit the JSON schema in `openmetadata-spec/`
2. Run `make generate` (Python models)
3. Run `mvn clean install -pl openmetadata-spec` (Java POJOs)
4. Run `yarn parse-schema` (UI connection schemas only)
5. Add corresponding Flyway migration if the change affects the database

**Schema conventions:**
- `$id` must match the file path
- `title` is camelCase of the filename
- `javaType` follows `org.openmetadata.schema.{category}.{ClassName}`
- Use `$ref` for shared types
- Set `additionalProperties: false` on connection schemas
- Feature flags: `supportsMetadataExtraction`, `supportsProfiler`, `supportsDBTExtraction`, `supportsQueryComment`

### Entity Model and Registry

All entities implement `EntityInterface` and are registered in `Entity.java` — the central singleton registry.

**Entity.java key patterns:**

```java
// Entity type string constants (use these, never raw strings)
Entity.TABLE           // "table"
Entity.DATABASE        // "database"
Entity.DATABASE_SCHEMA // "databaseSchema"
Entity.DASHBOARD       // "dashboard"
Entity.PIPELINE        // "pipeline"

// Common field name constants (use these for field references)
Entity.FIELD_OWNERS
Entity.FIELD_TAGS
Entity.FIELD_DESCRIPTION
Entity.FIELD_DOMAINS
Entity.FIELD_FULLY_QUALIFIED_NAME

// FQN separator
Entity.SEPARATOR       // "."

// Access repositories by entity type
EntityRepository<?> repo = Entity.getRepository(entityType);

// Build href for entity references
Entity.withHref(uriInfo, entityReference);
```

**Fully Qualified Names (FQN):**

Entities form a hierarchy with `.` separator:
```
databaseService.database.databaseSchema.table
databaseService.database.databaseSchema.table.column
dashboardService.dashboard
pipelineService.pipeline
```

Each `EntityRepository` must implement `setFullyQualifiedName()` to build the FQN from parent FQN + entity name.

### REST Resource Pattern

All entity REST resources extend `EntityResource<E, R extends EntityRepository<E>>`.

**Creating a new resource:**

```java
@Path("/v1/myEntities")
@Tag(name = "MyEntities")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "myEntities")
public class MyEntityResource extends EntityResource<MyEntity, MyEntityRepository> {

    public static final String COLLECTION_PATH = "/v1/myEntities/";
    public static final String FIELDS = "owners,tags,domain";

    public MyEntityResource(Authorizer authorizer, Limits limits) {
        super(Entity.MY_ENTITY, authorizer, limits);
    }

    // Inner class for list serialization (required, no body)
    public static class MyEntityList extends ResultList<MyEntity> {}

    // Standard endpoints are inherited from EntityResource:
    // GET    /v1/myEntities          — list with pagination
    // GET    /v1/myEntities/{id}     — get by ID
    // GET    /v1/myEntities/name/{fqn} — get by FQN
    // POST   /v1/myEntities          — create
    // PUT    /v1/myEntities          — create or update
    // PATCH  /v1/myEntities/{id}     — JSON patch
    // DELETE /v1/myEntities/{id}     — soft/hard delete
}
```

**Conventions:**
- All methods receive `@Context SecurityContext` and `@Context UriInfo`
- Cursor-based pagination with `before`/`after` string params + `limit` int
- Field filtering via `fields` query param (comma-separated, maps to `FIELDS` constant)
- A dedicated `*Mapper` class handles Create DTO -> Entity mapping
- Override `getEntitySpecificOperations()` to register field-level view permissions

### JDBI3 Data Access Layer

OpenMetadata uses JDBI3 (not JPA/Hibernate) for database access. All repositories extend `EntityRepository<E>`.

**Creating a new repository:**

```java
@Slf4j
public class MyEntityRepository extends EntityRepository<MyEntity> {

    public MyEntityRepository() {
        super(
            MyEntityResource.COLLECTION_PATH,
            Entity.MY_ENTITY,
            MyEntity.class,
            Entity.getCollectionDAO().myEntityDAO(),  // DAO interface
            "",    // patch fields
            ""     // put fields
        );
        supportsSearch = true;  // enable ES indexing
    }

    // Required overrides:

    @Override
    public void setFullyQualifiedName(MyEntity entity) {
        entity.setFullyQualifiedName(
            FullyQualifiedName.build(entity.getService().getFullyQualifiedName(),
                                     entity.getName()));
    }

    @Override
    public void prepare(MyEntity entity, boolean update) {
        // Validate references, populate service, resolve owners/tags
        populateService(entity);
    }

    @Override
    public void storeEntity(MyEntity entity, boolean update) {
        store(entity, update);
    }

    @Override
    public void storeRelationships(MyEntity entity) {
        addServiceRelationship(entity, entity.getService());
    }
}
```

**Key patterns:**
- `@Transaction` annotation for multi-step writes
- `Entity.getCollectionDAO()` provides type-safe DAO access
- Override `getFieldsStrippedFromStorageJson()` to exclude computed fields from JSON storage
- Bulk operations: override `storeEntities()`, `clearEntitySpecificRelationshipsForMany()`, `storeEntitySpecificRelationshipsForMany()`

### Database Migrations

OpenMetadata uses a **hybrid migration system**: native SQL migrations tracked in `SERVER_CHANGE_LOG`, with Flyway SQL parsers for robust semicolon handling.

**Adding a new migration:**

1. Create the version directory:
   ```
   bootstrap/sql/migrations/native/{version}/
   ├── mysql/schemaChanges.sql
   └── postgres/schemaChanges.sql
   ```

2. Write both MySQL and PostgreSQL variants:
   ```sql
   -- MySQL
   ALTER TABLE my_entity ADD COLUMN new_field JSON;
   ALTER TABLE my_entity ADD INDEX idx_new_field ((new_field->>'$.key'));

   -- PostgreSQL
   ALTER TABLE my_entity ADD COLUMN new_field JSONB;
   CREATE INDEX idx_new_field ON my_entity ((new_field->>'key'));
   ```

**Rules:**
- Always one `schemaChanges.sql` per database per version — no numbered sub-files
- Always provide both MySQL and PostgreSQL variants
- Migrations are tracked in `SERVER_CHANGE_LOG` (keyed by version)
- Never add new `v0xx` Flyway files — always use the native path
- Migrations must be idempotent where possible (`IF NOT EXISTS`, etc.)
- Extension migrations go in `bootstrap/sql/migrations/extensions/{name}/`

### Change Events and Audit

Every non-GET API response triggers the change event system via `ChangeEventHandler` (a JAX-RS `ContainerResponseFilter`).

**Flow:**
```
HTTP Response (non-GET)
    → ChangeEventHandler.process()
        → Extract ChangeEvent from response
        → Set userName from SecurityContext
        → Mask PII in entity JSON
        → Persist to changeEventDAO (unless ENTITY_NO_CHANGE)
        → Send to WebsocketNotificationHandler (real-time UI)
```

**Event types (`EventType` enum):**
- `ENTITY_CREATED` — new entity
- `ENTITY_UPDATED` — modified entity
- `ENTITY_SOFT_DELETED` — soft delete
- `ENTITY_DELETED` — hard delete
- `ENTITY_NO_CHANGE` — no-op (not persisted)

**When adding a new entity type:** change events are automatic if your resource extends `EntityResource`. No manual wiring needed. However, `Entity.QUERY` and `Entity.WORKFLOW` events are excluded by default.

### Authorization (RBAC)

Authorization uses the `Authorizer` interface, injected into all resource classes.

**Pattern in resources:**
```java
// All mutating operations must authorize:
authorizer.authorize(securityContext, operationContext, resourceContext);

// OperationContext wraps the MetadataOperation enum:
new OperationContext(Entity.TABLE, MetadataOperation.CREATE)
new OperationContext(Entity.TABLE, MetadataOperation.EDIT_TAGS)

// ResourceContextInterface provides the target entity
```

**Key classes:**
- `Authorizer` — interface with `authorize()`, `authorizeAdmin()`, `authorizeAdminOrBot()`
- `DefaultAuthorizer` — production implementation using `PolicyEvaluator`
- `NoopAuthorizer` — allows everything (for testing)
- `PolicyEvaluator` — evaluates rules against `SubjectContext` + `ResourceContextInterface` + `OperationContext`
- `SubjectCache` — caches permission evaluations per user

**When adding new resources:** ensure all mutating methods call `authorizer.authorize()` before execution. Override `getEntitySpecificOperations()` in the resource to register field-level view permissions.

### Search Infrastructure

Entities are indexed in Elasticsearch 7.17+ or OpenSearch 2.6+ for discovery.

**Key patterns:**
- Set `supportsSearch = true` in the repository constructor to enable indexing
- Search index classes in `openmetadata-service/src/main/java/org/openmetadata/service/search/indexes/`
- Each entity type has a corresponding `*Index.java` that defines the search document structure
- Reindexing triggered via the reindex API or on entity create/update

### Python Ingestion Topology

Connectors use a **declarative topology** that defines the entity traversal order.

**Core concept:**
```python
# Topology defines the execution graph:
class DatabaseServiceTopology(ServiceTopology):
    root = TopologyNode(
        producer="get_services",
        stages=[NodeStage(type_=DatabaseService, ...)],
        children=["database"],
    )
    database = TopologyNode(
        producer="get_database_names",
        stages=[NodeStage(type_=Database, processor="yield_database", ...)],
        children=["database_schema"],
    )
    database_schema = TopologyNode(
        producer="get_database_schema_names",
        stages=[NodeStage(type_=DatabaseSchema, processor="yield_database_schema", ...)],
        children=["table"],
    )
    table = TopologyNode(
        producer="get_tables_name_and_type",
        stages=[NodeStage(type_=Table, processor="yield_table", ...)],
    )
```

**Key patterns:**
- `producer` is a method name on the source class that yields entity names
- `processor` is a method name that yields the entity objects
- `TopologyRunnerMixin` drives the depth-first traversal automatically
- `TopologyContext` tracks the current position in the hierarchy (for FQN building)
- `Either` monad wraps all results: `Either(right=entity)` or `Either(left=error)`
- Fingerprinting via `sourceHash`: CREATE if new, PATCH if changed, SKIP if identical
- Nodes with `threads=True` enable parallel processing

**Source class hierarchy:**
```
Source (abstract)
  → DatabaseServiceSource (defines topology + abstract methods)
      → CommonDbSourceService (SQL extraction via SQLAlchemy)
          → PostgresSource, MySQLSource, SnowflakeSource, ...
```

**ServiceSpec pattern:**
```python
ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=BigquerySource,
    lineage_source_class=BigqueryLineageSource,
    usage_source_class=BigqueryUsageSource,
    profiler_class=BigQueryProfiler,
    sampler_class=BigQuerySampler,
)
```

### Frontend Patterns

#### i18n Key Structure

Translation keys live in `locale/languages/en-us.json`:

```json
{
  "label": {
    "add-entity": "Add {{entity}}",
    "activity-feed": "Activity Feed",
    "activity-feed-plural": "Activity Feeds",
    "delete-entity": "Delete {{entity}}"
  },
  "message": {
    "entity-deleted-successfully": "{{entity}} deleted successfully!"
  },
  "server": {
    "unexpected-error": "An unexpected error occurred"
  }
}
```

**Conventions:**
- Keys use kebab-case: `add-data-product`, `activity-feed-and-task-plural`
- Namespaces: `label` (UI labels), `message` (user-facing messages), `server` (error messages)
- Interpolation: `{{paramName}}` double-brace mustache
- Plurals: append `-plural` suffix: `"activity"` / `"activity-plural"`
- Variants: `-uppercase`, `-lowercase`, `-with-colon`

**Usage:**
```tsx
const { t } = useTranslation();
// Simple
<span>{t('label.activity-feed')}</span>
// With parameter
<span>{t('label.add-entity', { entity: t('label.table') })}</span>
```

#### Component Library

Use `openmetadata-ui-core-components` for all new UI work:
- Components: Button, Input, Select, Modal, Table, Tabs, Pagination, Badge, Avatar, Checkbox, Dropdown, Form, Card, Tooltip, Toggle, Slider, Textarea, Tags
- Source: `openmetadata-ui-core-components/src/main/resources/ui/src/components/`
- Tailwind CSS v4 with `tw:` prefix for all utility classes
- CSS custom properties for design tokens (see `globals.css`)

#### State Management

| Scope | Tool | Example |
|-------|------|---------|
| Component-local | `useState` | Form inputs, toggle states |
| Feature-shared | Context providers | `ApplicationsProvider` |
| Global | Zustand stores | `useLimitStore`, `useWelcomeStore` |

#### Generated Types

TypeScript interfaces are generated from JSON schemas and live in:
```
openmetadata-ui/src/main/resources/ui/src/generated/
```

Always import from `generated/` for API response types. Never hand-write interfaces for schema-defined types.

---

## Cross-Cutting Patterns

### Design Patterns Used Across the Codebase

| Pattern | Where | Purpose |
|---------|-------|---------|
| Schema-first | Everywhere | JSON Schema drives all code generation |
| Topology | Python ingestion | Declarative traversal of entity hierarchies |
| Either monad | Python ingestion | Unified error handling without exceptions |
| Singledispatch | `MetadataRestSink` | Type-based routing for entity persistence |
| Registry | `Entity.java`, `Metrics` enum | Central lookup for entity types and metric implementations |
| Template method | Validators, repositories | Base class defines skeleton, subclasses fill in steps |
| Strategy via mixins | Profiler, sampler | SQA vs Pandas implementations composed via mixin |
| Dynamic import | Connectors, validators | Zero-config discovery by file path convention |
| Fingerprinting | Ingestion | `sourceHash` for incremental create/patch/skip |
| Mixin composition | `OpenMetadata` API client | 25+ specialized mixins for different entity operations |
| Factory | Interface/sampler/profiler | Create the right implementation for the service type |
| Cascade parsing | Lineage | SqlGlot -> SqlFluff -> SqlParse (each with timeout) |

### Performance Patterns

- **Pagination is mandatory** for all list APIs (REST and database)
- **Stream, don't accumulate** — use generators in Python, iterators in Java
- **Reuse HTTP sessions** — one `requests.Session()` per connector lifetime
- **Bound caches** with `lru_cache(maxsize=N)` or size-limited maps
- **Build lookup dictionaries in `prepare()`** for O(1) access instead of repeated iteration
- **Use `computeIfAbsent()`** instead of `containsKey()` + `get()` double lookups
- **No `Thread.sleep()` in tests** — use condition-based waiting

### Adding a New Entity (End-to-End Checklist)

1. **JSON Schema**: Create `openmetadata-spec/src/main/resources/json/schema/entity/{category}/{entity}.json`
2. **API Schema**: Create `openmetadata-spec/src/main/resources/json/schema/api/{category}/create{Entity}.json`
3. **Generate code**: `mvn clean install -pl openmetadata-spec` + `make generate`
4. **Entity constant**: Add `Entity.MY_ENTITY = "myEntity"` in `Entity.java`
5. **DAO**: Add `myEntityDAO()` method to `CollectionDAO`
6. **Repository**: Create `MyEntityRepository extends EntityRepository<MyEntity>`
7. **Mapper**: Create `MyEntityMapper`
8. **Resource**: Create `MyEntityResource extends EntityResource<MyEntity, MyEntityRepository>`
9. **Migration**: Create `bootstrap/sql/migrations/native/{version}/mysql/schemaChanges.sql` + postgres variant
10. **Search index**: Create `MyEntityIndex.java` if searchable
11. **Integration test**: Create `MyEntityIT extends BaseEntityIT<MyEntity, CreateMyEntity>` in `openmetadata-integration-tests/`
12. **Frontend**: Add generated types, API client methods, and UI components
13. **i18n**: Add labels to `en-us.json`

### Adding a New Connector (End-to-End Checklist)

1. **Connection schema**: `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/{type}/{connector}.json`
2. **Service type enum**: Add to `{type}Service.json` `oneOf` list
3. **Generate code**: `make generate` + `mvn clean install -pl openmetadata-spec`
4. **ClassConverter** (if using `oneOf`): `openmetadata-service/src/main/java/org/openmetadata/service/secrets/converter/`
5. **Python source class**: `ingestion/src/metadata/ingestion/source/{type}/{connector}/`
   - `connection.py` — connection handling
   - `metadata.py` — metadata extraction
   - `__init__.py` — ServiceSpec definition
6. **Unit tests**: `ingestion/tests/unit/topology/{type}/test_{connector}.py`
7. **UI integration**: Update `{type}ServiceUtils.tsx`, add MDX doc file
8. **Run**: `yarn parse-schema` for UI form generation
