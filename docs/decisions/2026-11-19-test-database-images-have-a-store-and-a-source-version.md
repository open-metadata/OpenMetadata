# Test database images have a store version and a source version

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `TestDatabaseImageGuardTest` (openmetadata-service) for the store;
  `ingestion/tests/unit/test_database_source_image_guard.py` for the source
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/36113; ADR:2026-11-19-shipped-mysql-uses-the-8-4-lts-line

## Context

The MySQL and Postgres versions tests ran on were typed in dozens of places and drifted. A test
database plays one of two roles, and each needs a different version:

- **Metadata store**: OpenMetadata's own database. A server or migration test that passes on a
  version we do not ship proves nothing about the one we do.
- **Connector source**: a customer database a connector reads. Its version follows what the
  connectors support, not what we ship.

## Decision

Each role has one constant per engine.

- **Store**: `org.openmetadata.service.util.TestDatabaseImages` (`MYSQL`, `POSTGRES`; `mysql()`
  and `postgres()`, overridden by the `MYSQL_IMAGE` and `POSTGRES_IMAGE` environment variables),
  in the openmetadata-service test jar. They equal the images we ship in
  `docker/mysql/Dockerfile_mysql` and `docker/postgresql/Dockerfile_postgres`. Server, migration
  and integration tests, the shipped Dockerfiles, the `mysqldump` stage of the ingestion images,
  Compose files and scripts use them.
- **Source**: `_openmetadata_testutils.helpers.database_images` (`MYSQL_SOURCE_IMAGE`,
  `POSTGRES_SOURCE_IMAGE`; `mysql_source_image()` and `postgres_source_image()`, overridden by
  the `MYSQL_SOURCE_IMAGE` and `POSTGRES_SOURCE_IMAGE` environment variables). One version per
  engine, the newest the connectors support. Connector tests are Python, so there is no Java
  source constant.

Each guard finds its role by path. The source guard scans `ingestion/tests/`,
`ingestion/src/_openmetadata_testutils/` and `examples/`; the store guard scans the rest of the
repository. Each fails on a MySQL or Postgres image tag that differs from its constants and lists
each line. Other products (MariaDB, TimescaleDB) and connection strings do not match. Applied
migrations and recorded run outputs keep the versions they name, as history; prose is not scanned.

## Consequences

Versions are bumped by hand: change the constants, run the guard, and change every line it lists.
A store bump follows a change to what we ship; a source bump follows a new supported version and
does not move the store. Nothing reads a Dockerfile at test time, so the constants also work from
an installed package or a test jar outside a checkout.
