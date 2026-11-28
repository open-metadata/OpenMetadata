# Domain lineage rollup writers lock guard rows in one order

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `DomainLineageConcurrencyIT`, `LineageDomainCoordinatorTest`
- **Related:** #33961, #38277,
  ADR:2026-11-20-a-domain-lineage-edge-counts-the-edges-its-domains-assets-hold-in-effect

## Context
A domain rollup row counts the asset edges between two domains. Two kinds of live writer change
it: a domain write that moves the rollups of the assets it re-homes (an asset's own domains, a
container and its descendants, a data product's assets), and a lineage edge add, delete or patch.
Each reads the domains in effect and the stored count, then writes the count back with an upsert.
Without coordination an edge write that read the old domains or count before a service's move
commits writes a stale count after it, or counts its edge under a pair the move just left. A
delete loses its decrement on a pair the move already emptied. Two edge writes creating the same
pair both read no row. Locking only the rollup row does not help: the row may not exist yet, and
the domains are read before the row is.

## Decision
- **One table of guard rows, `domain_lineage_guard`**, seeded by 2.1.2: `domain-move`, 64 edge
  stripes `edge-00`..`edge-63` and 64 pair stripes `pair-00`..`pair-63`. A stripe is the top
  six bits of `FNV-1a(from id, to id)` (`LineageDomainCoordinator.stripe`); its low bits follow
  only the low bits of each byte. The rows always exist, so a
  lock on a pair whose rollup row is not written yet still excludes.
- **A domain write that moves rollups locks `domain-move` exclusively** (`SELECT … FOR UPDATE`),
  as the first statement of its transaction: the updater's flush when the write changes the
  entity's own domains (decided before the transaction opens, by the rule the write applies), the
  CSV batch flush when a row moves domains, and a data product leaving a deleted domain before it
  reads the domains. `LineageDomainInheritors.of` and `LineageDomainRollups.move` take the same
  lock again as a backstop, so a write the early check misses is still excluded, later in its
  transaction.
- **A lineage write holds `domain-move` shared**, then its edge's stripe, then the stripes of the
  domain pairs it counts into, distinct and sorted, each before the row it covers is read. A
  `domain → domain` edge written directly also takes its own pair's stripe. Every lineage write
  is one transaction (`LineageWriteTransaction`) at READ COMMITTED, with the deadlock retry
  around the whole write.
- **Lock order is `domain-move`, then edge stripes, then pair stripes, then the rows.** No
  transaction takes `domain-move` shared and later exclusive.
- **Reads under the lock come from the database.** The ends' domains are read with
  `FreshReadScope` and `EntityCacheBypass`: a domain write that just committed may not have
  evicted the cache yet.
- **No search or cache I/O in the locked transaction.** The edge's search write, the cache
  invalidation, RDF and the rollup's search write run after commit; a rolled-back attempt drops
  its own. A rollup's search write reads the row as stored when it runs, not the count its
  transaction computed, writes it synchronously, then reads the row again and writes again while
  it differs (at most three writes). Two writers' syncs can interleave as read A, read B, write B,
  write A; A's second read then sees B's commit, so the last sync to write leaves the committed
  row in search.
- **Isolation.** MySQL's REPEATABLE READ fixes a snapshot at the transaction's first plain read.
  A lineage write that waited on a pair stripe would then read the count from before the writer
  it waited for, so lineage writes run at READ COMMITTED. A domain write keeps the default level
  and is correct because its lock is its first statement: its snapshot starts after every lineage
  write it excluded has committed. Postgres's default is READ COMMITTED.

## Consequences
- **What blocks what, and for how long.** A domain write that moves rollups blocks every lineage
  add, delete and patch on the server, on any assets, and every other such domain write, from its
  first statement to its commit: about 100 to 300 ms for a service with up to 1,000 lineage-bearing
  tables and about a second at the 5,000 cap (the measurements in
  ADR:2026-11-20-a-domain-lineage-edge-counts-the-edges-its-domains-assets-hold-in-effect), and
  the whole batch flush for a CSV import that moves domains. Each lineage write waiting for it
  holds a pooled connection while it waits, so a long import that moves domains while ingestion
  writes lineage can drain the pool. A domain write in turn waits for the lineage writes in flight,
  each a few milliseconds of SQL, and the lineage writes that arrive after it queue behind it.
  Lineage writes do not block one another except on the same edge or pair stripe, where two
  unrelated edges or pairs collide one time in 64. Writes that leave domains as they are, including
  an ingestion PUT that sends none, take no lock.
- **Each lineage write is a transaction** of its own, with two extra statements on MySQL to set and
  restore the isolation level. Before, its statements auto-committed one by one.
- **The rebuild takes no lock.** It scans the whole relationship table and needs lineage and
  domain writes paused, as its command says.
- **Not coordinated:** service and data product rollups (`addServiceLineage`,
  `addDataProductLineage`) keep their unlocked read and upsert, and `deleteLineageBySource` holds
  only `domain-move` shared and still decrements no domain rollup.
- **To revisit:** if domain writes become frequent, lock the moved containers' FQN prefixes
  instead of one row, with each lineage write taking its ends' ancestor prefixes shared.
