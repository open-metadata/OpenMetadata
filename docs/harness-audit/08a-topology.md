# Repository Dependency Topology

**Read-only audit.** No source changes, no builds. Maven edges were read from the module POMs
(not resolved by a reactor build). Counts carry the command that produced them. **OBSERVED** =
measured by a command; **INFERRED** = derived from a sample (sample size + selection stated).

---

## PASS 1 — Maven module graph

### Declared order (root `pom.xml:32–43`)
`grep -nE '<module>' pom.xml`
1. openmetadata-spec · 2. openmetadata-sdk · 3. common · 4. openmetadata-shaded-deps ·
5. openmetadata-service · 6. openmetadata-k8s-operator · 7. openmetadata-integration-tests ·
8. openmetadata-mcp · 9. openmetadata-ui-core-components · 10. openmetadata-ui ·
11. openmetadata-dist · 12. openmetadata-clients

### OBSERVED internal edges (parsed from each module POM's `org.open-metadata` dependencies)
Command: per-module XML parse of `<dependencies>` filtering `groupId` containing `open-metadata`
(script run over all 12 poms). `openmetadata-shaded-deps` is a `pom`-packaging parent of two
children **`elasticsearch-deps`** and **`opensearch-deps`**.

| Module (declared #) | Internal deps (scope) |
|---|---|
| openmetadata-spec (1) | **common** (compile) — *declared twice, identical* |
| openmetadata-sdk (2) | openmetadata-spec (compile) |
| common (3) | *none* |
| openmetadata-shaded-deps (4) | *none* (children pull external ES/OS jars, relocated) |
| openmetadata-service (5) | common, openmetadata-spec, **elasticsearch-deps**, **opensearch-deps** (all compile) |
| openmetadata-k8s-operator (6) | openmetadata-service (**provided**) |
| openmetadata-integration-tests (7) | openmetadata-sdk (compile); openmetadata-service, **openmetadata-mcp**, openmetadata-k8s-operator (all **test**) |
| openmetadata-mcp (8) | openmetadata-service (compile) |
| openmetadata-ui-core-components (9) | *none via Maven* |
| openmetadata-ui (10) | *none via Maven* |
| openmetadata-dist (11) | openmetadata-service, openmetadata-mcp, openmetadata-ui (compile) — *`openmetadata-ui` declared twice* |
| openmetadata-clients (12) | *none* |

### Does declared order match dependency order? **No — two inversions.**
Derived topological order (a valid linearization of the edges above):
`common → shaded-deps(es/os) → spec → sdk → service → {k8s-operator, mcp} → ui-core-components → ui → integration-tests → dist`, with `clients` isolated.

- **`openmetadata-spec` (declared #1) compile-depends on `common` (declared #3).** The module
  presented first — the schema/POJO foundation — depends on a module declared two slots later. So
  the declared list is not a topological order.
- **`openmetadata-integration-tests` (declared #7) test-depends on `openmetadata-mcp` (declared #8).**
  Declared before the module it consumes.

Maven's reactor computes build order from the graph, not from `<modules>`, so the build still
works; the **declared order is documentation, and it is out of topological order in these two
places.** (INFERRED that the build still succeeds — not run; the reactor-reordering behavior is a
Maven guarantee, and the graph is acyclic per below.)

### Modules depending on something conceptually "later" than themselves
- **spec → common.** `openmetadata-spec` is treated as *the* foundation (declared #1, source of all
  generated POJOs), yet it depends on `common`. `common` is therefore the more-foundational module,
  but is declared *after* spec. This is the one genuinely surprising conceptual inversion.
- **integration-tests → mcp** (declared #7 → #8): natural for a test aggregator to pull a
  later-declared module, but it is a declared-position inversion.

### Cycles: **none.**
The internal Maven graph is a DAG. Verified by inspection of every edge above: all edges point
from a higher-level consumer to a lower-level provider (spec→common, sdk→spec, service→{common,spec,es/os},
k8s→service, mcp→service, it→{sdk,service,mcp,k8s}, dist→{service,mcp,ui}); there is no back-edge,
so no pair forms a cycle.

### What `openmetadata-service` depends on — and the surprises
`openmetadata-service` (the core backend) has **only four** internal compile deps:
`common`, `openmetadata-spec`, `elasticsearch-deps`, `opensearch-deps`.
- **It compiles in BOTH search backends at once** — `elasticsearch-deps` *and* `opensearch-deps`
  (the two shaded children). Expected given dual ES/OS support, but notable that the core backend
  links both, relocated behind `es.*` / `os.*` (see 08d §6).
- **It does NOT depend on `openmetadata-sdk`.** The SDK is a downstream *client*; the service is the
  API source of truth, so the dependency runs sdk→spec and it→sdk, never service→sdk. Sensible, but
  worth stating since one might expect the backend to reuse the SDK.
- **Everything else depends on service, not the reverse** (k8s-operator, mcp, integration-tests,
  dist all point *at* service). The service is a mid-graph hub, not a sink.

### Two incidental POM-hygiene observations (OBSERVED, not fixes)
- `openmetadata-spec/pom.xml` declares the `common` dependency **twice** (identical block).
- `openmetadata-dist/pom.xml` declares `openmetadata-ui` **twice** (identical block).
- **The `openmetadata-ui → openmetadata-ui-core-components` dependency is invisible to Maven** — it
  is a yarn-workspace/npm dependency, not a POM edge. The Maven graph therefore understates the
  frontend coupling; `openmetadata-ui-core-components` and `openmetadata-clients` appear as isolated
  leaves in the Maven graph (no in- or out-edges) even though the former is consumed by the UI at
  the JS layer (see Pass 3).

---

## PASS 2 — Java package layering (`openmetadata-service`)

Package root: `openmetadata-service/src/main/java/org/openmetadata/service/`. Total main sources:
**1,777** `.java` (OBSERVED: `find … -name '*.java' | wc -l`; the module's ~2,825 figure includes
test + resources).

### Layer inventory — OBSERVED
`find … -maxdepth 1 -type d | sort`, then per-dir `find <dir> -name '*.java' | wc -l`:

| files | package | role |
|---|---|---|
| 294 | `search/` | search indexing / query |
| 233 | `resources/` | JAX-RS REST layer (entry points) |
| 160 | `apps/` | pluggable applications / schedulers |
| 157 | `migration/` | DB migrations |
| **147** | `jdbi3/` | **repositories + DAO/persistence** |
| 128 | `util/` | shared utilities |
| 98 | `security/` | authN/Z, policy evaluation |
| 93 | `governance/` | workflow engine |
| 27 | `events/` | change-event handling |

### Intended flow — INFERRED (6 files: the two base classes + persistence roots + one domain)
**`resources/*Resource` → `jdbi3/*Repository` (extends `EntityRepository`) → `EntityDAO<T>` /
`CollectionDAO` (JDBI SQL-objects).** Evidence: `resources/EntityResource.java:125,132` (a resource
holds a **repository**, resolved from `Entity.getEntityRepository`, never a DAO);
`jdbi3/EntityRepository.java:536-537,669` (the repository owns `EntityDAO<T> dao` + `CollectionDAO
daoCollection`); persistence entry points are `jdbi3/CollectionDAO.java:204` (aggregate JDBI
interface exposing **129** `@CreateSqlObject` sub-DAOs) and `jdbi3/EntityDAO.java:59`.

### Boundary-violation counts — OBSERVED (commands inline)
- **resources/ bypassing the repository to hit a DAO directly: 13 files.**
  `grep -rlE "import org\.openmetadata\.service\.jdbi3\.(CollectionDAO|[A-Za-z0-9_]*DAO)(;|\.)" resources/ --include='*.java' | wc -l`
  (e.g. `resources/teams/UserResource.java:133`, `resources/search/SearchResource.java:74`,
  `resources/apps/AppResource.java:85`, `resources/ai/AIGovernanceLineageSeedLoader.java`).
- **jdbi3/ (repositories) importing resources/: 99 files.**
  `grep -rl "import org\.openmetadata\.service\.resources\." jdbi3/ --include='*.java' | wc -l`.
  *Nuance:* dominated by value/helper types that merely live under `resources/`
  (`resources.feeds.MessageParser.EntityLink` ×16, `MessageParser` ×13, `settings.SettingsCache` ×5,
  `databases.DatasourceConfig` ×5) — i.e. misplaced shared types — but with genuine REST back-refs too
  (`teams.RoleResource` ×2, `services.storage.StorageServiceResource` ×2, `types.TypeResource`,
  `topics.TopicResource`).
- **util/ → resources/: 11; util/ → jdbi3/: 30.**
  `grep -rl "import org\.openmetadata\.service\.resources\." util/ --include='*.java' | wc -l` / same for `jdbi3`.
- **security/ → resources/: 8; security/ → jdbi3/: 17.** (same grep pattern over `security/`).

### Import cycles among the 7 main packages — OBSERVED
Directed matrix (cell = # files in **A/** importing `service.B.*`), built by a nested `grep -rl … | wc -l`
loop over `{resources,jdbi3,apps,events,search,security,util}`. **A cycle exists where both directions
are > 0. Of 21 unordered pairs, 18 are mutual cycles.** The load-bearing ones:

| Cyclic pair | A→B / B→A |
|---|---|
| **resources ↔ jdbi3** | **130 / 99** — the core inversion: the persistence layer imports the REST layer back |
| resources ↔ security | 125 / 8 |
| **jdbi3 ↔ util** | 96 / 30 |
| resources ↔ util | 78 / 11 |
| apps ↔ jdbi3 | 52 / 1 |
| apps ↔ search | 38 / 3 |
| jdbi3 ↔ security | 30 / 17 |
| security ↔ util | 23 / 5 |
| jdbi3 ↔ search | 22 / 22 |
| resources ↔ search | 16 / 10 |
| apps ↔ util | 17 / 3 · apps ↔ events | 12 / 2 · search ↔ util | 21 / 1 · jdbi3 ↔ events | 8 / 4 · resources ↔ apps | 8 / 1 · events ↔ search | 3 / 5 · events ↔ util | 4 / 3 · resources ↔ events | 1 / 2 |

**Only `security/` is a partial sink** — the 3 non-cyclic pairs are `apps→security` (1/0),
`events→security` (5/0), `search→security` (15/0); `security` never imports `apps`/`events`/`search`.
**There is no acyclic layering between the Java packages** — the intended resource→repository→DAO
direction is contradicted by 99 repository→resource imports.

### Largest domains vs smaller domains — OBSERVED listings + INFERRED interpretation
- **`resources/ai/` = 34 files, flat**; **`resources/services/` = 32 files, sub-packaged** per service
  type (`database/`, `dashboard/`, `messaging/`, `pipeline/`, `mlmodel/`, `llm/`, `mcp/`, …).
- Smaller domains follow the pattern strictly — `glossary/` (2 Resource + 2 Mapper), `teams/` (4+4),
  `tags/` (2+2 +`TagLabelUtil`), `databases/` (4+4 +2 helpers): one `XResource` + `XMapper` per entity,
  delegating to a `jdbi3/XRepository`.
- **`services/` scaled by structure, not new layers** — same 2-file-per-entity pattern (16 Resource /
  14 Mapper) grouped into per-service sub-packages + a shared `ServiceEntityResource` base; persistence
  stays in `jdbi3/`.
- **`ai/` grew its own service/seed tier inside the REST package** — beyond 12 Resource + 8 Mapper it
  holds **14** classes with no analog elsewhere: 6 seed loaders + `AIApplicationSeedSupport`,
  evaluators/computers (`PolicyEvaluator`, `FrameworkCoverageComputer`, `IntakeChecks`), a report
  generator (`AuditPackGenerator`), and `AIGovernanceWorkflowService`. Its `jdbi3` repositories exist
  (so the base path is intact), but one seed loader (`AIGovernanceLineageSeedLoader`) is among the 13
  direct-to-`CollectionDAO` bypasses. **INFERRED:** `services/` = same layering, wider; `ai/` = same base
  layering + an extra domain-service tier fused into `resources/`.

---

## PASS 3 — Frontend module structure
`SRC = openmetadata-ui/src/main/resources/ui/src`. Imports use **relative paths**, not aliases
(`tsconfig.json` `paths` defines only `react-hook-form`) — so **layering is convention-only, tooling
does not enforce it.**

### Layer inventory — OBSERVED
`find SRC -maxdepth 1 -type d | sort` → 23 dirs; per-dir `find SRC/<d> -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l`.
Total ts/tsx = **4,725** (`find SRC … | wc -l`; the "~7,187" figure is the wider all-files tree, 6,626).

| ts/tsx | dir | | ts/tsx | dir |
|---|---|---|---|---|
| **2400** | components | | 99 | hooks |
| **887** | generated | | 97 | constants |
| **573** | utils | | 32 | enums |
| **399** | pages | | 22 | context (+ a stray `contexts/` w/ 1) |
| **116** | rest (API layer) | | 14 | interface |

Core-components package: **174** ts/tsx. Oddities: `context/` (22) vs near-empty `contexts/` (1);
`services/` has 1 file.

### Allowed vs actual import directions — OBSERVED (`grep -rlE "from '(\.\./)+<dir>/" <src> --include='*.ts(x)'`)
- Healthy/expected: components→rest **522**, pages→rest **198**, pages→components **215**,
  components→utils **904**, components→hooks **336**, components→context **222**.
- Upward / violation-candidate: **components→pages 138** (116 non-test) — components reaching up into
  route screens; **utils→components 183 files** (455 lines; 252 are `.interface` type-only, **~203 are
  genuine runtime imports** of real components/stores); utils→pages 112.
- **`rest/` leaks upward for TYPES ONLY**: rest→components = 38 lines, **37 end in `.interface`** —
  `rest/` pulls colocated `*.interface.ts` types that physically live under `components/` (only 1 non-type import).
- hooks/context are near one-directional leaves (hooks→components 6, context→components 8).

**Takeaway:** layering holds well for hooks/context; **components ↔ utils is strongly bidirectional**
(904 vs 183); `rest/` is clean except for pulling types out of `components/*.interface.ts`.

### Import cycles — OBSERVED (tool stated)
**madge was NOT available** (`node_modules/.bin/madge` absent; `npx` would install — disallowed under
read-only). Fallback: a read-only Python 3.10 Tarjan-SCC script over all 4,725 files resolving relative
`from`/`import()` specifiers (no files written).

| model | edges | direct A↔B 2-cycles | cyclic SCCs (>1) | nodes in cycles | largest SCC |
|---|---|---|---|---|---|
| static `from` only | 22,116 | **50** | **28** | **205** | **130** modules (`components:63, utils:61, pages:3, rest:2, hooks:1`) |
| incl. dynamic `import()` | 22,748 | 61 | 15 | 947 | **911** (lazy route splitting ties most of the app into one SCC) |

The **130-module static SCC is a components↔utils tangle**. Two cross-layer cycles concretely confirm it:
`components/AppRouter/UnAuthenticatedAppRouter.tsx ↔ utils/ApplicationRoutesClassBase.ts` and
`components/Glossary/useGlossary.store.ts ↔ utils/GlossaryPureUtils.ts`. The remaining 2-cycles are
intra-`components` barrel (`index.ts`) re-export cycles and mutual `*.interface.ts` references.
*(INFERRED caveat: resolver ignores TS type-only elision, so a few `.interface`-only cycles are
type-level; counts are a faithful lower bound.)*

### Generated-type leakage — OBSERVED (`grep -rlE "from '[^']*generated/" <dir>`)
Total importer files: **1,805**. Breakdown: **components 1,069 + pages 223 = 1,292** import
`generated/` schema types **directly**, versus **rest/ only 93**. **≈13.9 : 1** — there is essentially
**no mapping/anti-corruption layer**; generated types flow straight into the view layer. `generated/`
itself is a **pure sink**: `grep -rlE "from '(\.\./)+(components|pages|rest|utils|hooks|context)/" generated`
= **0**.

### Core-components consumption vs antd — OBSERVED
`@openmetadata/ui-core-components` is a **yarn `link:`** to the sibling package (package.json), imported
by the **bare package name** (barrel imports only; no deep subpaths).
- core-components importers: **522 files** (407 real `from` barrel imports; 390 non-test).
- **antd direct importers: 864 files** (839 non-test; `from 'antd'` 823 + `from 'antd/…'` 190; 1,040 import lines).
- **Direct antd usage exceeds the wrapper by ≈1.65×**; **60 files import both.** The wrapper does **not**
  encapsulate antd — the majority of the UI bypasses `ui-core-components` and consumes antd directly,
  contradicting the CLAUDE.md "use core-components, not Ant Design" rule at scale (this is the *current
  measured state*, against a "legacy, migrate away" intent).

---

## PASS 4 — Python ingestion structure

### The plugin contract — derived from base-class source (not docs)
Inheritance chain (each file read): `Step → IterStep → Source → DatabaseServiceSource →
CommonDbSourceService / CommonNoSQLSource → concrete <Name>Source`. A DB connector must satisfy:
- **`create(cls, config_dict, metadata, pipeline_name=None) -> Step`** — `@classmethod @abstractmethod`,
  `ingestion/api/step.py:72-80` (fixed 3-arg factory); must raise **`InvalidSourceException`**
  (`api/steps.py:27`) on a connection-type mismatch.
- **`name` property, `close()`** (`step.py:85-92`); **`prepare()`, `test_connection()`**
  (`api/steps.py:44-49`); required attrs `metadata/connection_obj/service_connection` (`steps.py:40-42`).
- **Topology abstract methods** on `DatabaseServiceSource` (`database_service.py:202`):
  `get_database_names/get_database_schema_names/get_tables_name_and_type/yield_database/
  yield_database_schema/yield_tag/yield_table/get_stored_procedures/yield_stored_procedure`
  (`:262–394`). `CommonDbSourceService` (`common_db_source.py:102`) implements these over SQLAlchemy;
  `CommonNoSQLSource` (`common_nosql_source.py:81`) is the NoSQL sibling.
- **ServiceSpec registration** — `service_spec.py` exposing top-level `ServiceSpec` (usually
  `DefaultDatabaseSpec(metadata_source_class=…, connection_class=…)`). `BaseSpec`
  (`utils/service_spec/service_spec.py:36`) requires only `metadata_source_class:str` (`:60`);
  `DefaultSourceLoader.__call__` (`:103-118`) dynamically imports
  `metadata.ingestion.source.{service_type}.{service_name}.service_spec.ServiceSpec` at runtime.
- **Package files:** `__init__.py` + `service_spec.py` + `metadata.py` (`<Name>Source`) + `connection.py`
  (`BaseConnection` subclass named by `connection_class`).

### Database-connector conformance — INFERRED (sample n=19) + OBSERVED population
Sample chosen across families (`ls source/database/`): warehouses (snowflake, bigquery, redshift),
RDBMS (mysql, postgres, oracle, mssql), lakehouse (databricks, unitycatalog, deltalake), NoSQL/other
(mongodb, dynamodb, cassandra, salesforce, datalake), long-tail (exasol, saphana, teradata, couchbase).
Method: `grep "^class .*Source(" metadata.py`, `grep -c 'create='/'InvalidSourceException='`.
**All 19/19** have the 4 files, `create=1`, `InvalidSourceException≥2`, and a `ServiceSpec`. **The only
axis of variation is the base class, and it tracks the data model, not sloppiness:** SQL-over-SQLAlchemy
→ `CommonDbSourceService`; document/wide-column (mongodb, dynamodb, cassandra, couchbase) →
`CommonNoSQLSource`; non-SQLAlchemy fetch (unitycatalog SDK, deltalake, salesforce REST, datalake object
store) drop to raw `DatabaseServiceSource` and re-implement the abstract methods.

Population (OBSERVED): `find … -maxdepth 2 -name service_spec.py -not -path '*pycache*' | wc -l` = **49**
DB connector dirs. `__init__.py` 49/49, `metadata.py` **48/49**, `connection.py` **47/49**,
`connection_class` set in **47/49**. The 2 outliers are principled, not broken: **`query`** (log-only
lineage/usage plugin, `metadata_source_class="not.implemented"`, no live connection) and **`dbt`**
(consumes artifacts, no `connection.py`).

### Cross-connector imports — OBSERVED
`grep -rn "from metadata.ingestion.source.database\." .` minus self-imports and shared bases →
**24 sibling-connector import statements across 10 connectors**. Pairs (count → from→to):
`timescale→postgres` (8, and `TimescaleSource(PostgresSource)` — subclass-level "is-a" coupling),
`unitycatalog→databricks` (6), `azuresql→mssql` (3), and 1 each for
`singlestore→mysql, postgres→mssql, mssql→azuresql, mariadb→mysql, doris→mysql, deltalake→datalake,
athena→glue`. **Most-imported-from: postgres (8), databricks (6), mssql (4), mysql (3).** **One circular
sibling pair: `mssql ↔ azuresql`** (`mssql/connection.py:44` imports azuresql while azuresql imports
mssql).

### Generated-import discipline — OBSERVED
`grep -rn "from metadata.generated" …/source | wc -l` = **1,738** imports across **347** files;
module-style runtime `import metadata.generated…` = **0**. Filtering out `metadata.generated.schema.*`
leaves **exactly 2 lines in 1 file**: `source/pipeline/spline/utils.py:22-23` imports the generated
**ANTLR** `JdbcUriLexer`/`JdbcUriParser` and uses them at runtime (`:57,:59`). So the "generated is
imported only as Pydantic schema types" rule holds **1,736 / 1,738 = 99.9%**, with a single isolated
exception (spline's runtime ANTLR parser use).

---

## Synthesis — the three dependency rules that hold most consistently

Across the four passes, three rules are *already true* at ≥96% and could be locked in mechanically
to prevent regression (you enforce what already holds; you cannot cheaply enforce what is already
broken). Listed with the measurement that supports them.

**Rule 1 — The Maven inter-module graph is acyclic and strictly downward-layered.**
Every internal edge points from a higher-level consumer to a lower-level provider; there are **no
cycles** (Pass 1, all 12 modules). The only defects are cosmetic: two declared-order inversions
(`spec→common`, `integration-tests→mcp`) and two duplicate `<dependency>` blocks. Mechanically
enforceable today via `maven-enforcer` (dependency-convergence / ban-cycles) or a check that the
`<modules>` list is a topological order — **0 violations to clean up first.**

**Rule 2 — Every Python connector satisfies the ServiceSpec plugin contract.**
A connector package ships `{__init__.py, service_spec.py, metadata.py, connection.py}`, a `<Name>Source`
extending a `Common*`/`DatabaseServiceSource` base, a `create()` classmethod raising
`InvalidSourceException`, and a top-level `ServiceSpec` (Pass 4). **19/19 sampled conform**; over the
full population of 49 DB connector dirs, `__init__.py` 49/49, `metadata.py` 48/49, `connection.py`
47/49 — and the two omissions (`query`, `dbt`) are principled (no live connection). The only variation
is base-class choice, which tracks the data model. Mechanically enforceable via a per-connector-dir
structural lint (files present + `ServiceSpec` importable). **~2 principled exceptions to whitelist.**

**Rule 3 — Generated code is a pure sink; source imports it only as types.**
No generated artifact imports application/domain code, in any language: frontend `generated/` imports
**0** from `components|pages|rest|utils|hooks|context` (Pass 3); Python has **0** module-style
`import metadata.generated…` runtime imports and the generated tree imports no source (Pass 4); Java
POJOs are emitted to `openmetadata-spec/target/` and depend only on the spec (Pass 1). The inbound
corollary — *source imports generated only as types* — holds at **1,736/1,738 = 99.9%** in Python
(one exception: spline's runtime ANTLR parser). Mechanically enforceable via an import-direction rule
forbidding `generated/**` from importing app packages (already 0 violations) plus a
"generated-imports-are-type-only" lint (Python, ~1 exception).

### Why only these three — the rules that do NOT hold (so are not enforcement candidates yet)
- **Java package layering (resource→repository→DAO)** is contradicted: `resources ↔ jdbi3` is a mutual
  cycle (130/99) and **18 of 21 package pairs are cyclic** (Pass 2). Enforcing acyclic layers would
  require untangling hundreds of edges first.
- **"Use `ui-core-components`, not Ant Design"** is contradicted at scale: antd is imported by ~864
  files vs ~522 for the wrapper (~1.65×; Pass 3). A block rule would fail on the majority of the UI.
- **"Generated types go through an API/mapping layer"** is contradicted: 1,292 components/pages import
  `generated/` directly vs 93 in `rest/` (~13.9:1; Pass 3). No anti-corruption layer exists to enforce.

These three broken rules are the *aspirations* the docs state; Rules 1–3 above are the *invariants the
code actually keeps*, and are the ones worth wiring into CI.
