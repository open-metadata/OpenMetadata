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
  src="/images/v1.6/deployment/upgrade/running-state-in-openmetadata.png"
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

## 1.6.4

### Airflow 2.9.3

We are upgrading the Ingestion Airflow version to 2.9.3.

The upgrade from the existing 2.9.1 -> 2.9.3 should happen transparently. The only thing to note is that there's
an ongoing issue with Airflow migrations and the `pymysql` driver, which we used before. If you are specifying
on your end the `DB_SCHEME` environment variable in the ingestion image, make sure it now is set to `mysql+mysqldb`.

We have updated the default values accordingly.

## 1.6.2

### Executable Logical Test Suites

We are introducing a new feature that allows users to execute logical test suites. This feature will allow users to run
groups of Data Quality tests, even if they belong to different tables (or even services!). Note that before, you could
only schedule and execute the tests for each of the tables.

From the UI, you can now create a new Test Suite, add any tests you want and create and schedule the run.

This change, however, requires some adjustments if you are directly interacting with the OpenMetadata API or if you
are running the ingestions externally:

#### `/executable` endpoints Changes

CRUD operations around "executable" Test Suites - the ones directly related to a single table - were managed by the
`/executable` endpoints, e.g., `POST /v1/dataQuality/testSuites/executable`. We'll keep this endpoints until the next release,
but users should update their operations to use the new `/base` endpoints, e.g., `POST /v1/dataQuality/testSuites/base`.

This is to adjust the naming convention since all Test Suites are executable, so we're differentiating between "base" and
"logical" Test Suites.

In the meantime, you can use the `/executable` endpoints to create and manage the Test Suites, but you'll get deprecation
headers in the response. We recommend migrating to the new endpoints as soon as possible to avoid any issues when the `/executable`
endpoints get completely removed.

#### YAML Changes

If you're running the DQ Workflows externally AND YOU ARE NOT STORING THE SERVICE INFORMATION IN OPENMETADATA, this is how they'll change:

A YAML file for 1.5.x would look like this:

```yaml
source:
  type: testsuite
  serviceName: red # Test Suite Name 
  serviceConnection:
    config:
      hostPort: <host> 
      username: <user>
      password: <password>
      database: <database>
      type: Redshift
  sourceConfig:
    config:
      type: TestSuite
      entityFullyQualifiedName: red.dev.dbt_jaffle.customers
      profileSampleType: PERCENTAGE
processor:
  type: "orm-test-runner"
  config: {}
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "..."
```

Basically, if you are not storing the service connection in OpenMetadata, you could leverage the `source.serviceConnection`
entry to pass that information.

However, with the ability to execute Logical Test Suites, you can now have multiple tests from different services! This means,
that the connection information needs to be placed differently. The new YAML file would look like this:

```yaml
source:
  type: testsuite
  serviceName: Logical # Test Suite Name 
  sourceConfig:
    config:
      type: TestSuite
      serviceConnections:
      - serviceName: red
        serviceConnection:
          config:
            hostPort: <host>
            username: <user>
            password: <password>
            database: <database>
            type: Redshift
      - serviceName: snowflake
        serviceConnection:
          config:
            hostPort: <host>
            username: <user>
            password: <password>
            database: <database>
            type: Snowflake
processor:
  type: "orm-test-runner"
  config: {}
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "..."
```

As you can see, you can pass multiple `serviceConnections` to the `sourceConfig` entry, each one with the connection information
and the `serviceName` they are linked to.

{% note noteType="Warning" %}

If you are already storing the service connection information in OpenMetadata (e.g., because you have created the services via the UI),
there's nothing you need to do. The ingestion will automatically pick up the connection information from the service.

{% /note %}

## 1.6.0

### Ingestion Workflow Status

We are updating how we compute the success percentage. Previously, we took into account for partial success the results
of the Source (e.g., the tables we were able to properly retrieve from Snowflake, Redshift, etc.). This means that we had 
an error threshold in there were if up to 90% of the tables were successfully ingested, we would still consider the
workflow as successful. However, any errors when sending the information to OpenMetadata would be considered as a failure.

Now, we're changing this behavior to consider the success rate of all the steps involved in the workflow. The UI will
then show more `Partial Success` statuses rather than `Failed`, properly reflecting the real state of the workflow.

### Database Metadata & Lineage Workflow

With 1.6 Release we are moving the `View Lineage` & `Stored Procedure Lineage` computation from metadata workflow to lineage workflow.

This means that we are removing the `overrideViewLineage` property from the `DatabaseServiceMetadataPipeline` schema which will be moved to the `DatabaseServiceQueryLineagePipeline` schema.

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

### RBAC Policy Updates for `EditTags`

We have given more granularity to the `EditTags` policy. Previously, it was a single policy that allowed the user to manage
any kind of tagging to the assets, including adding tags, glossary terms, and Tiers. 

Now, we have split this policy to give further control on which kind of tagging the user can manage. The `EditTags` policy has been
split into:

- `EditTags`: to add tags.
- `EditGlossaryTerms`: to add Glossary Terms.
- `EditTier`: to add Tier tags.

### Collate - Metadata Actions for ML Tagging - Deprecation Notice

Since we are introducing the `Auto Classification` workflow, **we are going to remove in 1.7 the `ML Tagging` action**
from the Metadata Actions. That feature will be covered already by the `Auto Classification` workflow, which even brings
more flexibility allow the on-the-fly usage of the sample data for classification purposes without having to store
it in the database.

### Service Spec for the Ingestion Framework

This impacts users who maintain their own connectors for the ingestion framework that are **NOT** part of the
[OpenMetadata python library (openmetadata-ingestion)](https://github.com/open-metadata/OpenMetadata/tree/ff261fb3738f3a56af1c31f7151af9eca7a602d5/ingestion/src/metadata/ingestion/source).
Introducing the ["connector specifcication class (`ServiceSpec`)"](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/utils/service_spec/service_spec.py). 
The `ServiceSpec` class serves as the entrypoint for the connector and holds the references for the classes that will be used
to ingest and process the metadata from the source.
You can see [postgres](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/source/database/postgres/service_spec.py) for an
implementation example.


### Fivetran

The filtering of Fivetran pipelines now supports using their names instead of IDs. This change may affect existing configurations that rely on pipeline IDs for filtering.

### DBT Cloud Pipeline Service

We are removing the field `jobId` which we required to ingest dbt metadata from a specific job, instead of this we added a new field called `jobIds` which will accept multiple job ids to ingest metadata from multiple jobs.

### MicroStrategy

The `serviceType` for MicroStrategy connector is renamed from `Mstr` to `MicroStrategy`.

