# dbt legacy definitions are hard-deleted only after their cases are reassigned

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `ingestion/tests/integration/dbt/test_definition_migration.py`; `ingestion/tests/unit/test_dbt_test_definition_migration.py`
- **Related:** https://github.com/open-metadata/OpenMetadata/pull/28927

## Context

Generic dbt tests now share definitions by type and table/column scope. Existing
cases still reference per-instance definitions created by older ingestion versions.
Recreating the cases would change their identity and disconnect their history.

## Decision

During ingestion, reassign an existing generic-test case only when its definition
matches the legacy node name, dbt platform, scope, and generated parameters. Retain
customized definitions, including custom descriptions not preserved by the case or
manifest, owners, domains, restrictions, and execution settings. Resolve the shared
definition from the manifest and verify its platform, scope, parameters, and enabled
state before patching the existing case. Use the case version for a conditional
patch and require the response to confirm the same case ID and target definition.

After reassignment, request `DELETE /v1/dataQuality/testDefinitions/{id}/unused`
with the legacy definition's weak-version `If-Match` header. The endpoint locks
the definition row and checks its version in the same transaction as hard deletion,
so a concurrently saved customization produces HTTP 412 and is retained.
The server must reject deletion while any case, including a soft-deleted case,
references the definition. The endpoint always uses non-recursive hard deletion.
Older servers return 404 for this new route, retaining the definition safely. Failed cleanup is reported
and retried when the already-reassigned case is encountered on a later ingestion.

## Consequences

Case IDs, names, parameters, and historical results remain attached to the original
case. Deleting an unused legacy definition is permanent. Customized and ambiguous
definitions remain available for manual review. Tests absent from the manifest are
not migrated or globally swept. Migration requires permission to edit cases and
delete definitions; a failed patch never leads to deletion.
