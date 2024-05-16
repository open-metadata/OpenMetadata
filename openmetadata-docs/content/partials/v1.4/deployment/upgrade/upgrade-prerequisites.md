# Prerequisites

Everytime that you plan on upgrading OpenMetadata to a newer version, make sure to go over all these steps:

### Backup your Metadata

Before upgrading your OpenMetadata version we strongly recommend backing up the metadata.

The source of truth is stored in the underlying database (MySQL and Postgres supported). During each version upgrade there
is a database migration process that needs to run. It will directly attack your database and update the shape of the
data to the newest OpenMetadata release.

It is important that we backup the data because if we face any unexpected issues during the upgrade process, 
you will be able to get back to the previous version without any loss.

{% note %}

You can learn more about how the migration process works [here](/deployment/upgrade/how-does-it-work).

{% /note %}

Since version 1.4.0, **OpenMetadata encourages using the builtin-tools for creating logical backups of the metadata**:

- [mysqldump](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html) for MySQL
- [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) for Postgres

For PROD deployment we recommend users to rely on cloud services for their databases, be it [AWS RDS](https://docs.aws.amazon.com/rds/),
[Azure SQL](https://azure.microsoft.com/en-in/products/azure-sql/database) or [GCP Cloud SQL](https://cloud.google.com/sql/).

If you're a user of these services, you can leverage their backup capabilities directly:
- [Creating a DB snapshot in AWS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateSnapshot.html)
- [Backup and restore in Azure MySQL](https://learn.microsoft.com/en-us/azure/mysql/single-server/concepts-backup)
- [About GCP Cloud SQL backup](https://cloud.google.com/sql/docs/mysql/backup-recovery/backups)

You can refer to the following guide to get more details about the backup and restore:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="luggage"
    bold="Backup Metadata"
    href="/deployment/backup-restore-metadata" %}
      Learn how to back up MySQL or Postgres data.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

### Update `sort_buffer_size` (MySQL) or `work_mem` (Postgres)

Before running the migrations, it is important to update these parameters to ensure there are no runtime errors.
A safe value would be setting them to 20MB.

**If using MySQL**

You can update it via SQL (note that it will reset after the server restarts):

```sql
SET GLOBAL sort_buffer_size = 20971520
```

To make the configuration persistent, you'd need to navigate to your MySQL Server install directory and update the
`my.ini` or `my.cnf` [files](https://dev.mysql.com/doc/refman/8.0/en/option-files.html) with `sort_buffer_size = 20971520`.

If using RDS, you will need to update your instance's [Parameter Group](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithParamGroups.html)
to include the above change.

**If using Postgres**

You can update it via SQL (not that it will reset after the server restarts):

```sql
SET work_mem = '20MB';
```

To make the configuration persistent, you'll need to update the `postgresql.conf` [file](https://www.postgresql.org/docs/9.3/config-setting.html)
with `work_mem = 20MB`.

If using RDS, you will need to update your instance's [Parameter Group](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithParamGroups.html)
to include the above change.

Note that this value would depend on the size of your `query_entity` table. If you still see `Out of Sort Memory Error`s
during the migration after bumping this value, you can increase them further.

After the migration is finished, you can revert this changes.

# Backward Incompatible Changes

## 1.4.0

### Tooling

- **Metadata Docker CLI**: For the past releases, we have been updating the documentation to point users to directly run the docker quickstart
  with the docker compose files in the release page ([docs](quick-start/local-docker-deployment)). In this release, we're completely removing the support for `metadata docker`.
- **Metadata Backup & Restore**: On the `metadata` CLI, we are deprecating the `backup` and `restore` commands, since users can now completely
  rely on native database tools both for MySQL and PostgreSQL. Check the [docs](/deployment/backup-restore-metadata)
  for more information
- **bootstrap_storage.sh**: `bootstrap/bootstrap_storage.sh` now deprecated in favor of `bootstrap/openmetadata-ops.sh`, please refer to help docs of the new tool for any changes.

### UI

- **Activity Feed**: Activity is Improved, new Update specific cards will be showing critical information such as data quality test case updates, description, tag update or removal
- **Lineage**: The `Expand All` button is removed. Instead, the new `Layers` button has been introduced to the bottom left corner. 
  Please use Layers to add Column Level Lineage or Data Observability details to your Lineage view.
- **View Definition**: View Definition is now renamed to Schema Definition
- **Glossary**: Adding a Glossary Term view has improved. Now, we show glossary terms hierarchically,
  enabling a better understanding how the terms are set up while adding it to a table or dashboard.
- **Classifications**: Users can set a classification to be mutually exclusive **only** at the creation time. 
  Once created, you cannot change it back to non-mutually exclusive or vice-versa. 
  This is to prevent conflicts of adding multiple tags that belong to same classification and later turning the mutually exclusive flag back to true.

### API

- **View Definition**: Table Schema's `ViewDefinition` is now renamed to `SchemaDefinition` to capture Tables' Create Schema.
- **Bulk Import**: Bulk Import API now creates entities if they are not present during the import.
- **Test Suites**: Table's `TestSuite` is migrated to an `EntityReference`. Previously it used to store entire payload of `TestSuite`.
