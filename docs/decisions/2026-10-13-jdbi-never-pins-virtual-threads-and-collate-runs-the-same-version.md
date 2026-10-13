# Jdbi stays on a release that does not pin virtual threads, and Collate runs the same Jdbi version

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `JdbiVirtualThreadPinningTest`; reviewer for Collate's `jdbi3.version`
- **Related:** #35373; `pom.xml` `jdbi3.version`; `jdbi3/locator/ConnectionAwareSql*`

## Context

Jdbi before 3.45.4 opens an on-demand handle inside a `synchronized` block
(`MemoizingSupplier.init`). On Java 21 a virtual thread that parks while holding a monitor keeps its
carrier thread. `HikariDataSource.getConnection` parks when the pool is exhausted, and with leak
detection on (60 s by default) it also queues on the lock of the scheduler that tracks leaks. Once as
many virtual threads as there are carriers were parked there, the thread next in line for that lock
had no carrier to run on, and the server's virtual-thread scheduler stopped for good.

That was the integration-test "wedge": async deletes stopped, requests that wait on virtual-thread
work (search document builds) hung until the client's 300 s timeout, and MySQL timed out on row locks
the stuck threads held. Twelve stall dumps from five CI runs, across all three database and search
pairings, showed the same four threads pinned inside `MemoizingSupplier.init` on a four-CPU runner.
Production runs the same code path.

## Decision

`jdbi3.version` is 3.45.4 or later. It is set to the version `dropwizard-jdbi3` is built against
(3.49.5 for Dropwizard 5.0.0), which also lines `jdbi3-core` and `jdbi3-sqlobject` up with the
`jdbi3-guava` that Dropwizard brings in.

The `ConnectionAwareSql*` annotations register their handlers with
`@UseExtensionHandler(id = SqlObjectFactory.EXTENSION_ID, …)`, which only Jdbi 3.38 and later
provide. Collate compiles against OpenMetadata and pins `jdbi3.version` itself, so a Jdbi change
lands in both repositories together and they run the same version.

## Consequences

Opening a handle no longer pins a virtual thread, so a slow or exhausted pool delays requests instead
of stopping the scheduler. A Jdbi bump is now a two-repository change. A Collate build left on an
older Jdbi cannot see the handler annotation and cannot run OpenMetadata's DAOs. Revisit the floor if
the server moves to a JDK where monitors no longer pin virtual threads (JEP 491, JDK 24).
