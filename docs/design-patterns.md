# Design Patterns in this Codebase — a guideline for coding agents

The Gang-of-Four patterns that OpenMetadata **actually uses as established conventions**, each with
the canonical place to copy the idiom from. This is not a pattern tutorial and not a catalogue of all
23 — it lists only the patterns that recur idiomatically here, so that when you add code you extend
the pattern the codebase already relies on instead of inventing a parallel one.

## How to use this

- **Follow the local idiom.** When a situation matches one below, mirror the shape of the cited
  canonical example (same interface, same registration, same lifecycle hooks). Consistency across
  ~60 entity repositories and ~98 connectors is worth more than a cleverer one-off.
- **Don't over-apply.** A pattern earns its place only when it removes real duplication or decouples a
  real seam. Prefer the simplest thing that works; do not add a factory/registry/strategy layer for a
  single implementation (see `CLAUDE.md` on avoiding needless abstraction).
- **Match the language.** Java leans on interfaces + factories + registries + Lombok; Python on
  `classmethod` constructors, `singledispatch`, generators, and decorator registries; the UI on
  `*ClassBase` singletons and React context. Use the host language's mechanism, not a Java-ism in
  Python.
- Paths below are verified and kept fresh by the harness dead-reference check (`make harness-check`).

---

## Java backend (`openmetadata-service`, `common`, `openmetadata-sdk`)

### Creational

**Factory Method / Abstract Factory** — construct one of several implementations behind a common
type, chosen by config/provider; callers never `new` the concrete class.
- *Use it when* you add a provider/engine variant (a secrets backend, a search engine, a connection
  type): register the impl and let the factory pick it.
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/secrets/SecretsManagerFactory.java`
  (switch on provider), `openmetadata-service/src/main/java/org/openmetadata/service/secrets/converter/ClassConverterFactory.java`
  (map of 40+ converters), `openmetadata-service/src/main/java/org/openmetadata/service/search/SearchRepositoryFactory.java`
  (JDK `ServiceLoader` SPI). **Abstract Factory** (parallel ES vs OS product families) lives under
  `openmetadata-service/src/main/java/org/openmetadata/service/search/elasticsearch/` and
  `openmetadata-service/src/main/java/org/openmetadata/service/search/opensearch/`.

**Builder** — assemble a complex object by named fields instead of a telescoping constructor.
- *Use it when* building a schema POJO/DTO (Lombok `@Builder`) or an entity through the SDK (the
  fluent `*Builder`).
- *Here:* Lombok `@Builder` on data objects (112 sites); the hand-written fluent builders in
  `openmetadata-sdk/src/main/java/org/openmetadata/sdk/fluent/builders/` (32 classes);
  `openmetadata-service/src/main/java/org/openmetadata/service/util/OpenMetadataConnectionBuilder.java`.

**Singleton / Registry** — one shared instance, plus a registry mapping a key (entity name, type) to
its handler, populated at startup and resolved at runtime. This is how the backend dispatches
polymorphically without giant `switch` statements.
- *Use it when* you add an entity type or handler: self-register into the existing registry rather
  than hard-coding a lookup.
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/Entity.java` (`registerEntity` /
  `getEntityRepository`), `openmetadata-service/src/main/java/org/openmetadata/service/TypeRegistry.java`,
  `openmetadata-service/src/main/java/org/openmetadata/service/resources/CollectionRegistry.java`.

### Structural

**Adapter** — wrap an external/vendor API in the repo's own interface so the rest of the code stays
vendor-agnostic.
- *Use it when* integrating a second implementation of an external dependency: implement the internal
  interface, never leak the vendor type upward.
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/search/SearchClient.java`
  (internal API) with `openmetadata-service/src/main/java/org/openmetadata/service/search/elasticsearch/ElasticSearchClient.java`
  and `openmetadata-service/src/main/java/org/openmetadata/service/search/opensearch/OpenSearchClient.java`
  adapting the relocated ES/OS SDKs.

**Facade** — one entry point over a large subsystem.
- *Use it when* you need persistence: go through the DAO facade, not ad-hoc JDBI handles.
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/CollectionDAO.java`
  aggregates 129 sub-DAOs behind one interface.

**Proxy (caching)** — a stand-in that transparently adds caching in front of the real object.
- *Use it when* reading entities/subjects on hot paths: read through the existing **bounded** caches,
  don't hit the DB directly (see `CLAUDE.md`: all caches must be bounded).
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/EntityRepository.java`
  (the `CACHE_WITH_NAME`/`CACHE_WITH_ID` Guava `LoadingCache`),
  `openmetadata-service/src/main/java/org/openmetadata/service/security/policyevaluator/SubjectCache.java`.

**Composite** — model part-whole trees so a leaf and a container are handled uniformly.
- *Use it when* working with hierarchies (teams, glossary terms/domains, FQN containment): reuse the
  existing recursive helpers rather than re-walking the tree by hand.
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/security/policyevaluator/SubjectContext.java`
  (team tree for RBAC), `openmetadata-service/src/main/java/org/openmetadata/service/util/FullyQualifiedName.java`
  (service→database→schema→table).

**Decorator** — wrap an object to add behavior while keeping the same interface. *Narrow here — one
genuine case.*
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/socket/HeaderRequestWrapper.java`
  (a servlet-request wrapper). Note: the `formatter/decorators/` package is *named* "decorator" but is
  structurally **Strategy** (one impl per channel, nothing wraps another) — do not treat it as a
  Decorator.

### Behavioral

**Template Method** — a base class fixes the algorithm skeleton and delegates the variable steps to
abstract hooks the subclass fills. **The backbone of the backend.**
- *Use it when* adding an entity repository or app: extend the base and implement the hooks
  (`setFields`, `prepare`, `storeEntity`, …); never reimplement the CRUD lifecycle.
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/EntityRepository.java`
  (~60 repositories), `openmetadata-service/src/main/java/org/openmetadata/service/apps/AbstractNativeApplication.java`.

**Strategy** — interchangeable algorithms behind a common interface, selected at runtime.
- *Use it when* there is a family of "same operation, different implementation" (auth, secrets
  backend, per-type conversion): add an impl and register it.
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/security/Authorizer.java`,
  `openmetadata-service/src/main/java/org/openmetadata/service/secrets/SecretsManager.java`,
  `openmetadata-service/src/main/java/org/openmetadata/service/secrets/converter/ClassConverter.java`.

**Observer / Publish-Subscribe** — emit events; decoupled subscribers react.
- *Use it when* something should happen on entity change or per request: add a handler/subscription,
  don't wire the caller directly to the reaction.
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/events/EventHandler.java`,
  the change-event publisher family (`openmetadata-service/src/main/java/org/openmetadata/service/apps/bundles/changeEvent/AlertPublisher.java`),
  `openmetadata-service/src/main/java/org/openmetadata/service/socket/WebSocketManager.java`.

**Chain of Responsibility** — an ordered series of handlers, each doing its part and passing control on.
- *Use it when* adding a request filter or a migration phase: insert into the existing ordered chain.
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/security/DelegatingContainerRequestFilter.java`
  (JAX-RS filter chain), `openmetadata-service/src/main/java/org/openmetadata/service/migration/api/MigrationWorkflow.java`
  (Flyway → native → extension).

**Command** — encapsulate an action as an object that can be scheduled/queued/run later.
- *Use it when* adding a background job or a migration step: implement the job/step interface.
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/apps/NativeApplication.java`
  (Quartz jobs), `openmetadata-service/src/main/java/org/openmetadata/service/migration/api/MigrationProcess.java`.

**Visitor (parse-tree)** — separate an operation from the object structure it traverses; here, ANTLR
parse trees.
- *Use it when* parsing/transforming FQNs, entity links, or JDBC URIs: use the ANTLR listeners, don't
  hand-roll string splitting.
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/util/FullyQualifiedName.java`
  (`SplitListener` over the tree); grammars in `openmetadata-spec/src/main/antlr4/`.

**Iterator (cursor)** — traverse a large/remote collection page-by-page without exposing storage.
- *Use it when* processing large entity sets (reindex, insights) or paginating a list API: use
  cursor-based sources / `ResultList`, never load everything into memory.
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/workflows/interfaces/Source.java`
  and `EntityRepository` keyset pagination.

**State** — allowed transitions depend on an explicit status; illegal transitions are rejected.
*Narrow here.*
- *Here:* `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TestCaseResolutionStatusRepository.java`
  (incident lifecycle). Broader workflow state is delegated to the Flowable BPMN engine, not
  hand-rolled — don't build a new state machine when a governance workflow fits.

---

## Python ingestion framework (`ingestion/src/metadata`)

**Factory Method — the `create()` contract.** Every Step/Source is built through a `create()`
classmethod that validates the service connection and raises `InvalidSourceException` on mismatch;
never construct a connector directly. Mandatory for all 135+ connector steps.
- *Here:* `ingestion/src/metadata/ingestion/api/step.py` (`Step.create`),
  `ingestion/src/metadata/ingestion/source/database/postgres/metadata.py`.

**Abstract Factory / Registry — the ServiceSpec system.** A per-connector `service_spec.py` manifest
declares the classpaths of its source/profiler/sampler; the framework imports them dynamically, so the
workflow is decoupled from every connector.
- *Use it when* adding a connector: ship a `service_spec.py`, don't wire the class into the framework.
- *Here:* `ingestion/src/metadata/utils/service_spec/service_spec.py` (`BaseSpec`,
  `import_source_class`); 98 `service_spec.py` manifests.

**Factory + decorator Registry.** Decorator-based registries map a key (enum value, SQL dialect, class
name) to a handler resolved at runtime.
- *Use it when* adding a parser/metric/adaptor variant: register it via the shared primitive rather
  than editing a dispatch `if/elif`.
- *Here:* `ingestion/src/metadata/utils/dispatch.py` (`enum_register` / `class_register`),
  `ingestion/src/metadata/profiler/factory.py`.

**Adapter — entity adapters.** Adapt heterogeneous entity shapes (Table/Container/Topic) to one
uniform interface, replacing scattered `isinstance` checks.
- *Use it when* adding classification/sampling support for a new entity type: add an
  `@register_adapter` adapter.
- *Here:* `ingestion/src/metadata/sampler/entity_adapters.py`.

**Template Method.** The base runs the fixed lifecycle (`run` / `execute`) and calls abstract hooks
(`_run`/`_iter`, `execute_internal`, the topology `yield_*`/`get_*` methods).
- *Use it when* adding a step or workflow: fill the hooks, don't reimplement the lifecycle.
- *Here:* `ingestion/src/metadata/ingestion/api/step.py`,
  `ingestion/src/metadata/ingestion/source/database/database_service.py`,
  `ingestion/src/metadata/workflow/base.py`.

**Strategy via `singledispatch`.** Dispatch on the runtime type of a record instead of an `isinstance`
ladder (9 files use `singledispatchmethod`, 22 use `singledispatch`).
- *Here:* `ingestion/src/metadata/ingestion/api/topology_runner.py`.

**Iterator — generators.** A Source is a generator; records stream lazily and the workflow pulls them
with `for record in source.run()`. Produce records with `yield`, don't build a list.
- *Here:* `ingestion/src/metadata/ingestion/api/step.py` (`IterStep`),
  `ingestion/src/metadata/ingestion/api/topology_runner.py`.

**Chain / Pipeline — Source→Processor→Stage→Sink.** Each record flows through an ordered tuple of
steps that transform/forward/drop it; a workflow composes its own chain in `set_steps()`.
- *Here:* `ingestion/src/metadata/workflow/ingestion.py`,
  `ingestion/src/metadata/ingestion/api/steps.py`.

**Observer — Status handler.** Log warnings emitted anywhere during a step's `run()` are observed by a
handler and recorded into that step's `Status`, decoupling emitters from the aggregator.
- *Here:* `ingestion/src/metadata/ingestion/api/status.py`,
  `ingestion/src/metadata/ingestion/api/step.py`.

---

## TypeScript UI (`openmetadata-ui/src/main/resources/ui/src`)

**Singleton + Factory-Method — the `*ClassBase` seam.** A single instance is exported as the app-wide
singleton, and the class is also exported so the enterprise build can subclass and override its
factory methods (which return components, field configs, and widgets). This is the deliberate UI
plugin/override point — 40 such modules.
- *Use it when* adding a UI extension point the enterprise build may override: follow the `*ClassBase`
  shape.
- *Here:* `openmetadata-ui/src/main/resources/ui/src/utils/EntityRightPanelClassBase.ts` (and siblings
  like `TableClassBase`, `SearchClassBase`).

**Factory function.** Build the right component subtree from a discriminant enum.
- *Here:* `openmetadata-ui/src/main/resources/ui/src/components/Auth/AuthProviders/AuthProvider.tsx`
  (switch on auth provider).

> React **Context/Provider** (`openmetadata-ui/src/main/resources/ui/src/context`) is the idiomatic
> composition/state-sharing seam (24 contexts). It resembles GoF Mediator only loosely — treat it as
> the React idiom, not as a GoF pattern to reach for by name.

---

## Cautions

- **Naming ≠ structure.** `formatter/decorators/` is Strategy, not Decorator. Verify a candidate's
  structure, not its class name, before matching it to a pattern.
- **Don't force GoF onto React.** Hooks, context, and composition cover most of what Strategy/Observer
  would in an OO codebase; a `*ClassBase` singleton or a factory function is usually the only GoF shape
  worth naming on the UI.
- **A pattern is a means, not a goal.** If a plain function or a `switch` is clearer and there is only
  one implementation, use it — and revisit the pattern when a second implementation actually arrives.
