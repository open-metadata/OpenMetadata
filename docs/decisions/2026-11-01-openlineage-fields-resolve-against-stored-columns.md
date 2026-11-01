# An OpenLineage field resolves through the stored columns, and a column it creates takes the connector's reserved-keyword name

- **Status:** Accepted
- **Revisions:** v1 2026-11-01 (initial)
- **Deciders:** ccurve1870
- **Guard:** `OpenLineageMapperTest`, `OpenLineageColumnMapperTest`, `test_openlineage.py::test_get_column_lineage_uses_stored_fqn_of_special_column_names`, `OpenLineageLineageResolutionIT#columnLineage_reachesStoredColumnsOfSpecialFieldNames`
- **Related:** #36788, #35969, #30211

## Context
OpenLineage producers report columns as the source names them, so a field can be `a>b` or `c.d`.
Since #30211 a column name cannot hold `::`, `>`, `"` or control characters, and connectors store
keywords in their place (`a__reserved__arrow__b`). A dot stays in the name and is quoted in the FQN
(`"c.d"`). A column FQN built by appending a field to the table FQN therefore misses these columns,
and `LineageRepository.validateLineageDetails` drops the entry without reporting it. Quoting every
dotted field is no answer either: `s.x` also names the child `x` of a struct `s`, and that FQN is
not quoted.

## Decision
- A column FQN in OpenLineage lineage comes from the stored column, never from the field name
  alone.
- On the server (`OpenLineageMapper`), a field resolves against a table's stored columns by the
  dotted path of their names: first as sent, then with reserved keywords, and only then as
  `<datasetFqn>.<field>`. Trying it as sent first keeps a column stored with a raw `>` matching.
  Datasets that are not tables always use `<datasetFqn>.<field>`.
- In the connector (`OpenlineageSource._match_column_fqn`), a field matches a fetched column by
  case-insensitive name and takes that column's `fullyQualifiedName`. A fetched name has its
  reserved characters decoded, so it cannot be used to rebuild the FQN.
- A column created from an event takes `OpenLineageColumnMapper.toStoredName`, which must produce
  what `replace_separators` in `custom_basemodel_validation.py` produces: `::`, `>`, `"`, newline,
  carriage return and tab become `__reserved__colon__`, `__reserved__arrow__`,
  `__reserved__quote__`, `__reserved__newline__`, `__reserved__carriage_return__` and
  `__reserved__tab__`.

## Consequences
- A later metadata ingestion updates a column created from an event instead of adding a second one.
- The keyword list lives in Python and Java, and no test ties the two together: changing one means
  changing the other.
- A column literally named `s.x` and the child `x` of a struct `s` in the same table share one
  field path, so a field reaches the one that comes later in the table.
- An event with column lineage reads the stored columns of its outputs and of each input it
  references, once per event.
