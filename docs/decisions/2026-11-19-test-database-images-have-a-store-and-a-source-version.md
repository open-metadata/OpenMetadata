# Test database images have a store and a source version

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `TestDatabaseImageGuardTest` (openmetadata-service)
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/36113; ADR:2026-11-19-shipped-mysql-uses-the-8-4-lts-line

## Context

The MySQL and Postgres versions tests ran on were typed in dozens of places and drifted. Nothing
said which role a test database plays, so a version bump for one role also moved the other. A
test database plays one of two roles:

- **Metadata store**: OpenMetadata's own database. A server or migration test that passes on a
  version we do not ship proves nothing about the one we do. Operators may also run the store on
  their own database, such as Amazon RDS for MySQL 8.0.
- **Connector source**: a customer database a connector reads. Its versions follow what the
  connectors support, not what we ship.

## Decision

- **Store versions**: `org.openmetadata.service.util.TestDatabaseImages`, in the openmetadata-service
  test jar. `MYSQL` and `POSTGRES` equal the images we ship (`docker/mysql/Dockerfile_mysql`,
  `docker/postgresql/Dockerfile_postgres`). `MYSQL_OLDEST_SUPPORTED` is the oldest MySQL an
  operator may run the store on; the Postgres we ship is already the oldest supported release
  line. Server, migration and integration tests call `mysql()` and `postgres()`; the shipped
  Dockerfiles, the `mysqldump` stage of the ingestion images, Compose files and scripts use the
  shipped literals.
- **Which run uses which version**: the merge queue runs the shipped versions. The nightly Java
  integration run sets `STORE_DATABASE_VERSION=oldest`, which switches `mysql()` to the oldest.
- **Source versions are not the store's**: connector tests and their shared fixtures
  (`ingestion/tests/`, `ingestion/src/_openmetadata_testutils/`) keep their own versions. Which
  versions they cover is a connector decision.
- **Guard**: `TestDatabaseImageGuardTest` scans the repository except the connector source paths
  and `examples/`. It fails on a MySQL or Postgres image tag that is not a store constant, and on
  any tag typed in Java code other than `TestDatabaseImages`: a test that typed even the shipped
  tag would miss the oldest-version run. SDK examples are tutorials whose data lives in a volume
  across runs, so they keep their own image. Applied migrations and recorded run outputs keep the
  versions they name, as history; prose is not scanned.

## Consequences

Store versions are bumped by hand: change the constants, run the guard, change every line it
lists. A store bump follows a change to what we ship and does not move connector tests. A failure
on the nightly run only is a regression on the oldest supported MySQL. The legacy nightly MySQL CLI
E2E reads from the Compose metadata store, so it covers the shipped store version, not a source
version. Nothing reads a Dockerfile at test time, so the constants also work from a test jar
outside a checkout.
