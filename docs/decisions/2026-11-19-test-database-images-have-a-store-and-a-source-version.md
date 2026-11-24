# Test database images have a store and a source version

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `TestDatabaseImageGuardTest` (openmetadata-service) for the store;
  `ingestion/tests/unit/test_database_source_image_guard.py` for the source
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/36113; ADR:2026-11-19-shipped-mysql-uses-the-8-4-lts-line

## Context

The MySQL and Postgres versions tests ran on were typed in dozens of places and drifted. Nothing
said which role a test database played, so a version bump for one role also moved the other. A
test database plays one of two roles:

- **Metadata store**: OpenMetadata's own database. A server or migration test that passes on a
  version we do not ship proves nothing about the one we do. Operators may also run the store on
  their own database, such as Amazon RDS for MySQL 8.0.
- **Connector source**: a customer database a connector reads. Customers run every version the
  connectors support, so one version cannot stand for the range.

## Decision

- **Store**: `org.openmetadata.service.util.TestDatabaseImages`, in the openmetadata-service test
  jar. `MYSQL` and `POSTGRES` equal the images we ship (`docker/mysql/Dockerfile_mysql`,
  `docker/postgresql/Dockerfile_postgres`). `MYSQL_OLDEST_SUPPORTED` is the oldest MySQL an
  operator may run the store on; the Postgres we ship is already the oldest supported release
  line. Server, migration and integration tests call `mysql()` and `postgres()`; the shipped
  Dockerfiles, the `mysqldump` stage of the ingestion images, Compose files and scripts use the
  shipped literals. `STORE_DATABASE_VERSION=oldest` switches `mysql()` to the oldest version.
- **Source**: `_openmetadata_testutils.helpers.database_images`. Each engine has the oldest and the
  newest version the connectors support. Connector tests call `mysql_source_image()` and
  `postgres_source_image()`, which return the newest; `SOURCE_DATABASE_VERSION=oldest` returns the
  oldest. Connector tests are Python, so there is no Java source constant.
- **Which run uses which version**: the merge queue runs the shipped store and the newest sources.
  The nightly runs the Java integration tests on the oldest MySQL store and the Python integration
  tests on the oldest sources. Nothing runs twice per merge.
- **How versions are chosen**: always the newest patch of a release line. The oldest line is the
  oldest we state as supported, but never one its vendor has stopped patching before we did (so
  Postgres starts at the oldest line the PostgreSQL project still patches). The newest line is
  the newest that has had a patch release; for MySQL that is the LTS line, not an innovation
  release.
- **Guards**: each finds its role by path. The source guard scans `ingestion/tests/` and
  `ingestion/src/_openmetadata_testutils/`; the store guard scans the rest of the repository except
  `examples/`. Each fails on a MySQL or Postgres image tag that is not one of its constants, and
  on any tag in Java or Python code other than the helper itself: a test that typed even an
  allowed tag would miss the oldest-version run. Each lists the line. SDK examples are tutorials
  whose data lives in a volume across runs, so they keep their own image. Applied migrations and
  recorded run outputs keep the versions they name, as history; prose is not scanned.

## Consequences

Versions are bumped by hand: change the constants, run the guard, change every line it lists. A
store bump follows a change to what we ship; a source bump follows a new connector-supported
version and does not move the store. A failure on the nightly run only is a version-specific
regression. The legacy nightly MySQL CLI E2E reads from the Compose metadata store, so it covers
the shipped store version, not a source version. Nothing reads a Dockerfile at test time, so the
constants also work from an installed package or a test jar outside a checkout.
