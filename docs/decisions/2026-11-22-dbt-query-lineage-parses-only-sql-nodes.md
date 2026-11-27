# dbt query lineage parses only nodes whose language is SQL

- **Status:** Accepted
- **Revisions:** v1 2026-11-22 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `ingestion/tests/unit/test_dbt_python_models.py` (`TestDbtModelLanguage`)
- **Related:** [#38330](https://github.com/open-metadata/OpenMetadata/issues/38330), [#37092](https://github.com/open-metadata/OpenMetadata/issues/37092)

## Context

The dbt connector wraps every data model's compiled code as `create table <model> as <code>` and
sends it through the SQL lineage parser. A dbt Python model's compiled code is Python, so each one
logged a sqlglot "unsupported syntax" warning, spent the sqlglot → sqlfluff → SqlParse cascade
against `parsingTimeoutLimit`, and SqlParse read imports such as `from pyspark.sql import …` as a
source table, looked it up in OpenMetadata, and could write a lineage edge to whatever it resolved.
The manifest already says which nodes are SQL: dbt writes `language` on every node from manifest
v7 (dbt 1.3, which introduced Python models), except seeds.

## Decision

Only nodes whose `language` is absent or `sql`, compared case-insensitively, are parsed for query
lineage. Absent covers manifests before v7, seeds and sources. Any other value, today `python`, is
not parsed. Such a node still stores its code in `dataModel.sql` and `dataModel.rawSql`, so the dbt
tab and AI context keep showing it, and it still gets lineage from `depends_on` (`dbt.ref` and
`dbt.source`). The decision is made per node in `yield_data_models` and carried on
`DataModelLink.parse_query_lineage`, which defaults to `True` for every other producer of the link.

## Consequences

A future non-SQL dbt language is skipped without a code change. Lineage from SQL embedded in Python
code (`session.sql("select …")`) is not extracted. Edges an earlier run wrote from a bogus parse are
not removed by this rule; with `overrideLineage` they are purged once the model emits a `depends_on`
edge (#37092). Revisit if `dataModel` gains a `language` field, which would let the link derive the
flag from the stored model instead of the manifest node.
