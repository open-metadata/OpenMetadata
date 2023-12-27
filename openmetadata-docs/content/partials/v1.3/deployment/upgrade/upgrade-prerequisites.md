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

- To run the backup and restore commands, please make sure that you are always in the latest `openmetadata-ingestion` version to have all the improvements shipped in the CLI.
- Also, make sure you have connectivity between your database (MySQL / PostgreSQL) and the host machine where you will be running the below commands.

**1. Create a Virtual Environment and Install the Backup CLI**

```python
python -m venv venv
source venv/bin/activate
pip install openmetadata-ingestion~=1.3.0
```

Validate the installed metadata version with `python -m metadata --version`

**2. Run the Backup**

If using MySQL:

```bash
python -m metadata backup -u openmetadata_user -p openmetadata_password -H mysql -d openmetadata_db --port 3306
```

If using Postgres:

```bash
python -m metadata backup -u openmetadata_user -p openmetadata_password -H postgresql -d openmetadata_db --port 5432 -s public
```

**3. Store the backup file somewhere safe**

The above command will generate a backup file with extension as `.sql`. You can copy the name from the backup command output.

Make sure to store it somewhere safe in case you need to restore the data later.

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

# Deprecation Notice

- Check the updated [docs](/connectors/pipeline/airflow/configuring-lineage#configuring-dag-lineage) on how to configure Airflow DAG's lineage.
  We will deprecate the dictionary annotation in the 1.4 release, since the new annotation allows you to define lineage between
  assets other than Tables.

# Breaking Changes

## 1.3.0

### Secrets Manager

The Secrets Manager `noop` option has been renamed to `db`. You can find this in the config below:

```yaml
secretsManagerConfiguration:
  secretsManager: ${SECRET_MANAGER:-db} # Possible values are "db", "managed-aws", "managed-aws-ssm"
  prefix: ${SECRET_MANAGER_PREFIX:-""} # Define the secret key ID as /<prefix>/<clusterName>/<key>
  tags: ${SECRET_MANAGER_TAGS:-[]} # Add tags to the created resource, e.g., in AWS. Format is `[key1:value1,key2:value2,...]`
```

Either update your YAMLs or the env var you are using under `SECRET_MANAGER`.

Note how we also added the possibility to add `prefix` when defining the secret key ID in the external secrets managers and
the option to tag the created resources.

### Elasticsearch reindex from Python

In 1.2.0 we introduced the Elasticsearch reindex job as part of the OpenMetadata server. In this release, we 
removed triggering ES job from Python workflows. Everything happens in the server now. The image will not ship the `metadata_to_es` DAG anymore.

### Python SDK Auth Mechanisms

We cleaned all the Python SDK code related to any auth system that is not JWT token. Bots deprecated that behavior 2 releases ago
and only supported JWT. This is now reflected in the code.

### Airflow Connection

Removed the `MSSQL` connection option from airflow backend database. This is due to the option being experimental and
will be deprecated by the Airflow team. For more information refer to the [link](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html#choosing-database-backend).

If you are using airflow with `MSSQL` backend, we recommend switching it to the supported backends e.g., `MYSQL` or `POSTGRES`.

This is what has been removed:

```yaml
...
  connection:
    type: Mssql
    username: user
    password: pass
    hostPort: localhost:1433
    database: dev
```

### Custom Connectors

In 1.3.0 we started registered more information from Ingestion Pipelines status' in the platform. This required
us to create new JSON Schemas for the added properties, that before were only used in the Ingestion Framework.

Due to this, we need to update one import and one of its properties' names.

**StackTraceError**
- From `from metadata.ingestion.api.models import StackTraceError` 
- To `from metadata.generated.schema.entity.services.ingestionPipelines.status import StackTraceError`

And we renamed its property `stack_trace` to `stackTrace` to follow the naming conventions in JSON Schemas.

### Other Changes

- ...
