# MySQL deployment and upgrade

OpenMetadata's metadata store requires MySQL 8.4 LTS or later. The bundled database,
development environments, ingestion image client stage, and MySQL test containers use
**MySQL 8.4.13**, an exact patch pin. PostgreSQL deployments are unaffected.
This requirement concerns OpenMetadata's own metadata store; it does not change the
MySQL ingestion connector's support for customer source databases running MySQL 8.0.

## Fresh installations

Use the database image published with the OpenMetadata release containing this change.
For a source build, `docker/mysql/Dockerfile_mysql` builds that image from `mysql:8.4.13`;
the development Compose configuration builds the same Dockerfile. Start with an empty
MySQL data volume, run the release's OpenMetadata database migrations, then start the
server. Verify server health and sign in before enabling ingestion.

For the 2.0 release line, both the OpenMetadata and Collate companion backports must
land and the release images must be rebuilt and published. Merging the main-branch PRs
does not change an already-published 2.0 image. Collate builds its database image from
its OpenMetadata submodule, so that checkout must include the 2.0 backport.

## Existing quickstart or development installations on MySQL 8.0

**Do not start the new database image against your only copy of the old data volume.**
MySQL upgrades its data dictionary when the new server opens the volume. Restarting
MySQL 8.0 against that upgraded volume is not a rollback strategy.

1. Schedule downtime. Stop OpenMetadata and all ingestion writers, but keep the old
   database available while preparing the backup. Record the exact old application
   and database image versions and your Compose configuration.
2. Take a full backup of the metadata database (and `airflow_db` if used), including
   routines, events and triggers. Keep a stopped, consistent copy or snapshot of the
   original MySQL data volume and the matching old images. Restore the backup into
   an isolated environment and verify it before proceeding. Do not use `down -v` or
   delete the original volume.
3. Run MySQL Shell's upgrade checker against the old database with target version
   `8.4.13` and fix every reported incompatibility. Follow MySQL's supported upgrade
   path: upgrade an older 8.0 installation to a supported recent 8.0 patch first
   as required by the target release. Remove options no longer
   supported by 8.4, including `default-authentication-plugin`.
4. Check database accounts before upgrading. MySQL 8.4 disables
   `mysql_native_password` by default; migrate application accounts to
   `caching_sha2_password` using clients that support it. Include the metadata and
   Airflow accounts when present, and test their connections.
5. Rehearse the upgrade on a **copy** of the stopped data volume with the new
   database image. Inspect the database logs, confirm `SELECT VERSION()` reports
   `8.4.13`, and check the backed-up databases and row counts. Run the new release's
   OpenMetadata migrations and verify server startup and representative metadata
   reads and writes. Only then repeat the procedure for the deployment.
6. If validation fails, stop the new stack and restore the untouched backup into a
   separate volume with the recorded old database and application images. Never
   mount the upgraded volume into MySQL 8.0. Keep the backup until validation is
   complete; writes made after the backup require a separate recovery plan.

Managed database services require their provider's upgrade and snapshot procedure;
this change does not automatically upgrade customer-managed databases.

## References

- [MySQL 8.4.13 release notes](https://dev.mysql.com/doc/relnotes/mysql/8.4/en/news-8-4-13.html)
- [Supported MySQL upgrade paths](https://dev.mysql.com/doc/refman/8.4/en/upgrade-paths.html)
- [Preparing an installation for upgrade](https://dev.mysql.com/doc/refman/8.4/en/upgrade-prerequisites.html)
- [Changes in MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/upgrading-from-previous-series.html)
- [MySQL Shell upgrade checker](https://dev.mysql.com/doc/mysql-shell/8.4/en/mysql-shell-utilities-upgrade.html)
- [Downgrading MySQL](https://dev.mysql.com/doc/refman/8.4/en/downgrading.html)
