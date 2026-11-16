# An asset's activity feed includes its data contract's activity, and approvals reach the feed

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Governance (OpenMetadata)
- **Guard:** `ActivityResourceIT.test_getEntityActivity_includesItsDataContractActivity`, `ActivityStreamRepositoryTest.createFieldEventsFromChangeEventRecordsStatusChanges`, `EntityFieldUtilsTest.setEntityFieldCreatesPatchAndChangeEventWhenEntityChanges`, `MigrationUtilTest` (`migration/utils/v206`)
- **Related:** #35662, ADR:2026-10-19-a-table-inherits-its-schemas-approved-data-contract

## Context
A data contract is created, edited and approved from its asset's Contract tab, yet its activity was
stored under the contract alone, so the asset's Activity Feeds & Tasks never showed it. Workflow
approvals did not reach any feed: their change events carried no field changes, and
`ActivityFeedAlert` admitted neither `entityStatus` changes nor `dataContract` as a source.

## Decision
- `GET /v1/activity/entity/{type}/{id}` (and `/name/{fqn}`), list and `limit=0` count, returns the
  asset's events together with those of every `dataContract` the asset `CONTAINS`: ordered by
  timestamp descending and capped at `limit`, with counts summed.
- A change event a governance workflow writes (`EntityFieldUtils.setEntityField`) carries the
  patched entity's `changeDescription`, like an event from a REST write.
- `ActivityFeedAlert` admits `entityStatus` field changes for **every** source it covers (glossary
  terms, metrics, … as well as contracts), and `dataContract` as a source.
- System alerts change on existing installs **in place** (a Java data migration adding the values),
  never by deleting the stored alert for the seed to recreate: that would reset its id, consumer
  offset and admin settings such as `enabled`.

## Consequences
Contract changes and workflow approvals appear where users look for them, with a readable summary
("Status of X changed to Approved"). Feeds for glossary terms and metrics also gain their status
changes. Adding another contained child to an asset's feed means extending
`ActivityStreamRepository.activitySourcesOf`. If `/activity/entity` ever gains a cursor, the merge
must page both sources consistently.
