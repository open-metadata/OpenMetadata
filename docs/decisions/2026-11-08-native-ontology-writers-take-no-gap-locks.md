# Native ontology writers serialize on the ontology state row and take no gap locks

- **Status:** Accepted
- **Revisions:** v1 2026-11-08 (initial)
- **Deciders:** Ontology Studio program
- **Guard:** `OntologyConcurrentWriteIT`
- **Related:** #37357, ADR:2026-11-03-bulk-entity-deletes-pin-the-primary-key-index

## Context
On MySQL, writers in different native ontologies deadlocked each other. Two kinds of statement
caused it, both under REPEATABLE READ:

- Validation reads with `FOR UPDATE`: `OntologyReferenceDAO.incomingInverses`, `ancestors` and
  `referencingForUpdate`, and `findDeclarations` on the concept and property tables. A locking
  range read takes next-key locks. The lock on the first key past the ontology's own keys, or on
  the supremum, also covers the gap where another ontology inserts.
- Rewriting a definition's references with `DELETE FROM ontology_reference WHERE sourceType = ?
  AND sourceId = ?` and then inserting them again. The delete locks the gap after the source's
  keys, often an empty range, and the insert of a second writer lands in that gap.
- Hard-delete cleanup with range deletes: `DELETE FROM entity_relationship WHERE toId IN (...)`
  and the `fromId` variant, and `DELETE FROM entity_extension WHERE id IN (...)`. These take gap
  locks that a concurrent insert of another ontology needs.

Three runs of the ontology ITs of the parallel lane on `main` logged 87 InnoDB deadlock reports,
79 of them on these tables. In two of the runs a deadlock outlasted the server's retry and failed a
request with a 500.

The locking reads were redundant. Every write to an ontology's definitions, references and
relationships runs inside `OntologyWorkingState.mutate`, which takes that ontology's
`ontology_state` row lock (`OntologyWorkingState.lock`) as the first statement of the transaction.
The change-set and library-pack paths enter through `OntologyRepository.applyWorkingChanges`, which
takes the same lock first. InnoDB fixes a REPEATABLE READ snapshot at the first non-locking read.
So a plain read under the lock already sees every commit of every earlier writer of that ontology,
and no later writer can commit until this transaction ends.

## Decision
- The `ontology_state` row lock is the only lock that orders writers of one native ontology. A
  transaction that reads the ontology's working rows takes it before its first non-locking read.
  A path that must find the ontology first, as release cancellation does, reads only immutable
  ownership before the lock and uses locking reads after it.
- Reads of an ontology's working rows under that lock do not lock. `findDeclarations`,
  `incomingInverses`, `ancestors`, `disjointAxioms` and `referencing` have no locking variant.
  Locks by primary key on rows that exist, such as `findJsonByIdForUpdate` in
  `OntologyWorkingState`, stay. They lock one record and no gap.
- `OntologyReferenceIndex.replace` reads the source's reference keys without locking, deletes the
  keys the definition no longer has and inserts the new ones, each by full primary key. Keys that
  did not change are not written.
- A hard delete of an ontology definition reads the primary keys of its `entity_relationship` and
  `entity_extension` rows without locking, in chunks of 100 entities. It then deletes each row by
  its full primary key, in batches of 500 (`OntologyEntityRepository.deleteRelationshipRows`,
  `deleteExtensionRows`). Other entity types keep the range deletes.

Tried and rejected:
- READ COMMITTED for ontology transactions. It removes gap locks, but MySQL then refuses writes
  when a deployment logs binlogs in `STATEMENT` format. It also changes every read in the
  transaction, not only these. The earlier delete fix found it did not remove that deadlock.
- A new lock on the `ontology_entity` row. The `ontology_state` lock already serializes these
  writers, and a second lock adds a lock order to keep.
- Exact-key deletes for every entity type. Other types have no lock taken before the snapshot. A
  relationship row committed after the snapshot would then survive the delete.

## Consequences
- Writers in different ontologies share no row or gap lock in these tables. Writers in one
  ontology still serialize, so inverse and structure validation see a stable model.
- A new path that writes ontology rows without `OntologyWorkingState.lock`, or reads before taking
  it, makes the plain reads stale. It must take the lock first.
- Relationship rows written without the ontology lock can survive a hard delete. A row committed
  after the delete's snapshot is not deleted. No such writer exists today: ontology definitions
  have no followers or votes, and their owners and containment are written under the lock. The
  range deletes had the same race in another form. They blocked such an insert until commit, and
  the insert then landed anyway.
- `OntologyConcurrentWriteIT` runs inverse writes in six ontologies at once, and a recursive hard
  delete beside writes to another ontology. It asserts that InnoDB's deadlock counter does not
  rise. A third case contends eight writers for one inverse and asserts the link stays an
  involution. It runs in the global-state lane because the counter is database-wide.
