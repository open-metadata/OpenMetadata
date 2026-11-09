# dbt legacy definitions are repaired once during bootstrap

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial); v2 2026-11-09 (bootstrap migration)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `DbtTestDefinitionMigrationTest`; `DbtTestDefinitionMigrationIT`
- **Related:** https://github.com/open-metadata/OpenMetadata/pull/28927

## Context

Generic dbt tests now share definitions by type and table/column scope. Existing
cases still reference per-instance definitions created by older ingestion versions.
Recreating the cases would change their identity and disconnect their history.
Running this repair in ingestion would repeatedly scan old records and require a
new conditional deletion API to protect against concurrent user edits.

## Decision

Run the repair in the 2.1.0 bootstrap data migration for MySQL and PostgreSQL,
before the test-case dimension backfill. Use `DataMigrationStep.runOnce` so a
successful repair is recorded and skipped on subsequent bootstrap runs. Failures
propagate without a completion marker. The repair is independently idempotent so
partially completed work is safe to retry.

Recognize a legacy definition using its dbt-only platform, table/column scope,
single generated parameter, and referencing cases. The parameter name identifies
the generic dbt macro. Column definitions use that name; table definitions append
`_table`, matching the current ingestion naming convention. Require every case to
match the legacy name, scope, parameter and description, and at least one active
case. Orphans cannot establish provenance and are retained.

Retain customized, disabled, deleted, system, or ambiguous definitions, including
non-case relationships and cases linked to multiple definitions. Reuse an existing
shared definition only when its platform, scope, parameters and execution settings
are compatible. Otherwise leave the group untouched. Create a missing shared
definition with the generated parameters and a generic description.

Reassign active cases through their stored definition relationships, removing any
obsolete embedded definition reference. Do not recreate cases or change their
IDs, names, parameters, versions, suites, timestamps or historical results. Retain
soft-deleted cases and their legacy references. Hard-delete a legacy definition
and its ancillary history only after no relationships remain. Each definition
group is transactional; scans use bounded 500-record batches.

No ingestion hook or dedicated REST endpoint is required. Bootstrap executes in
the existing upgrade lifecycle before serving traffic. Reassignment removes the
stored test-case mapping version in the same transaction, so the normal upgrade
reindex detects it as untracked and refreshes cases even without mapping changes.

## Consequences

Upgrade repairs recognized legacy cases even when they are absent from a later
dbt manifest. Hard deletion is permanent. Customized and ambiguous records remain
for manual review, including orphaned definitions and definitions used only by
soft-deleted cases. These intentionally skipped records are not retried on each
ingestion. The completion marker avoids repeated scans when another 2.1.0 helper
changes the migration fingerprint. A server build containing this migration is
required; modern ingestion alone only prevents new duplicate definitions.
