---
description: Java backend conventions — spotless, no wildcard imports, Kafka-grade method/class rules, integration tests
paths: "**/*.java"
---

# Java conventions

Applies to all `**/*.java`. Compliant reference code:
`openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/GlossaryRepository.java` (a thin
repository) and `common/src/main/java/org/openmetadata/common/utils/CommonUtil.java` (`nullOrEmpty`).

## Formatting & imports

- **Always run `mvn spotless:apply` before finishing any task that touched `.java`.** CI runs
  `mvn spotless:check` and fails the PR otherwise (bot: "Please run `mvn spotless:apply` in the root
  of your repository and commit the changes to this PR"). Scope with `-pl <module>` for speed. When
  asked to "fix checkstyle"/"apply spotless", **invoke the `java-checkstyle` skill** rather than
  hand-editing formatting.
- **No wildcard imports** — `import java.util.List;`, never `import java.util.*;`. (Spotless'
  `googleJavaFormat` does not collapse or forbid these, so it is on you.)
- **No fully-qualified names in code** — import the class instead of `org.openmetadata.schema.type.Status`.

## Method size & complexity (Kafka-grade)

- **Methods ≤ ~15 lines** (excluding blanks/braces) and do **one nameable thing** — if you describe
  it with "and"/"then", split it.
- **Prefer one successful return, placed at the end.** Do not scatter multiple success and fallback
  returns through a long method. Extract validation and named helpers until the main flow reads
  linearly. Throwing a specific validation exception at the boundary is preferable to manufacturing
  an `error` result or deeply nesting the valid path. Do not introduce a mutable `result` variable
  solely to satisfy a return-count rule when a direct expression is clearer. (Returns inside lambdas,
  `switch` expressions, and anonymous classes don't count against the outer method.)
  ```java
  // BAD: mixed validation, fallback, and success returns
  QueryResult execute(String query) {
    if (query == null) return QueryResult.error("query is required");
    if (query.isBlank()) return QueryResult.error("query is required");
    if (!isSupported(query)) return QueryResult.error("unsupported query");
    return run(query);
  }

  // GOOD: validation is explicit and the successful path is linear
  QueryResult execute(String query) {
    String validatedQuery = requireSupportedQuery(query);
    return run(validatedQuery);
  }
  ```
- **Max 3 levels of nesting** — extract a named eligibility helper, don't sprinkle early returns.
- **Max cyclomatic complexity 10** — extract complex booleans into named methods.
- **Max 5 parameters** — use a parameter object or builder beyond that.

## Naming & readability

- Names read like prose — if you need a comment, the name isn't good enough.
- Methods: verb phrases (`calculateScore()`, `isValid()`). Booleans: question-form (`isActive`,
  `hasPermission`; never `flag`/`status`/`check`). Variables: descriptive, no abbreviations
  (`entityReference` not `er`). Constants: `UPPER_SNAKE_CASE`. No single-letter names except short
  lambdas / loop indices.

## Immutability & defensive design

- `final` on locals/params that don't change (most of them) and on constructor-set fields.
- Return `Collections.unmodifiableList()` / `List.copyOf()` from public methods; never expose internal
  mutable collections. Utility classes are `final` with a private constructor. Prefer `record` for
  immutable data carriers.

## Typed models & protocol boundaries

- **Never `Map<String, Object>` as a domain model or return type.** Use a record, a generated schema
  class, or a focused class with named fields. Maps are for genuinely dynamic keys only — SPARQL
  bindings, JSON-LD contexts, JDBC bind values, framework protocol boundaries.
- Convert dynamic input exactly once, at the boundary: an MCP `Map<String, Object>` becomes a
  validated parameter object before business logic runs; untyped JSON becomes a typed Jackson record
  before rows are processed.
- Public REST request/response shapes belong in `openmetadata-spec` JSON Schema so Java, TypeScript,
  and Python clients share one contract. Local records are for internal/transport payloads only.
- Never return an `error` map from a typed method — throw the specific validation, authorization,
  not-found, or availability exception and let the transport exception mapper build the wire error.
- Group values that travel together into a record or parameter object rather than passing more than
  five parameters or parallel lists.

## Layer boundaries

- **JAX-RS resources are transport adapters only:** authorize, translate HTTP inputs, invoke one
  application service, build transport metadata (status, content type, headers).
- **Application services own orchestration and business validation;** repositories own persistence
  and triplestore/database access; serializers and mappers own representation conversion. Don't put
  workflows in a resource or turn a repository into a catch-all service.
- Constructor-inject repositories, stores, clocks, and external clients. Don't look up static
  singletons inside business methods; a thin composition boundary may supply the production singleton.
- Keep query builders, parsers, normalizers, and validators pure where possible — package-private
  pure methods are better test seams than static mocking.
- Share one service implementation across REST, MCP, jobs, and other transports. Don't copy parsing,
  validation, inference, or serialization into each adapter.

## Error handling

- No empty catch blocks (log at minimum). No `catch (Exception e)` — catch the specific type. No
  `e.printStackTrace()` — use the logger. Error messages carry context
  (`"Table '%s' not found in database '%s'"`). No `throw`/`return` inside `finally`. No exceptions for
  expected control flow.

## No magic strings

- Never raw string literals in `.equals()`/`.contains()`/`switch` — use a constant or existing enum
  (prefer enums from `openmetadata-spec/` schemas for closed sets). If a string appears in more than
  one place it must be a named constant, defined once.
  ```java
  private static final Set<String> MULTI_TENANT_IDS = Set.of("common", "organizations", "consumers");
  private boolean isSingleTenant(String tenantId) { return !MULTI_TENANT_IDS.contains(tenantId); }
  ```

## No convoluted if/else chains

- More than 3 `else if` means the structure is wrong: `instanceof` → `switch` pattern matching (Java
  21); enum → `switch` expression; `.equals("string")` → `Map` dispatch or enum lookup;
  `.contains("string")` → `Map`/predicate list. Extract repeated compound conditions into a named
  method or `Set.contains()`.

## No code duplication

- Extract shared logic; near-identical OpenSearch/ElasticSearch methods share a common implementation
  with only engine-specific parts varying; extract copy-pasted blocks into a parameterized method.

## Class size

- Classes under 500 lines (over 1000 is a design problem). Extract clusters of methods on the same
  fields into a focused class. Resource classes are thin orchestrators; repositories do data access,
  not business logic.

## Modern Java (21)

- try-with-resources for `AutoCloseable`; diamond `<>`; pattern matching (`if (obj instanceof String s)`);
  `switch` expressions over enum/type `if/else` chains; `List.of()`/`Map.of()`/`Set.of()`; `Optional`
  used correctly (never a field, param, or `null`); text blocks `"""` for multi-line.
- **`SequencedCollection` accessors** — `list.getFirst()`/`getLast()`/`removeFirst()`/`removeLast()`
  over index arithmetic.
- **Emptiness: use `nullOrEmpty(...)`** from `org.openmetadata.common.utils.CommonUtil` (handles
  `null`), not `coll != null && !coll.isEmpty()`. Same for `String`.
  ```java
  // GOOD
  if (!nullOrEmpty(entities)) { process(entities.getFirst()); }
  ```
- `nullOrEmpty(String)` does **not** treat whitespace as empty. For required text, centralize
  `nullOrEmpty(value) || value.isBlank()` in a named boundary validator rather than repeating it.
- Use the `nullOrEmpty(JsonNode)` overload for null, missing, JSON-null, and empty container nodes.
  Add an explicit shape predicate (`isObject`, `isArray`, `isNumber`) when the consumer requires one.
- Required classpath schemas, ontologies, and configuration resources must **fail fast** with the
  resource path and original cause — never silently substitute an empty model or partial config.
  Optional resources must be documented as optional.

## Common bug patterns

- `equals()` without `hashCode()`; `equals()` on arrays (use `Arrays.equals()`); ignoring
  `String.replace()`/`File.delete()` returns; `collection.size() == 0` (use `isEmpty()`); string `+`
  in loops (use `StringBuilder`); `synchronized` on non-final fields; `toLowerCase()` without
  `Locale.ROOT`; double map lookups (use `computeIfAbsent()`/`getOrDefault()`).

## Structure

- No commented-out code (version control keeps history). No `TODO` without a ticket. One statement per
  line — no `if (x) return y;`.

## Testing (backend)

- Unit-test pure validation, parsing, normalization, query-building, and serialization directly.
  Mock only the repository or external-system boundary, injected through the constructor.
- Assert typed fields and observable state — not map keys, static singleton wiring, or internal call
  choreography.
- Production-ready code, not tutorial code. **Never `Thread.sleep()` in tests** — use condition-based
  waiting / `Awaitility`. Bug fixes include a test that fails without the fix. **90% line coverage on
  changed classes** — see the `test-enforcement` skill.
- **All backend API integration tests go in
  `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/`.** Name them `*IT.java`;
  extend `BaseEntityIT<T, K>` for entity CRUD; run concurrently (`@Execution(ExecutionMode.CONCURRENT)`);
  use `TestNamespace` for isolation and `SdkClients` for API calls
  (`SdkClients.adminClient().tables().create(...)`).

## Commands

```bash
mvn clean package -DskipTests                          # build without tests
mvn clean package -DonlyBackend -pl '!openmetadata-ui' # backend only
mvn test                                               # unit tests
mvn verify                                             # integration tests
mvn spotless:apply                                     # format
mvn test -pl openmetadata-integration-tests -Dtest=TaskResourceIT   # one IT
mvn test -pl openmetadata-integration-tests            # all ITs
```
