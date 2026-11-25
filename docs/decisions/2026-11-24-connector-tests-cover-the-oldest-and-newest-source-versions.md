# Connector tests cover the oldest and newest source versions

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `ingestion/tests/unit/test_database_source_image_guard.py`
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/36113

## Context

Connector tests start MySQL and Postgres containers that stand in for a customer's source
database. Each test typed its own version, so coverage of the versions customers run was an
accident of who wrote the test last. When the shipped MySQL moved to 8.4, a sweep replaced every
MySQL tag, and the connector tests lost MySQL 8.0, which the MySQL connector still supports.
Postgres 15 and the newest releases of both engines had the same kind of accidental coverage. A
customer database's version follows what the connectors support, not what OpenMetadata ships as
its own metadata store.

## Decision

- **Constants**: `_openmetadata_testutils.helpers.database_images` holds the oldest and the newest
  version per engine. Connector tests and their shared fixtures call `mysql_source_image()` and
  `postgres_source_image()`, which return the newest. `SOURCE_DATABASE_VERSION=oldest` returns the
  oldest, and an unknown value fails rather than running the newest. `MYSQL_SOURCE_IMAGE` and
  `POSTGRES_SOURCE_IMAGE` name any image for a one-off run.
- **Which run uses which version**: the merge queue runs the newest; the nightly Python
  integration run sets `SOURCE_DATABASE_VERSION=oldest`. Nothing runs twice per merge. The CLI
  E2E v2 workflow is started by hand and does not set the variable, so its suites run the newest
  only until that workflow gains a version input.
- **How versions are chosen**: always the newest patch of a release line. The oldest line is the
  oldest the connectors state as supported, but never one its vendor has stopped patching (so
  Postgres starts at the oldest line the PostgreSQL project still patches). Exception: MySQL keeps
  8.0 while the MySQL connector supports it, even though Oracle stopped patching 8.0 in April
  2026, because customers' source databases still run it. The newest line is the newest that has
  had a patch release; for MySQL that is the LTS line, not an innovation release. Each constant
  pins its tag by digest, so a rebuilt tag cannot change a run.
- **Guard**: scans `ingestion/tests/` and `ingestion/src/_openmetadata_testutils/`. It fails on a
  MySQL or Postgres image tag that is not one of the constants, and on any tag typed in Python code
  other than the helper: a test that typed even an allowed tag would miss the oldest-version run.

## Consequences

Versions are bumped by hand: change the constants, run the guard, change every line it lists. A
failure on the nightly run only is a regression on the oldest supported version. The legacy
nightly MySQL CLI E2E reads from the Compose metadata store, so it follows the shipped store
version, not these constants. Moving to a new newest line can need fixture changes: MySQL 9's
client turns local commands such as `source` off by default, so fixtures that load dumps pass
`--commands`.
