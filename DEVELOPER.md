# DEVELOPER.md — AI-Assisted Development Guide for OpenMetadata

This guide helps developers (and AI agents like Claude Code, Codex, Copilot) write correct, production-quality code in the OpenMetadata codebase. It covers the preferred workflow for each language, architecture patterns you must understand, and how to use the available skills.

For environment setup, build commands, and coding standards, see [CLAUDE.md](CLAUDE.md).
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
```

**Key rules:**
- Use components from `openmetadata-ui-core-components`, never MUI
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
5.                       make py_format && make lint
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
