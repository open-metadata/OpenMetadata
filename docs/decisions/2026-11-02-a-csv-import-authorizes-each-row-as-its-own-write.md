# A CSV import authorizes each row as its own write

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial); v2 2026-11-03 (column rows as their PATCH, admin imports, parents)
- **Deciders:** Sonika Shah
- **Guard:** `DatabaseServiceResourceIT` (`test_recursiveImportCannotEditEntitiesOutsideCallerPermissions`,
  `test_recursiveImportByServiceOwnerCreatesAndUpdatesOwnHierarchy`,
  `test_recursiveImportChecksEachNewRowAgainstItsOwnType`,
  `test_recursiveImportCannotEditColumnsOfTableOutsideCallerPermissions`,
  `test_recursiveImportChecksChildOfNewDatabaseAgainstTheDatabaseOwners`,
  `test_recursiveImportChecksColumnRowsOfTableSharingStoredProcedureFqn`), `GlossaryResourceIT`,
  `TeamResourceIT`, `TestCaseCsvDomainIsolationIT` (`test_importCsv_rowIsCheckedAgainstItsOwnTable`,
  `test_importCsv_explicitDenyOnTestCaseRefusesRowAllowedOnTable`)
- **Related:** ADR:2026-10-09-bulk-edits-authorize-each-entity-as-its-patch,
  ADR:2026-10-30-a-test-case-write-is-authorized-as-a-create-or-an-update

## Context
The import endpoints authorize only the entity named in the path, but a row can name any entity by
its FQN, so an import could create or overwrite entities the importer may not write over REST.

## Decision
- Each row is authorized as the importing user, as the matching REST write: `EDIT_ALL` on the
  stored entity it updates, as a PUT is, and `CREATE` on the entity it creates, checked against its
  parent. A row that changes nothing still needs `EDIT_ALL`, as an unchanged PUT does.
- Column rows are written as one PATCH of their table, so they are checked as that PATCH, with the
  operations its paths map to over REST. The import also sets each column's position from its row,
  which only `EditAll` covers, so a reordering import needs it. Columns of a table the same file
  created are covered by that table's `CREATE`.
- Only a table the file created covers its column rows; another entity with the same FQN (e.g. a
  stored procedure) does not.
- A row creating an entity under a parent created earlier in the same file is checked against that
  parent as REST would read it once stored: its own owners, or its parent's where the type inherits
  owners (a schema does, a database does not), and the domains it inherits. A team is checked
  against all of its parents. A parent counts only once its own row has succeeded.
- The authorizer evaluates no policy for an admin, so an admin's import skips the per-row checks.
- Test case rows use the REST test-case write checks (`TestCaseWriteAuthRequests`).
- Those checks follow `AuthorizationLogic.ANY` as REST does: every request is checked, one must be
  allowed, and an explicit deny on any of them refuses the row.
- A refused row fails on its own and the rest of the import continues, in dry runs as well. User
  import keeps its own privileged-field checks.

## Consequences
An import can no longer write what the importer could not write over REST, including a child type
an explicit deny covers. Importers that relied on the endpoint check alone see failed rows for
entities outside their permissions. A dry run and a real run reach the same decision for each row.
