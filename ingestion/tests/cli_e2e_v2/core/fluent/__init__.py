#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Fluent assertion API for CLI E2E v2 tests.

Entry point: `om_client` fixture → `OmClient`. Every fluent chain starts
with one of `.table(fqn)`, `.service(name)`, or `.stored_procedure(fqn)`.

Sync vs eventually
------------------
Most terminals are **synchronous** — they assume the data is already in OM
(typical after a completed metadata ingest). A few entity domains are
**eventually-consistent** and must be wrapped in `.eventually(timeout=60)`
one-shot arming:

  eventually: profile, lineage, foreign-key constraint, service entity count
  sync only:  column.has_type, column.has_tag, stored_procedure, structural

Arming is ONE-SHOT: it applies to the very next terminal in the chain and
resets afterward. Arm again for each eventually-polled assertion.

Assertion catalog
-----------------

  # Table (om_client.table(fqn) -> TableAssert)
  .exists()                                              # sync
  .get() -> Table                                        # escape hatch, returns raw entity
  .has_description_containing(text)                      # sync or eventually
  .has_tag(tag_fqn)                                      # sync or eventually
  .has_owner(name)                                       # sync or eventually
  .eventually(60).has_foreign_key_constraint(column=..., referenced_table=..., referenced_column=...)

  # Column (via table.column(name) -> ColumnAssert, sync only)
  .has_type(DataType.X)
  .has_tag(tag_fqn)
  .has_description_containing(text)

  # Profile (via table.profile, MUST arm with .eventually())
  table.profile.eventually(60).row_count().equals(N)
  table.profile.eventually(60).row_count().at_least(N)
  table.profile.eventually(60).row_count().between(lo, hi)

  # Lineage (via table.lineage, MUST arm with .eventually())
  table.lineage.eventually(60).has_upstream(fqn)
  table.lineage.eventually(60).has_downstream(fqn)
  table.lineage.eventually(60).has_column_lineage(source_col, target_col)

  # Service (om_client.service(name) -> ServiceAssert)
  .exists()
  .has_description_containing(text)
  .eventually(60).has_entity_count("tables", at_least=N)
  .eventually(60).has_entity_count("schemas", at_least=N)

  # Stored procedure (om_client.stored_procedure(fqn) -> StoredProcedureAssert)
  .exists()
  .has_description_containing(text)
  .has_code_containing(text)

Structural differ (a different entry point, not fluent)
-------------------------------------------------------
  from ..core.expected.differ import assert_service_matches, MatchMode
  assert_service_matches(expected_tree, om_client)                         # SUPERSET (default)
  assert_service_matches(expected_tree, om_client, mode=MatchMode.STRICT)  # filter tests

Walks the entire Expected* tree at once and raises `StructuralMismatch`
collecting every diff — use this over one-off chains when you're
verifying "the whole catalog looks right."

Extending
---------
New entity namespace (e.g. `DqAssert`): inherit `EntityAssert[T]` if the
class IS the entity; compose an `EventuallyRunner` directly if it's a
namespace hanging off a parent (see LineageAssert / ProfileAssert).
"""
