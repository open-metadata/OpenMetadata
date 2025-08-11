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

## Understanding the "Running" State in OpenMetadata

In OpenMetadata, the **"Running"** state indicates that the OpenMetadata server has received a response from Airflow confirming that a workflow is in progress. However, if Airflow unexpectedly stops or crashes before it can send a failure status update through the **Failure Callback**, OpenMetadata remains unaware of the workflow’s actual state. As a result, the workflow may appear to be stuck in **"Running"** even though it is no longer executing.  

This situation can also occur during an OpenMetadata upgrade. If an ingestion pipeline was running at the time of the upgrade and the process caused Airflow to shut down, OpenMetadata would not receive any further updates from Airflow. Consequently, the pipeline status remains **"Running"** indefinitely.

{% image
  src="/images/v1.8/deployment/upgrade/running-state-in-openmetadata.png"
  alt="Running State in OpenMetadata"
  caption="Running State in OpenMetadata" /%}

### Expected Steps to Resolve
To resolve this issue:  
- Ensure that Airflow is restarted properly after an unexpected shutdown.  
- Manually update the pipeline status if necessary.  
- Check Airflow logs to verify if the DAG execution was interrupted.

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

## 1.7.0

### Removing support for Python 3.8

Python 3.8 was [officially EOL on 2024-10-07](https://devguide.python.org/versions/). Some of our dependencies have already
started removing support for higher versions, and are following suit to ensure we are using the latest and most stable
versions of our dependencies.

This means that for Release 1.7, the supported Python versions for the Ingestion Framework are 3.9, 3.10 and 3.11.

We were already shipping our Docker images with Python 3.10, so this change should not affect you if you are using our Docker images.
However, if you installed the `openmetadata-ingestion` package directly, please make sure to update your Python version to 3.9 or higher.

### OpenSearch Settings Update

OpenSearch has a different default value of `max_clause_count` than Elasticsearch. This means that if you are using OpenSearch, 
you will need to update the `max_clause_count` setting in your OpenSearch configuration:

```shell
indices.query.bool.max_clause_count: 4096
```

If you're using AWS, you can add this setting from the console as well

![img.png](/images/v1.8/deployment/upgrade/opensearch-upgrade-170.png)

{% image
src="/images/v1.8/deployment/upgrade/opensearch-upgrade-170.png"
alt="AWS OpenSearch Settings"
caption="AWS OpenSearch Settings" /%}
