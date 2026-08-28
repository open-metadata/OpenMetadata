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
- **One return per method, at the end.** No scattered early returns; initialize a `result`, structure
  as `if/else`, or extract a helper. (Returns inside lambdas, `switch` expressions, and anonymous
  classes don't count against the outer method.)
  ```java
  // GOOD: single trailing return; guards become helpers + a result variable
  Map<UUID, X> compute(List<EntityInterface> entities) {
    Map<UUID, X> result = null;
    if (entities != null && !entities.isEmpty() && supportsX(entities.get(0))) {
      Map<UUID, X> prefetched = doWork(entities);
      if (!prefetched.isEmpty()) {
        result = prefetched;
      }
    }
    return result;
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

## Common bug patterns

- `equals()` without `hashCode()`; `equals()` on arrays (use `Arrays.equals()`); ignoring
  `String.replace()`/`File.delete()` returns; `collection.size() == 0` (use `isEmpty()`); string `+`
  in loops (use `StringBuilder`); `synchronized` on non-final fields; `toLowerCase()` without
  `Locale.ROOT`; double map lookups (use `computeIfAbsent()`/`getOrDefault()`).

## Structure

- No commented-out code (version control keeps history). No `TODO` without a ticket. One statement per
  line — no `if (x) return y;`.

## Testing (backend)

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
