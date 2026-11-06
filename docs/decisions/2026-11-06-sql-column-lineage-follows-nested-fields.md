# SQL column lineage follows nested fields, and resolves a field path only in a single-table query

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** ingestion maintainers
- **Guard:** `ingestion/tests/unit/lineage/test_nested_column_lineage.py`
- **Related:** `ingestion/src/metadata/ingestion/lineage/sql_lineage.py`

## Context
Query and view lineage matched source and target columns against the top-level columns of a
table only. A STRUCT or ARRAY<STRUCT> selected as-is produced one edge for the parent column and
none for its fields, so anything that follows column lineage field by field — tag and description
propagation — stopped at the parent. A field path (`customer.email`, `customer.*`) produced no
edge at all: every dialect's parse reads the head of the path as a table name, and drops whatever
qualified it (`u.customer.email` arrives as column `email` of a table `customer`).

## Decision
- A column edge whose two ends both have nested fields carries one edge per field they share by
  name, at every depth.
- A field path is resolved against the STRUCT it names — a top-level column first, else the only
  nested STRUCT of that name — and only when the query reads exactly one source table. In a query
  over several tables the dropped qualifier leaves no way to tell whose STRUCT it is, and lineage
  from the wrong table would propagate tags onto the wrong columns; those paths get no lineage.
- This is the default for every connector, with no setting: it adds edges the SQL already implies
  and changes none that existed.

## Consequences
Lineage, and the propagation that follows it, reaches nested fields for any connector that
ingests them. A lineage run adds one edge per shared nested field, so wide STRUCTs add many.
Field paths in joins and UNNEST-based array access still produce no field-level lineage; resolving
them needs the parser to keep the path's qualifier, which would be the point to revisit the
single-table rule.
