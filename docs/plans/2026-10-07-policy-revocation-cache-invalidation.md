# Policy revocation: post-commit invalidation and MCP request cleanup

- **Status:** Implemented 2026-10-08; see section 10 for deviations and verification
- **Date:** 2026-10-07
- **Last verified:** 2026-10-08
- **Issue:** [OpenMetadata #34826](https://github.com/open-metadata/OpenMetadata/issues/34826)
- **Investigated checkout:** `873fd913e7dc925fd2dc8d93d1f0c441e9b6559a` (current `origin/main` on 2026-10-08)
- **Original investigation and request-cache experiment:** `c303634049` (2026-10-07)
- **Related:** [#34270](https://github.com/open-metadata/OpenMetadata/pull/34270), [#34253](https://github.com/open-metadata/OpenMetadata/pull/34253)

## 1. Problem and required behavior

An administrator removes an authorization rule from a policy. The policy update response and
persisted database row reflect the removal, but a previously authorized user can continue using
the removed grant. The reported reproduction warms authorization through `/mcp` and makes the
first request after the edit through `/mcp` as well. Once a stale per-user policy entry is
reloaded, REST authorization and the permission API can also answer from it.

The required local behavior is: **after a successful policy update response, a new authorization
decision on that server must use the committed policy and reject an operation whose only grant
was removed.** This must hold with both `cacheProvider=none` and `cacheProvider=redis`, regardless
of whether the next request uses MCP, REST, or the permission API.

Calls already authorized before the update are outside this immediate-revocation contract. The
fix does not cancel queries already executing. Cross-node Redis invalidation remains asynchronous;
the plan must not claim that an update response synchronously revokes access on every replica.

## 2. Evidence and confidence

### Revalidation against current main

The worktree HEAD and GitHub's `main` head both resolve to `873fd913e7dc925fd2dc8d93d1f0c441e9b6559a`.
Between the original investigation and this revision, `PolicyRepository`, `CacheBundle`,
`SubjectCache`, and `McpServer` have no changes. `RequestEntityCache` changed only its generic
bounds from `EntityInterface` to `EntityInterface<?>`; its behavior is unchanged. The previously
identified defects therefore remain applicable to this baseline.

The only changes for this task are this plan and its documentation-index entry. There is no
implementation to review in this worktree. PR #34790 concerns MCP knowledge-graph access for
#34270 and must not be treated as the policy-revocation implementation.

### Evidence reported in the issue

The issue reports the following from a local integration-test server using PostgreSQL, search,
Fuseki, and cache provider `none`:

- The database and policy API both show the updated policy: version `0.2`, four rules, and no
  `ExecuteSparqlQuery` grant.
- A user warmed through MCP remains authorized when the first request after the edit is MCP.
  Continuous polling remained allowed for approximately 167–173 seconds; the upper bound was
  not established.
- A REST-first request denies immediately and MCP subsequently denies as well.
- Per-user cache statistics indicate reloads immediately after invalidation and after the
  two-minute expiration, both returning the old rules.
- Explicit `SubjectCache.invalidateAll()`, followed by a policy read, yields the new policy and
  subsequent MCP denial.

These are the issue author's endpoint observations. This investigation did not independently
repeat the full HTTP reproduction or measure the 170-second interval.

### Findings verified in this checkout

| Finding | Code evidence | Confidence |
|---|---|---|
| Authorization invalidation happens before the new rules are stored | `PolicyRepository.PolicyUpdater.entitySpecificUpdate()` calls `SubjectCache.invalidateAll()` in the rules comparison callback | Confirmed by source inspection |
| Provider `none` skips authorization invalidator registration | `CacheBundle.run()` returns before registering `SubjectCache.invalidator()` | Confirmed by source inspection |
| Policy reloads can read from a thread-local entity cache | `SubjectCache.loadPolicyContext()` calls `Entity.getEntity(..., "rules", ...)`; `EntityRepository.get()` checks `RequestEntityCache` first | Confirmed by source inspection |
| MCP tool execution lacks the shared request cleanup | `McpServer.getTool()` clears impersonation state, but does not call `PerRequestContextCleaner` | Confirmed by source inspection |
| MCP tool and prompt callbacks execute on bounded-elastic workers | MCP SDK 1.1.1 converts sync callbacks with `subscribeOn(Schedulers.boundedElastic())`; OpenMetadata retains the default `immediateExecution=false` | Confirmed from the installed SDK source and server builder |
| Thread-local stale entities can survive admin-thread invalidation and feed an expired derived cache | A focused experiment using the current `RequestEntityCache` source reproduced this sequence | Confirmed at cache-layer level; full endpoint attribution remains to be tested |
| An in-flight Guava load can publish its old value after invalidation | `LocalCache.storeLoadedValue()` stores a completed load even when invalidation has removed its entry; a latch-controlled probe against resolved Guava 33.4.8-jre reproduced it | Confirmed from dependency source and a cache-layer experiment |

### Focused experiment

The 2026-10-07 experiment compiled that baseline's `RequestEntityCache.java` into a temporary directory and used
the checkout's existing compiled classes and resolved dependencies. It used a single reused
worker thread and a bounded Guava derived cache with the same two-minute expiration pattern.
This derived cache was an experimental stand-in, not the actual `USER_POLICIES_CACHE` loader.

1. On the worker, cache a policy with a revocable grant and one remaining rule.
2. Warm the derived cache from that worker's request cache.
3. On the admin thread, invalidate `SubjectCache`, the shared entity caches, the policy's local
   request-cache aliases, and the experimental derived cache.
4. Reload on the worker: its request cache still supplies both old rules.
5. Advance a fake ticker by three minutes and reload: both old rules are supplied again.
6. Clear `RequestEntityCache` on the worker: the stale policy entry disappears.

Observed output:

```text
After admin invalidation, worker reload still has old grant: true
After simulated 3-minute expiry, reload still has old grant: true
Cleanup on the worker removes leaked entity: true
```

The experiment establishes that the proposed stale-reload mechanism exists. It does not prove
which thread served each request in the issue's run, or that thread reuse explains every reported
ordering. Permanent tests must establish the behavior through real authorization decisions.

### In-flight publication experiment added on 2026-10-08

A second probe used the resolved Guava 33.4.8-jre implementation directly. It paused a load after
capturing `old-grant`, changed the backing value to `new-policy`, called `invalidateAll()`, and
then released the loader. All waits were bounded and coordinated with latches. An unrelated warm
entry ensured the cache was nonempty when cleared.

```text
Loaded before invalidation: old-grant; cached after invalidation: old-grant
```

Guava treats that completed load as a cache publication with a new write timestamp, so its TTL
starts at publication. Invalidation is not a cancellation or generation barrier. This establishes
the need for generation protection in the fix, while permanent tests must still exercise actual
`SubjectCache` authorization and committed policy updates.

## 3. Relevant code and execution paths

All paths below are relative to the repository root. Line numbers are investigation anchors and
may change during implementation.

| File | Relevant responsibility |
|---|---|
| `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/PolicyRepository.java` | Rules comparison and premature authorization invalidation, around line 259 |
| `openmetadata-service/src/main/java/org/openmetadata/service/cache/CacheBundle.java` | Provider initialization, invalidator registration, and local/remote invalidation fan-out |
| `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/EntityRepository.java` | Request-cache lookup, transaction scopes, entity eviction, and post-commit invalidation |
| `openmetadata-service/src/main/java/org/openmetadata/service/security/policyevaluator/SubjectCache.java` | Per-user compiled policies, user contexts, and policy loading |
| `openmetadata-service/src/main/java/org/openmetadata/service/util/RequestEntityCache.java` | Bounded thread-local hydrated entity cache; no expiration |
| `openmetadata-service/src/main/java/org/openmetadata/service/util/PerRequestContextCleaner.java` | Shared cleanup for request-local caches and context |
| `openmetadata-service/src/main/java/org/openmetadata/service/util/PostCommitActionQueue.java` | Existing deferred actions, including rollback/retry handling |
| `openmetadata-service/src/main/java/org/openmetadata/service/resources/filters/ETagRequestFilter.java` | Clears the request entity cache at REST request entry |
| `openmetadata-service/src/main/java/org/openmetadata/service/security/ImpersonationCleanupFilter.java` | Invokes shared cleanup at REST response completion |
| `openmetadata-mcp/src/main/java/org/openmetadata/mcp/McpServer.java` | MCP tool and prompt execution callbacks |
| `openmetadata-mcp/src/main/java/org/openmetadata/mcp/server/transport/HttpServletStatelessServerTransport.java` | Servlet transport that dispatches MCP requests through the SDK |

### Current mutation path

```text
Policy update
  -> transaction begins
  -> compare rules
  -> SubjectCache.invalidateAll()             [too early]
  -> store updated policy and commit
  -> invalidateCachesAfterStore()
       -> evict shared entity caches and writer's request-cache aliases
       -> CacheBundle.invalidateEntity()
            -> SubjectCache invalidator       [missing with provider=none]
  -> return successful update response
```

The common repository update path already provides post-commit invalidation. A separate policy
commit callback should not be added unless a real mutation path demonstrably bypasses it.

### Current stale reload path

```text
Reused MCP execution thread
  -> SubjectCache policy entry misses or expires
  -> loadPoliciesForUser()
  -> loadPolicyContext()
  -> EntityRepository.get(policyId, rules)
  -> RequestEntityCache hit from an earlier MCP call
  -> compile old rule into shared USER_POLICIES_CACHE
  -> MCP, REST, and permission API can now consume that stale shared entry
```

Invalidating a `ThreadLocal` cache on the admin thread does not invalidate the MCP worker's cache.
The request cache's size bound limits memory, but does not limit the age of an entry.

MCP SDK 1.1.1 dispatches sync tool and prompt callbacks on Reactor bounded-elastic workers in
OpenMetadata's current configuration. The servlet thread blocks for the result; it does not
execute those callbacks. Clearing a servlet-thread cache cannot clear the callback worker's cache.

Dependency source anchors, read from the installed `mcp-core-1.1.1-sources.jar`:

- `McpServer.StatelessSyncSpecification`: `immediateExecution` defaults to `false`.
- `McpStatelessSyncServer.addTool()` / `addPrompt()`: pass that setting to the sync-to-async adapter.
- `McpStatelessServerFeatures.AsyncToolSpecification.fromSync()` / `AsyncPromptSpecification.fromSync()`:
  wrap the callback in `Mono.fromCallable(...).subscribeOn(Schedulers.boundedElastic())`.

### Narrowing the issue's open hypotheses

`loadPoliciesForUser()` loads the user through `Entity.getEntityByName()`; it does not directly
reuse `USER_CONTEXT_CACHE`. `TeamHierarchyResolver` does not cache full policies or team nodes;
its invalidation resets the memoized Organization reference. Neither should be assumed to hold
the old rule without additional evidence.

The request entity cache is a stronger candidate for the old rule body. In-flight loading is a
second confirmed cache-level failure mode: a completed Guava load can publish an old value after
invalidation as a fresh entry. Both must be addressed; neither experiment alone establishes the
complete causal history of the issue author's HTTP run.

## 4. Options and recommendation

| Approach | Benefits | Limitations | Risk |
|---|---|---|---|
| A. Register authorization invalidation for every provider and use the existing post-commit path | Small change; fixes premature invalidation and the disabled-provider gap | A leaked MCP request cache can still reload stale policies | Low implementation risk; incomplete alone |
| B. Approach A plus callback cleanup and authorization cache generation protection | Fixes request-local cache leakage and prevents pre-invalidation loads from becoming current authorization entries | Requires worker-thread cleanup, generation-safe getters, and authentication/audit coverage | Recommended; moderate integration risk |
| C. Force fresh database reads on authorization cache reload | Avoids older entity-cache entries during reload | Adds database load; leaves MCP request-local context leakage unresolved; needs review of Redis bypass semantics | Broader change; reserve for a demonstrated remaining defect |

**Recommendation: Approach B**, including generation protection in `SubjectCache` and deterministic
concurrency tests to verify it. Keep the two-minute policy TTL, configured cache
size bounds, existing Redis invalidation channel, and repository transaction machinery.

## 5. Implementation tasks

### Task 1 — Add the endpoint regression before production changes

**Create:**

- `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/RdfPolicyRevocationIT.java`

**Reference existing fixtures and clients:**

- `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/AgentSparqlResourceIT.java`
- `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/mcp/McpTestBase.java`
- `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/McpPermissionIT.java`

Implement a real HTTP regression with a non-admin user having no directly assigned roles, so the
grant reaches the user through Organization's Data Consumer role. Warm `sparql_query` through
MCP, remove `DataConsumerPolicy-ExecuteSparqlQuery-Rule` as admin, and assert the next MCP call
is denied. Then assert the REST agent endpoint and both relevant permission views report denial.

Use `@Isolated` because the test mutates a seeded global policy. Save and restore the rule in
`finally`, including when an assertion fails. Use namespaced users and fixtures. Assert the stored
policy has lost the grant independently of authorization results.

Do not perform a permission lookup for the affected user between the update and the intended
first MCP call: that could warm the shared policy cache with fresh data and mask the defect. Use
separate scenarios/users to preserve each first-request ordering.

MCP denial must be asserted through the tool result's error contract, not solely its HTTP status:
the transport can return a successful JSON-RPC envelope containing an authorization error. REST
must return HTTP 403. Permission checks must reject an allow-equivalent result for
`ExecuteSparqlQuery`.

**Verify:** run the focused RDF test with provider `none` using the commands in section 7. Record
which assertion fails on the unmodified production code. HTTP thread allocation can make the
reported sequence intermittent; deterministic worker-reuse coverage in Task 4 is required even
if a particular HTTP run passes.

### Task 2 — Register local authorization invalidation independently of Redis

**Modify:**

- `openmetadata-service/src/main/java/org/openmetadata/service/cache/CacheBundle.java`

Register `SubjectCache.invalidator()` before the `cacheConfig == null` / provider `none` return.
Remove its registration from the Redis-only block, or otherwise ensure registration stays
idempotent. Keep Redis-backed cache construction and pub/sub initialization under their existing
provider checks.

Update comments that imply all invalidation layers are absent when caching is disabled. Clarify
that disabling the optional cache provider does not disable per-JVM authorization caches.
Avoid changing unrelated invalidator registrations as part of this fix.

**Create:**

- `openmetadata-service/src/test/java/org/openmetadata/service/cache/CacheBundleTest.java`

Exercise initialization with null configuration, provider `none`, and the existing Redis setup
where feasible. Assert an observable stale authorization entry is dropped by local policy
invalidation; do not limit the test to inspecting a registry or verifying a mocked method call.
Restore global cache state between tests. Redis endpoint coverage remains in the integration test.

**Verify:** focused `CacheBundleTest` and `SubjectCacheTest`, then the provider `none` endpoint test.

### Task 3 — Remove premature policy invalidation

**Modify:**

- `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/PolicyRepository.java`

Remove the inline `SubjectCache.invalidateAll()` from the rules comparison callback and remove
the unused import. Keep comparison, validation, and change-description behavior unchanged.

Confirm PUT and PATCH reach the existing `invalidateCachesAfterStore()` path. Verify that policy
entity caches are evicted before the registered authorization invalidator runs. Inspect nested
transaction and bulk paths before making claims about them: a method named `postUpdate` alone
does not establish that the outermost transaction has committed.

**Modify the new integration test** to cover PUT and PATCH rule removal and a failed update whose
persisted policy remains unchanged. A rollback must not revoke or grant access through a policy
that never committed. Add a narrowly scoped repository change only if a tested path bypasses
correct post-commit invalidation; avoid redesigning `EntityRepository` for this issue.

**Verify:** focused RDF regression and existing `PolicyResourceIT` / post-commit tests. Confirm
successful revocation by the first authorization decision after the update response.

### Task 4 — Bound MCP context to the execution callback

**Modify:**

- `openmetadata-mcp/src/main/java/org/openmetadata/mcp/McpServer.java`

Call `PerRequestContextCleaner.clear()` at tool callback entry, before JWT/security-context
resolution, and in an outer `finally` encompassing authentication, execution, and usage recording.
Replace the narrower impersonation-only cleanup where the shared cleaner covers it.

Preserve intentional context established for the current call: resolve authentication and active
persona after entry cleanup, set audit attribution before execution, and retain context needed by
usage recording until that recording completes. The outer cleanup must run if authentication,
tool execution, or usage recording throws.

Apply equivalent entry/exit cleanup around prompt callbacks. Run cleanup on the thread actually
executing the callback: MCP SDK 1.1.1 uses a Reactor bounded-elastic worker, not the servlet thread.
In-callback entry/exit cleanup is required; a servlet filter cannot provide it. Do not clear
deferred-write collectors; the shared cleaner deliberately excludes pending work.

**Create:**

- `openmetadata-mcp/src/test/java/org/openmetadata/mcp/McpServerRequestContextTest.java`

Use a reused single-thread executor to exercise successive callbacks. Populate the real request
entity cache during the first call, change the backing entity between calls, and assert the next
call sees the new state. Cover successful calls, execution errors, authentication errors, and
prompt execution. Assert context isolation between users/personas and that audit/usage attribution
for the current call remains correct. Exercise `CreateEntityTool` and `PatchEntityTool` and assert
that both see the configured MCP bot as `ImpersonationContext.getImpersonatedBy()` during
execution, after entry cleanup and before exit cleanup. Assert the resulting persisted audit
attribution where available; those tools read the impersonator mid-call when invoking repository
mutations. Verify stale prior-call attribution is absent at entry and current-call attribution is
cleared afterward. Use real cache behavior and minimal boundary substitutes;
avoid mocking several internal classes just to verify cleanup invocation.

**Verify:** focused MCP context test, existing transport tests, and the MCP-first RDF regression.

### Task 5 — Protect authorization generations against concurrent policy loading

**Create:**

- `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/PolicyRevocationConcurrencyIT.java`

Use a real policy/role/user fixture and latches or barriers to pause a load after it has read the
old policy. Commit a policy change and let post-commit invalidation complete, then release the
old load. Make a new authorization decision and assert it uses the updated policy. Include the
team-inherited path. Bound every latch wait; use no fixed sleeps.

Keep instrumentation at the database/load boundary and restore it in `finally`. Prefer existing
test utilities over a production hook introduced solely for test coordination.

**Modify:**

- `openmetadata-service/src/main/java/org/openmetadata/service/security/policyevaluator/SubjectCache.java`
- `openmetadata-service/src/test/java/org/openmetadata/service/security/policyevaluator/SubjectCacheTest.java`

Add generation protection so a load started against an old generation cannot answer a later
request. Prefer atomically replacing the active policy-cache generation on global authorization
invalidation: an old load may finish into its retired cache, but cannot populate the new active
cache. Build replacement caches with the configured maximum entries and existing TTLs.

Capture the active generation for a read, perform its load, and recheck that generation before
returning an authorization result; retry against the current generation if it changed. Avoid a
guard that merely checks at loader completion: invalidation can still race cache publication.
Do not serialize all authorization requests behind a global load lock or hold one during database
reads. Review cache initialization and the user-context invalidation paths for the same race.

Review every consumer, including hierarchy summaries and visited teams, so stale results cannot
enter through another
getter. Preserve configured maximum entries and TTLs and keep any per-user generation bookkeeping
bounded if targeted invalidation requires it. Tests must include multiple concurrent invalidations
and cache initialization without accidentally making a retired generation active again.

Generation protection is expected implementation work. The Guava behavior has been verified;
the tests establish its effect on actual authorization and the correctness of the chosen guard.

**Verify:** run the deterministic concurrency test repeatedly, then repeat the endpoint scenarios.

### Task 6 — Complete provider coverage and final verification

Run the regression with provider `none` and with Redis. Verify a normal request after restoration
is allowed again. Exercise an existing MCP tool as a control, rather than concluding from
`sparql_query` alone that the fix covers all tools.

Use the current `java-affected-tests` skill: run `make java_affected`, inspect its selected tests,
and run every selected step with `make java_affected_run`. Add runtime authorization consumers
the planner misses, with a reason. Also run the two explicit RDF provider commands in section 7.
The planner output is a minimum, not a replacement for the required revocation matrix.

Run formatting, compilation, targeted unit tests, and focused integration tests. Record failures,
skips, test counts, and actual command output in the implementation PR. A skipped RDF or Redis
test does not count as provider coverage.

## 6. Regression matrix

| Scenario | Required outcome |
|---|---|
| MCP-only warm-up, remove grant, MCP first | First subsequent MCP authorization denies |
| MCP-only warm-up, remove grant, REST first | REST returns 403; subsequent MCP denies |
| MCP + REST warm-up, remove grant, MCP first | Both paths deny |
| MCP-first denial followed by user permission API | API reports no allow-equivalent grant |
| MCP-first denial followed by admin permission view for that user | Same authorization result |
| Remove rule through PUT and through PATCH | Both mutation paths invalidate committed authorization |
| Repeated calls beyond the policy TTL | No old grant reappears; use a fake ticker for deterministic cache-level expiry |
| Restore the grant | Next local authorization observes restoration |
| Reused worker, different users/personas | Prior call's entity/context state cannot affect the next call |
| Authentication/tool/prompt/usage failure | Callback cleanup still executes |
| `CreateEntityTool` and `PatchEntityTool` execution | Both see the MCP bot as impersonator during mutation; audit attribution survives entry cleanup |
| Load crosses commit and invalidation | A later decision cannot consume the pre-commit result |
| Failed policy update | Persisted policy and effective access remain consistent |
| Existing non-SPARQL MCP tool | Correct authorization after its relevant policy edit |
| Provider `none` and Redis | Same immediate local revocation contract |

For endpoint tests, immediate denial is the assertion: do not use polling to turn eventual denial
into a passing result. A longer diagnostic run can follow, but cannot substitute for that assertion.

## 7. Verification commands

Run from the repository root with Java 21, Maven, and Docker available.
Python tooling must run inside the required repository venv. Do not run a second Testcontainers
stack alongside another checkout's tests. All commands below are implementation-time checks;
the new test classes do not exist yet and these suites were not run while revising this plan.

### Select and run affected Java tests

Read `skills/java-affected-tests/SKILL.md` before implementation verification. The current planner
selects impacted unit tests and integration tests by lane and engine, including uncommitted and
untracked changes. Its selected tests are mandatory; explicitly add runtime policy consumers
that static selection misses.

```bash
rtk git fetch origin main
source env/bin/activate
rtk proxy make java_affected
rtk proxy make java_affected_run
```

Use the planner's `--add-it`, `--add-unit`, or `--add-area` options with `--reason` on both the plan
and run when needed; additions are not persisted between invocations. Run the two explicit RDF
provider commands below even if the planner does not select both provider configurations.

The commands build the affected reactor with `-am`; no separate `mvn install` is required. Use
`package` for focused unit runs because the shaded search clients are produced during packaging.
Use `verify` for integration runs. Drop the obsolete `-DonlyBackend` flag and include
`-Dspring-boot.repackage.skip=true`, matching the planner's command construction.

### Run focused unit tests

These commands support the red/green loop; they supplement rather than replace the affected-test
runner's final selection.

```bash
rtk proxy mvn -B package -pl openmetadata-service -am -Dspring-boot.repackage.skip=true -Dtest=CacheBundleTest,SubjectCacheTest,RequestEntityCacheTest,PostCommitActionQueueTest -Dsurefire.failIfNoSpecifiedTests=false
rtk proxy mvn -B package -pl openmetadata-mcp -am -Dspring-boot.repackage.skip=true -Dtest=McpServerRequestContextTest,HttpServletStatelessServerTransportTest,OAuthHttpStatelessServerTransportProviderTest -Dsurefire.failIfNoSpecifiedTests=false
```

### Run the RDF regression with both providers

```bash
rtk proxy mvn -B verify -pl :openmetadata-integration-tests -am -Dspring-boot.repackage.skip=true -Pmysql-elasticsearch -DintegrationTests.lane=rdf -Dit.test=RdfPolicyRevocationIT,AgentSparqlResourceIT -Dfailsafe.failIfNoSpecifiedTests=false -Dtest=NoUnitTestsInThisRun -Dsurefire.failIfNoSpecifiedTests=false
rtk proxy mvn -B verify -pl :openmetadata-integration-tests -am -Dspring-boot.repackage.skip=true -Ppostgres-os-redis -DintegrationTests.lane=rdf -Dit.test=RdfPolicyRevocationIT,AgentSparqlResourceIT -Dfailsafe.failIfNoSpecifiedTests=false -Dtest=NoUnitTestsInThisRun -Dsurefire.failIfNoSpecifiedTests=false
```

The first command matches CI's MySQL + Elasticsearch RDF lane and uses the default provider
`none`. The second uses the explicit PostgreSQL + OpenSearch + Redis profile with the same RDF
lane. That profile sets `cacheProvider=redis`; do not depend on a property override on a non-Redis
profile for the required Redis run. `integrationTests.lane=rdf` enables Fuseki for both profiles.
Confirm the provider/engine startup logs and that both selected classes actually execute.

`postgres-rdf-tests` still exists in the pinned POM, but these commands intentionally use the
current engine/lane profiles for reproducibility. The `Rdf*IT` name already matches the RDF lane
selector; no workflow edit is needed.

### Run adjacent integration coverage

```bash
rtk proxy mvn -B verify -pl :openmetadata-integration-tests -am -Dspring-boot.repackage.skip=true -Pmysql-elasticsearch -DintegrationTests.lane=parallel -Dit.test=PolicyRevocationConcurrencyIT,PolicyResourceIT,McpPermissionIT -Dfailsafe.failIfNoSpecifiedTests=false -Dtest=NoUnitTestsInThisRun -Dsurefire.failIfNoSpecifiedTests=false
```

If implementation identifies a control scenario that needs RDF, include it in `RdfPolicyRevocationIT`.
Keep the deterministic generic concurrency test runnable without Fuseki. Selecting `parallel`
disables the other Failsafe execution; omitting the lane can execute a selection twice or cause
an empty-match failure. An engine profile is also required: a lane alone can execute zero tests.

### Record local evidence in the implementation PR

The affected-test runner writes `target/java-tests/local-pr-results.md`. Include its generated
block under the PR's backend integration-test section, and record the two hand-run RDF commands
separately with the commit, provider, engine, counts, skips, failures, and report paths.

Once the implementation PR exists, the runner can update its result block:

```bash
rtk proxy make java_affected_run ARGS='--update-pr'
```

Pass any explicit additions and their reason again on this invocation. Do not call a run passed
unless every selected class has a current report, more than zero tests executed, and no failures.
Inspect `openmetadata-integration-tests/target/failsafe-reports/TEST-*.xml`; a green Maven build
with zero tests is not evidence of revocation coverage.

### CI behavior at the pinned baseline

Local verification is required regardless of green PR checks. The newly added skill describes a
merge-queue-first integration-test policy, but the actual workflows at `873fd913e7` still include
`pull_request_target` triggers, `safe to test` label validation, and integration-lane jobs gated
by the backend path filter. The MySQL + Elasticsearch workflow source was also verified against
GitHub at the pinned commit. Therefore this plan does not assert that PR ITs are universally
disabled or that merge queue is necessarily their first CI execution. Recheck the workflow gates
when the implementation PR is opened; do not use possible PR CI as a substitute for local results.

### Format and inspect the final diff

```bash
rtk proxy mvn -pl openmetadata-service,openmetadata-mcp,openmetadata-integration-tests spotless:apply
rtk proxy mvn -pl openmetadata-service,openmetadata-mcp,openmetadata-integration-tests spotless:check
rtk git diff --check
rtk git diff --stat
```

Apply the repository's `java-checkstyle` skill after Java edits. If prerequisites are missing,
follow the `dev-setup` skill rather than treating missing infrastructure as a passing verification.

## 8. Scope, risks, and review gates

- **Scope:** backend cache registration, policy invalidation timing, MCP request cleanup, and
  regression tests. No schema, generated model, frontend, database migration, or workflow change
  is expected.
- **Threading:** callback cleanup must occur on the authorization/execution thread; HTTP request
  thread cleanup cannot clear the SDK's bounded-elastic worker state.
- **Ordering:** entity cache eviction must precede derived policy invalidation. Otherwise the
  first subsequent policy load can read an older entity-cache entry.
- **Transaction ownership:** validate outer transactions, rollback, and retry behavior before
  assuming every callback runs after the final commit.
- **Cache lifetime:** preserve all size bounds and configured limits. Do not add an unbounded
  generation map or make correctness depend on a shorter TTL.
- **Authentication and audit:** cleanup must preserve the current call's validated identity,
  selected persona, impersonation attribution, and usage reporting through completion.
- **Test isolation:** changing Data Consumer affects the entire server. Restore the grant even on
  failure and keep those tests isolated from concurrent suites.
- **Deployment scope:** immediate local denial is required. Redis peer propagation must remain
  functional, but stronger cluster-wide synchronization is a separate design question.
- **Attribution:** there is no evidence from this investigation that #34270 introduced the
  underlying cache defects, and no endpoint control has yet established MCP-wide impact.

## 9. Acceptance checklist

- [ ] A meaningful regression demonstrates the original behavior on unmodified code, with a
  deterministic worker-reuse test covering thread allocation variability.
- [ ] Authorization invalidation is registered for provider `none`, null cache configuration,
  and Redis without duplicate registration.
- [ ] Policy comparison no longer invalidates authorization before persistence.
- [ ] Successful PUT and PATCH edits revoke the grant before a later local authorization decision.
- [ ] MCP tool and prompt callbacks start clean and clean up on all exit paths.
- [ ] Existing identity, persona, audit, and usage behavior is preserved.
- [ ] `CreateEntityTool` and `PatchEntityTool` see the MCP bot impersonator during execution.
- [ ] Generation protection prevents old loads from publishing into the active authorization cache,
  and deterministic concurrent-load coverage passes.
- [ ] MCP, REST, and permission views agree after revocation and restoration.
- [ ] Tests execute and pass with provider `none` and Redis; no required test is silently skipped.
- [ ] Relevant adjacent tests, compilation, formatting, and diff checks pass.
- [ ] `make java_affected` selections and both explicit RDF provider runs are recorded in the PR.
- [ ] The PR reports exact validation evidence and the local-versus-cross-node freshness contract.

## 10. Implementation notes (2026-10-08)

- **Generation protection** lives in `RevocableLoadingCache`: global invalidation swaps in a new
  cache and a reader that overlapped the swap retries; targeted invalidation bumps an epoch before
  removing the key and an overlapping reader drops what it loaded and retries (bounded, then loads
  uncached). `SubjectCache` uses it for both the policy and user-context caches.
- **Deviation from Task 1:** MCP `sparql_query` is admin-only (`RdfMcpTool.execute` calls
  `authorizeAdmin`), so it is not governed by the Data Consumer `ExecuteSparqlQuery` grant at this
  baseline and cannot serve as the MCP-first probe. `RdfPolicyRevocationIT` warms the user through
  MCP `search_metadata` and asserts REST and permission-API denial; MCP-first revocation is covered
  by `PolicyRevocationConcurrencyIT` using `get_entity_details` and a removable deny rule.
- `RdfPolicyRevocationIT` was not run against unmodified production code, and REST-first denial
  already worked before this change; the red/green evidence is in `RevocableLoadingCacheTest`,
  `SubjectCacheTest` and `McpServerRequestContextTest`, which fail with the fix disabled.
- `PolicyRevocationConcurrencyIT` races real reader threads against an HTTP edit; it does not pause
  a load at the database boundary (the IT module has no mocking dependency). The deterministic
  pause-and-release test is `SubjectCacheTest.testPolicyLoadCrossingInvalidationDoesNotServeTheRemovedRule`.
- Policy delete does not reach `CacheBundle.invalidateEntity`; unchanged by this work.
- `make java_affected` was not run; the explicit commands in section 7 were.
