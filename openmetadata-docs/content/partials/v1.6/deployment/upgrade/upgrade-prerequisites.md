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

## 1.5.0

### Multi Owners
OpenMetadata allows a single user or a team to be tagged as owners for any data assets. In Release 1.5.0, we allow users to tag multiple individual owners or a single team. This will allow organizations to add ownership to multiple individuals without necessarily needing to create a team around them like previously.

This is a backward incompatible change, if you are using APIs, please make sure the owner field is now changed to “owners”

### Import/Export Format
To support the multi-owner format, we have now changed how we export and import the CSV file in glossary, services, database, schema, table, etc. The new format will be
user:userName;team:TeamName

If you are importing an older file, please make sure to make this change.

### Pydantic V2
The core of OpenMetadata are the JSON Schemas that define the metadata standard. These schemas are automatically translated into Java, Typescript, and Python code with Pydantic classes.

In this release, we have [migrated](https://docs.pydantic.dev/latest/migration/) the codebase from Pydantic V1 to Pydantic V2.

### Deployment Related Changes (OSS only)

`./bootstrap/bootstrap_storage.sh` **removed**

OpenMetadata community has built rolling upgrades to database schema and the data to make upgrades easier. This tool is now called as ./bootstrap/openmetadata-ops.sh and has been part of our releases since 1.3. The `bootstrap_storage.sh` doesn’t support new native schemas in OpenMetadata. Hence, we have deleted this tool from this release.

While upgrading, please refer to our Upgrade Notes in the documentation. Always follow the best practices provided there.

### Database Connection Pooling

OpenMetadata uses Jdbi to handle database-related operations such as read/write/delete. In this release, we introduced additional configs to help with connection pooling, allowing the efficient use of a database with low resources.

Please update the defaults if your cluster is running at a large scale to scale up the connections efficiently.

For the new configuration, please refer to the [doc](https://docs.open-metadata.org/latest/deployment/database-connection-pooling) here

### Data Insights

The Data Insights application is meant to give you a quick glance at your data's state and allow you to take action based on the information you receive. To continue pursuing this objective, the application was completely refactored to allow customizability.

Part of this refactor was making Data Insights an internal application, no longer relying on an external pipeline. This means triggering Data Insights from the Python SDK will no longer be possible.

With this change you will need to run a backfill on the Data Insights for the last couple of days since the Data Assets data changed.

### UI Changes

#### New Explore Page

Explore page displays hierarchically organized data assets by grouping them into `services > database > schema > tables/stored procedures`. This helps users organically find the data asset they are looking for based on a known database or schema they were using. This is a new feature and changes the way the Explore page was built in previous releases.

#### Connector Schema Changes

In the latest release, several updates and enhancements have been made to the JSON schema across various connectors. These changes aim to improve security, configurability, and expand integration capabilities. Here's a detailed breakdown of the updates:

- **KafkaConnect**: Added `schemaRegistryTopicSuffixName` to enhance topic configuration flexibility for schema registries.
- **GCS Datalake**: Introduced `bucketNames` field, allowing users to specify targeted storage buckets within the Google Cloud Storage environment.
- **OpenLineage**: Added `saslConfig` to enhance security by enabling SASL (Simple Authentication and Security Layer) configuration.
- **Salesforce**: Added sslConfig to strengthen the security layer for Salesforce connections by supporting SSL.
- **DeltaLake**: Updated schema by moving metastoreConnection to a newly created `metastoreConfig.json` file. Additionally, introduced `configSource` to better define source configurations, with new support for `metastoreConfig.json` and `storageConfig.json`.
- **Iceberg RestCatalog**: Removed clientId and `clientSecret` as mandatory fields, making the schema more flexible for different authentication methods.
- **DBT Cloud Pipelines**: Added as a new connector to support cloud-native data transformation workflows using DBT.
- **Looker**: Expanded support to include connections using GitLab integration, offering more flexible and secure version control.
- **Tableau**: Enhanced support by adding capabilities for connecting with `TableauPublishedDatasource` and `TableauEmbeddedDatasource`, providing more granular control over data visualization and reporting.

### Include DDL
During the Database Metadata ingestion, we can optionally pick up the DDL for both tables and views. During the metadata ingestion, we use the view DDLs to generate the View Lineage.

To reduce the processing time for out-of-the-box workflows, we are disabling the include DDL by default, whereas before, it was enabled, which potentially led to long-running workflows.

### Secrets Manager
Starting with the release 1.5.0, the JWT Token for the bots will be sent to the Secrets Manager if you configured one. It won't appear anymore in your dag_generated_configs in Airflow.

### Python SDK
The `metadata insight` command has been removed. Since Data Insights application was moved to be an internal system application instead of relying on external pipelines the SDK command to run the pipeline was removed.
