# A migration's entity lookup treats only a missing table as empty

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Platform team
- **Guard:** `EntityFqnHoldersIT`
- **Related:** PR #37796, PR #37960

## Context
Some data migrations look an FQN up in every registered entity table, to learn whether another
entity holds it before they move rows keyed by that FQN alone, such as `tag_usage`. `repairContextFileFqns`
in 2.1.0 does this before moving a Context Center file's tags.

A migration runs while every entity type of the running build is registered, but before the tables
that later migrations create exist. Native migrations run before extension migrations of the same
version, so on a Collate server OpenMetadata's 2.1.0 data step runs before `2.1.0-collate` creates
tables for types Collate has already registered. Reading every failed lookup as "this name may be
taken" left every repaired file's tags behind on Collate upgrades from 2.0.

## Decision
`EntityFqnHolders` treats a table as holding nothing only when the database reports that it does
not exist: SQLSTATE `42S02` on MySQL, `42P01` on PostgreSQL. Any other failure is reported as a
holder, so a caller never takes a name it could not check. A table found missing is not queried
again in the same run.

## Consequences
A migration can look entities up across every registered type even when a later migration creates
some of their tables. A table that exists but cannot be searched still blocks the caller, which may
leave work for a manual repair rather than move rows that belong to another entity. A new database
engine needs its own missing-table SQLSTATE added before it can rely on this.
