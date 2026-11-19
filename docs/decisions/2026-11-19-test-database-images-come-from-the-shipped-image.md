# Test database images come from the shipped database Dockerfiles

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `TestDatabaseImageGuardTest` (openmetadata-service); `TestDatabaseImagesTest`; ingestion `tests/unit/test_database_images.py`; ruff `banned-api`
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/36113; ADR:2026-11-19-shipped-mysql-uses-the-8-4-lts-line

## Context

The MySQL and Postgres versions tests ran on were typed in dozens of places: Java test
classes, Maven profiles, Python fixtures, Compose files and CI scripts. They drifted. Some tests
ran Postgres 16 while deployments ship 15, and some ran MySQL 8.3 after the shipped image moved
to 8.4. A test that passes on a database we do not ship proves nothing about the one we do, and
each version bump had to find every copy by hand.

## Decision

The `FROM` line of `docker/mysql/Dockerfile_mysql` and of `docker/postgresql/Dockerfile_postgres`
is the only place a MySQL or Postgres image is named. Everything else reads it:

- Java tests call `org.openmetadata.service.util.TestDatabaseImages.mysql()` or `.postgres()`.
  The openmetadata-service build copies both Dockerfiles into its test jar under
  `test-database-images/`, so any module that depends on that test jar reads the same images.
- Ingestion tests use `mysql_image()` and `postgres_image()` from
  `_openmetadata_testutils.helpers.database_images`, which reads the Dockerfiles from the checkout.
  Ruff bans importing `MySqlContainer` and `PostgresContainer` from anywhere else; a container for
  another engine (MariaDB, TimescaleDB) states that reason in its `noqa`.
- Compose files build from the shipped Dockerfile, or take the image from a variable their launcher
  reads from it. Shell scripts and the Makefile read the `FROM` line.
- `MYSQL_IMAGE` and `POSTGRES_IMAGE` replace the image for a one-off run; the integration-test
  bootstrap still honours `-DdatabaseImage`. No committed file sets them.

The `mysqldump` stage of `ingestion/Dockerfile` and `ingestion/Dockerfile.ci` cannot read another
file, so it stays a literal that must equal the shipped MySQL image. Dependabot bumps the shipped
Dockerfiles and that stage together in one `database-images` group: MySQL patch releases within
8.4, and never a Postgres major, which is an upgrade decision for deployments.

## Consequences

A version bump is one Dependabot PR, and every test, script and Compose file follows it.
A test that needs a feature the shipped database lacks fails, which is the point: it found a
difference between what is tested and what ships. Running against another version is a local,
explicit override. Applied migrations and recorded run outputs under `docs/artifacts/` keep the
versions they name, as history; prose documentation is not scanned.
