# Settings loaded inside a transaction are stamped with the invalidation count at its start

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `SettingsSnapshotTransactionHandlerTest`, `SettingsCacheTransactionIT`, `SettingsCacheInvalidationTest`
- **Related:** #34676; PR #35530 merge-queue ejection (`DataProductResourceIT.test_deleteOneDomainForMultiDomainDataProduct_preservesDataProductUntilLastDomain`)

## Context
`SettingsCache` stamps each loaded value with the invalidation count its load started from, and a
read reloads a value stamped before the latest invalidation (#34676). That catches a load that
raced an update, but not one that reads through an older snapshot. A repository write transaction
on MySQL runs under REPEATABLE READ, and the cache loader's DAO call joins the thread's open
transaction, including one opened directly on `Entity.getJdbi()`. A load that starts after an update invalidated the cache can therefore still read the
pre-update row, be stamped as current, and be served to every later read for up to three minutes.
In the merge queue a data-product domain PATCH did exactly that with `entityRulesSettings` while a
test disabled the multi-domain rule, so the test's next update was rejected by the disabled rule.

## Decision
`JdbiUtils` installs `SettingsSnapshotTransactionHandler` around Jdbi's transaction handler. Jdbi
reaches the handler only for a handle's outermost transaction, so every transaction on the server's
Jdbi, whether a repository unit of work, a raw `Entity.getJdbi().inTransaction` or a `@Transaction`
DAO method, records the invalidation count when it starts through `SettingsCache.inTransaction`. A
setting loaded on that thread is stamped with the lower of that count and the count at load time. A
read reloads a cached value only when a reload on its own thread could be stamped newer, so a
transaction older than the latest invalidation reloads at most once. The handler specializes per
handle like the handler it wraps, so transactions keep Jdbi's per-handle path.

## Consequences
Reads outside a transaction, and transactions with no invalidation since they started, behave
exactly as before. A transaction that overlaps a settings update still reads its own snapshot, but
the value it caches is stale-stamped, so the next read outside it reloads the update. On Postgres
(READ COMMITTED) the stamp is merely conservative and costs at most one extra reload. A transaction
opened on another handle inside one never raises the start: the loader's DAO reads through the
handle bound to the thread, the enclosing one, so the enclosing start stays in force.
Rejected: bypassing the cache inside transactions (settings read only by writes, such as the
column-indexing flag on every table write, would never be cached and DB errors would escape
unwrapped), loading settings on a second connection (pool starvation while the first is held),
READ COMMITTED for the main pool (changes every query), and hooking only the repository retry
boundary (raw Jdbi transactions stayed exposed). Revisit if writes stop running under a snapshot
isolation level, or if a Jdbi upgrade changes when `TransactionHandler.inTransaction` is reached.
