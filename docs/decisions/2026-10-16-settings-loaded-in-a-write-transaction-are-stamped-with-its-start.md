# Settings loaded inside a repository write transaction are stamped with the invalidation count at its start

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `TransactionSettingsSnapshotTest`, `SettingsCacheTransactionIT`, `SettingsCacheInvalidationTest`
- **Related:** #34676; PR #35530 merge-queue ejection (`DataProductResourceIT.test_deleteOneDomainForMultiDomainDataProduct_preservesDataProductUntilLastDomain`)

## Context
`SettingsCache` stamps each loaded value with the invalidation count its load started from, and a
read reloads a value stamped before the latest invalidation (#34676). That catches a load that
raced an update, but not one that reads through an older snapshot. A repository write transaction
on MySQL runs under REPEATABLE READ, and the cache loader's DAO call joins the thread's open
transaction. A load that starts after an update invalidated the cache can therefore still read the
pre-update row, be stamped as current, and be served to every later read for up to three minutes.
In the merge queue a data-product domain PATCH did exactly that with `entityRulesSettings` while a
test disabled the multi-domain rule, so the test's next update was rejected by the disabled rule.

## Decision
The outermost attempt of a repository transaction (`TransactionRollbackTracker.runAttempt`, the
start of every `flushInOneTransaction` / `executeInTransaction` attempt) records the invalidation
count through `SettingsCache.inTransactionAttempt`. A setting loaded on that thread is stamped with
the lower of that count and the count at load time. A read reloads a cached value only when a
reload on its own thread could be stamped newer, so a transaction older than the latest
invalidation reloads at most once.

## Consequences
Reads outside a transaction, and transactions with no invalidation since they started, behave
exactly as before. A transaction that overlaps a settings update still reads its own snapshot, but
the value it caches is stale-stamped, so the next read outside it reloads the update. On Postgres
(READ COMMITTED) the stamp is merely conservative and costs at most one extra reload. Transactions
opened directly on `Entity.getJdbi()` or by a `@Transaction` DAO method are not tracked and keep the
old behavior. Rejected: bypassing the cache inside transactions (settings read only by writes, such
as the column-indexing flag on every table write, would never be cached and DB errors would escape
unwrapped), loading settings on a second connection (pool starvation while the first is held), and
READ COMMITTED for the main pool (changes every query). Revisit if writes stop running under a
snapshot isolation level.
