# Doris connects through PyMySQL, and the operator images ship no MariaDB client

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** ulixius9
- **Guard:** `test_doris_engine_does_not_need_mysqlclient` (`ingestion/tests/unit/source/database/doris/test_connection.py`); the `mariadb_left` purge check in `ingestion/operators/docker/Dockerfile{,.ci}`
- **Related:** (this PR)

## Context
pydoris 1.2.0, the Doris SQLAlchemy dialect, extends SQLAlchemy's `MySQLDialect_mysqldb` and
hard-requires `mysqlclient`. That C extension links Debian's `libmariadb3`, which depends on
`mariadb-common`. Debian files every MariaDB *server* CVE against both, so the trixie operator and
runner images carried 26 High/Critical findings for a server they do not contain. Doris was the
only runtime user of `MySQLdb`: MySQL, MariaDB, SingleStore and StarRocks already use
`mysql+pymysql`. The pure-Python alternatives were rejected after diffing 30 Doris column types:
`doris-alchemy` 0.2.14 raises on `array<…>`, which fails the whole table, and overwrites
`MySQLDialect.colspecs` for every MySQL-family dialect when imported. Both it and
`sqlalchemy-doris` 0.2.2 parse `variant`, `ipv4` and `ipv6` as `NullType`. `sqlalchemy-doris` has
had no release since April 2024.

## Decision
`doris://` resolves to `DorisPyMySQLDialect` (`pydoris`'s `DorisDialect` on
`MySQLDialect_pymysql`), registered when `metadata.ingestion.source.database.doris.connection` is
imported. Every Doris engine is built there. The operator images uninstall `mysqlclient` after the
pip installs and purge every `src:mariadb` package; the build fails if one survives. The dialect
name stays `pydoris`, which `Dialects.Doris` keys on.

## Consequences
`pip check` in the operator image reports `pydoris` as missing `mysqlclient`; that is expected. A
Doris `connectionArguments` entry only `mysqlclient` understands now fails. Anything that needs
`MySQLdb` at runtime must not go into the operator image. The Airflow image keeps `mysqlclient`
because Airflow's metadata database defaults to `mysql+mysqldb`. Revisit if `pydoris` drops the
hard `mysqlclient` requirement (the registration becomes redundant) or a maintained pure-Python
dialect matches its type coverage.
