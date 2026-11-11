# Life cycle timestamps before the Unix epoch are dropped on every write

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `LifeCyclesTest` (unit) and `BaseEntityIT.patch_entityLifeCyclePlaceholderTimestampIsDropped` (every entity with a life cycle); the table header guard in `DataAssetsHeader.utils.test.tsx`
- **Related:** #34025 (removed the placeholder at the source and added the 2.1.0 cleanup migration)

## Context
Older ingestion clients substituted Python's `datetime.min` for a source that reported no creation
time, so `lifeCycle.created.timestamp` was stored as -62135596800000 and rendered as year 0001. The
2.1.0 migration (`LifeCycleCreatedSentinelMigration`) removes such values once. The server still
accepted them afterwards: the only guard in `EntityUpdater.updateLifeCycle` compares against a stored
value, so once the migration cleared it, an older client could write the placeholder again, and the
table header showed it.

## Decision
`EntityRepository.prepareInternal`, which runs for create, PUT, PATCH and bulk create, drops any
`created`, `updated` or `accessed` aspect whose timestamp is before the Unix epoch (`< 0`, the same
threshold the migration uses), and drops the whole `lifeCycle` when no aspect remains. The write
still succeeds; nothing is rejected. A timestamp of exactly 0 is kept. The UI hides a pre-epoch
creation time for values stored before this rule.

A PATCH whose `lifeCycle` carries nothing but placeholders keeps the stored life cycle instead
(`preparePatched`): older clients replace the whole field, and an emptied value would otherwise
remove the recorded times. A PUT already keeps the stored life cycle when it sends none.

## Consequences
Older ingestion clients keep working against a newer server, and the placeholder can no longer come
back after the migration. A client cannot record a genuine pre-1970 date, which no data asset has.
The schema keeps no `minimum`, because a schema bound would turn the same request into a 400 for
those clients and would regenerate every client model.
