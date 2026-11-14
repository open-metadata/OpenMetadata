# SQL objects build a method's Jdbi handler on first call, not on every attach

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `LazySqlObjectFactoryTest`, `JdbiVirtualThreadPinningTest`
- **Related:** ADR:2026-10-13-jdbi-never-pins-virtual-threads-and-collate-runs-the-same-version; #35374; jdbi/jdbi#2601

## Context
From Jdbi 3.38, attaching a SQL object builds a handler, each with a full copy of the
configuration, for every method of the type (`ExtensionFactoryDelegate.attach`). An on-demand DAO is
attached on every call, and `getCollectionDAO().xDAO().m()` attaches `CollectionDAO` (about 150
methods) and the entity DAO (about 80). Moving from 3.37.1 to 3.49.5 for the pinning fix made every
DAO call allocate roughly ten times more. With the same IT classes on the same machine, the server
allocated 19.9 GB on 3.37.1 and 53.8 GB on 3.49.5, 66% of it inside that attach; SQL count and time
in the database were unchanged. The single workflow-event consumer, which makes 39 to 110 uncached
DAO calls per approval workflow, fell behind and approval ITs timed out on every engine. Every
pin-free Jdbi release builds handlers this way, so a version change does not avoid it.

## Decision
`JdbiUtils` registers `LazySqlObjectFactory` in front of Jdbi's `SqlObjectFactory`. It reuses the
same `ExtensionMetadata`, makes one instance configuration per attach, and builds a method's handler
the first time that method is called. `@CreateSqlObject` getters on a handle attach the nested DAO the
same lazy way. Handlers are built outside any lock, so attaching never pins a virtual thread.

## Consequences
DAO calls cost what they did on 3.37.1 while keeping the pin-free release. The factory relies on
`@Alpha` Jdbi APIs (`Extensions.findMetadata`, `ExtensionMetadata.createExtensionHandlerInvoker`) and
on `OnDemandHandleSupplier`, so a Jdbi upgrade must run `LazySqlObjectFactoryTest`. A misconfigured
DAO method now fails when it is first called rather than when its DAO is attached. Remove the
factory if Jdbi builds handlers lazily again (jdbi/jdbi#2601).
