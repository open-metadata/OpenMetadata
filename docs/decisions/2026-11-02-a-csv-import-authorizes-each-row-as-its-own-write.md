# A CSV import authorizes each row as its own write

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `DatabaseServiceResourceIT` (`test_recursiveImportCannotEditEntitiesOutsideCallerPermissions`,
  `test_recursiveImportByServiceOwnerCreatesAndUpdatesOwnHierarchy`,
  `test_recursiveImportChecksEachNewRowAgainstItsOwnType`,
  `test_recursiveImportCannotEditColumnsOfTableOutsideCallerPermissions`), `GlossaryResourceIT`,
  `TeamResourceIT`, `TestCaseCsvDomainIsolationIT.test_importCsv_rowIsCheckedAgainstItsOwnTable`
- **Related:** ADR:2026-10-09-bulk-edits-authorize-each-entity-as-its-patch,
  ADR:2026-10-30-a-test-case-write-is-authorized-as-a-create-or-an-update

## Context
The import endpoints authorize only the entity named in the path, but a row can name any entity by
its FQN, so an import could create or overwrite entities the importer may not write over REST.

## Decision
- Each row is authorized as the importing user, as the matching REST write: `EDIT_ALL` on the
  stored entity it updates, `CREATE` on the entity it creates, checked against its parent.
- A row creating an entity under a parent created earlier in the same file is checked on its own
  type too, in real and dry runs alike, against that parent as the file defines it: with the owners
  and domains it inherits where its row set none (writes are batched, so the parent may not be
  stored yet). The importer created that parent and could have named itself owner over REST, so this
  grants nothing REST would refuse. Teams do not inherit owners.
- Test case rows use the REST test-case write checks (`TestCaseWriteAuthRequests`).
- A refused row fails on its own and the rest of the import continues, in dry runs as well. User
  import keeps its own privileged-field checks.

## Consequences
An import can no longer write what the importer could not write over REST, including a child type
an explicit deny covers. Importers that relied on the endpoint check alone see failed rows for
entities outside their permissions. A dry run and a real run reach the same decision for each row.
