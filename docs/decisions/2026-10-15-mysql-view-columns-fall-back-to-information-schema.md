# MySQL reads view columns from information_schema only when DESCRIBE is denied

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `ingestion/tests/integration/mysql/test_view_columns_without_select.py`
- **Related:** #35581; `describe_or_read_view_columns` in `ingestion/src/metadata/ingestion/source/database/mysql/utils.py`

## Context

SQLAlchemy reflects a MySQL view in two steps. `SHOW CREATE TABLE` returns its definition, and
`DESCRIBE` returns its columns. `SHOW CREATE TABLE` needs only `SHOW VIEW`. MySQL rejects
`DESCRIBE` with error 1142 when the user's privileges on the view come from a database-level grant
without `SELECT`. The connector then dropped the whole view, definition included.

Administrators who keep table data private withhold `SELECT`. `information_schema.COLUMNS` lists a
view's columns to any user that holds a column privilege on it, and `REFERENCES` is such a
privilege that grants no access to rows. `information_schema.VIEWS` does not help, because its
`VIEW_DEFINITION` is empty unless the user holds both `SELECT` and `SHOW VIEW`. MySQL 8.0, MySQL
8.4, and MariaDB 11.4 all behave this way.

## Decision

- `describe_or_read_view_columns` replaces `MySQLDialect._describe_table`. It runs `DESCRIBE`
  first. It reads the view's columns from `information_schema.COLUMNS` only when MySQL answers
  error 1142. Every other error propagates unchanged.
- `MYSQL_GET_VIEW_COLUMNS` selects the columns in `DESCRIBE` order, because SQLAlchemy reads those
  rows by position.
- The MySQL and MariaDB connectors both install the wrapper, because they share the dialect class.
- The connector docs give `GRANT SHOW VIEW, REFERENCES ON <db>.*` as the grant for metadata without
  data access. `SHOW VIEW` stays mandatory, because nothing else exposes a view's definition.

## Consequences

- A user without `SELECT` ingests views with their definitions and columns. A user with only
  `SHOW VIEW` ingests views without columns, and the connector logs one warning for each view.
- Users who have `SELECT` keep the `DESCRIBE` path, so their columns do not change. Reading
  `information_schema` for every view would also serve the documented grant, but it would change
  the column source for those users.
- Doris and SingleStore reuse `mysql/utils.py` without the wrapper, so their views still need
  `SELECT`.
- Revisit if SQLAlchemy stops reflecting view columns through `_describe_table`, or if MySQL
  allows `DESCRIBE` under a database-level `REFERENCES` grant.
