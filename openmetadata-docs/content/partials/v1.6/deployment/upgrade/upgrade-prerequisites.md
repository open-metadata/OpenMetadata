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

**During the upgrade, please note that the backup is only for safety and should not be used to restore data to a higher version**.

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

# New Versioning System for Ingestion Docker Image

We are excited to announce a recent change in our version tagging system for our Ingestion Docker images. This update aims to improve consistency and clarity in our versioning, aligning our Docker image tags with our Python PyPi package versions.

### Ingestion Docker Image Tags

To maintain consistency, our Docker images will now follow the same 4-digit versioning system as of Python Package versions. For example, a Docker image version might look like `1.0.0.0`.

Additionally, we will continue to provide a 3-digit version tag (e.g., `1.0.0`) that will always point to the latest corresponding 4-digit image tag. This ensures ease of use for those who prefer a simpler version tag while still having access to the most recent updates.

### Benefits

**Consistency**: Both Python applications and Docker images will have the same versioning format, making it easier to track and manage versions.
**Clarity**: The 4-digit system provides a clear and detailed versioning structure, helping users understand the nature and scope of changes.
**Non-Breaking Change**: This update is designed to be non-disruptive. Existing Ingestions and dependencies will remain unaffected.

#### Example

Here’s an example of how the new versioning works:

**Python Application Version**: `1.5.0.0`
**Docker Image Tags**:
- `1.5.0.0` (specific version)
- `1.5.0` (latest version in the 1.5.0.x series)

We believe this update will bring greater consistency and clarity to our versioning system. As always, we value your feedback and welcome any questions or comments you may have.

# Backward Incompatible Changes

## 1.6.0

### Ingestion Workflow Status

We are updating how we compute the success percentage. Previously, we took into account for partial success the results
of the Source (e.g., the tables we were able to properly retrieve from Snowflake, Redshift, etc.). This means that we had 
an error threshold in there were if up to 90% of the tables were successfully ingested, we would still consider the
workflow as successful. However, any errors when sending the information to OpenMetadata would be considered as a failure.

Now, we're changing this behavior to consider the success rate of all the steps involved in the workflow. The UI will
then show more `Partial Success` statuses rather than `Failed`, properly reflecting the real state of the workflow.

### Profiler & Auto Classification Workflow

We are creating a new `Auto Classification` workflow that will take care of managing the sample data and PII classification,
which was previously done by the Profiler workflow. This change will allow us to have a more modular and scalable system.

The Profiler workflow will now only focus on the profiling part of the data, while the Auto Classification will take care
of the rest.

This means that we are removing these properties from the `DatabaseServiceProfilerPipeline` schema:
- `generateSampleData`
- `processPiiSensitive`
- `confidence`
which will be moved to the new `DatabaseServiceAutoClassificationPipeline` schema.

What you will need to do:
- If you are using the **EXTERNAL** ingestion for the profiler (YAML configuration), you will need to update your configuration,
removing these properties as well.
- If you still want to use the Auto PII Classification and sampling features, you can create the new workflow
from the UI.
