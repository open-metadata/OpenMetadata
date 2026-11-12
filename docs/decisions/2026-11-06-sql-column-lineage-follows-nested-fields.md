# SQL column lineage follows nested fields, and resolves a field path only where it is unambiguous

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
  name, at every depth — but only when the query's final SELECT copies that very source column
  unchanged (`LineageParser.copied_columns`, read with sqlglot): a reference built only from
  names (`customer`, `t.customer AS c`, `struct.field AS f`), a plain `*` (not one with EXCEPT,
  REPLACE, EXCLUDE or RENAME, and not for a name another item produces), or every branch of a set
  operation doing so. Anything else keeps only its column edge: an expression (`STRUCT(billing AS
  address)`, a function, a subscript, a CASE), a column read from a subquery or CTE, which may
  have built it, and an output name two items share. The parser reports all of these exactly
  like a plain reference, so matching their fields by name would guess.
- A field path is resolved only when nothing else could own its name: the query reads exactly
  one source and it is a table (a table-valued function or a stage may read several), has no
  intermediate table and no subquery or CTE — including one built only from constants, which no
  column lineage runs through — and that table has exactly
  one STRUCT of that name at any depth (the parse keeps only the segment above the field, so
  `address.zip` and `customer.address.zip` look alike). Otherwise the dropped qualifier leaves
  no way to tell which column the path reads, and lineage from the wrong one would propagate
  tags onto the wrong columns; such paths get no lineage. Lineage does not guess.
- This is the default for every connector, with no setting: it adds edges the SQL already implies
  and changes none that existed.

## Consequences
Lineage, and the propagation that follows it, reaches nested fields for any connector that
ingests them. A lineage run adds one edge per shared nested field, so wide STRUCTs add many.

Still without field-level lineage: field paths in joins, over subqueries or CTEs, or through
UNNEST-based array access; the fields of a STRUCT built by an expression (placing its sources
inside it, such as `billing.email → customer.address.email`, needs expression-level analysis);
and nested fields in multi-statement queries, MERGE and UPDATE statements, and INSERT or CREATE
statements with a target column list. Resolving field paths needs the parser to keep a
path's qualifier, which would be the point to revisit these conditions.
