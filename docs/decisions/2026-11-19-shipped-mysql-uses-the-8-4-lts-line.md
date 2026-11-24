# Ship and test MySQL 8.4 LTS without changing source connector support

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** reviewer; MySQL integration lanes and SQL migration tests
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/36113; https://github.com/open-metadata/OpenMetadata/pull/36416

## Context

The shipped MySQL 8.0 database has reached end of life. Older test containers and
floating image tags allow the database we test, scan and ship to diverge. The metadata
store and a customer's MySQL ingestion source are separate compatibility contracts.

## Decision

OpenMetadata's metadata store requires MySQL 8.4 LTS or later. The bundled database,
development Compose services, ingestion image client stage, test containers and Snyk
base-image target use the same exact 8.4 patch, initially 8.4.13. Future security patch
bumps update these pins together, including Collate's test images.

The MySQL ingestion connector continues to support MySQL 8.0 sources. Its
`SHOW_ROUTINE` privilege note retains the correct introduction version, 8.0.20.
Updating test images does not remove source-connector support.

Apply the shipped-image change to the 2.0 release branch as well as main. Release
images must be rebuilt; downstream Collate builds must consume the corresponding
OpenMetadata change. PostgreSQL and automatic upgrades of customer-managed databases
are outside this decision.

## Consequences

Deployments no longer receive a MySQL 8.0 base image. Exact pins make the tested and
scanned version reproducible, but require subsequent security patch updates.
An existing 8.0 data volume needs an upgrade rehearsal and a restorable backup:
MySQL 8.4's data dictionary cannot be rolled back by restarting the old image.
The procedure is in [MySQL deployment and upgrade](../mysql-deployment.md).
