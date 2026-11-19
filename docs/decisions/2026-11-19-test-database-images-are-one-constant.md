# Test database images are one constant per language

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `TestDatabaseImageGuardTest` (openmetadata-service)
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/36113; ADR:2026-11-19-shipped-mysql-uses-the-8-4-lts-line

## Context

The MySQL and Postgres versions tests ran on were typed in dozens of places and drifted: some
tests ran Postgres 16 while deployments ship 15. A test that passes on a database we do not ship
proves nothing about the one we do.

## Decision

One Java class and one Python module hold the test database images:

- `org.openmetadata.service.util.TestDatabaseImages` (`MYSQL`, `POSTGRES`; `mysql()` and
  `postgres()`), in the openmetadata-service test jar. Collate's tests call it too.
- `_openmetadata_testutils.helpers.database_images` (`MYSQL_IMAGE`, `POSTGRES_IMAGE`;
  `mysql_image()` and `postgres_image()`).

Both equal the images OpenMetadata ships. The functions return the `MYSQL_IMAGE` or
`POSTGRES_IMAGE` environment variable when it is set, for a one-off run.

Every other MySQL or Postgres image tag in the repository (shipped Dockerfiles, Compose files,
scripts, the Makefile) is a plain literal that must equal these constants. The guard fails on any
that differs and lists each line. Applied migrations and recorded run outputs keep the versions
they name, as history; prose is not scanned.

## Consequences

Versions are bumped by hand, as Spring Boot, Trino and Quarkus do: change the constants, run the
guard, and change every line it lists. Nothing reads a Dockerfile at test time, so the constants
also work from an installed package or a test jar outside a checkout.
