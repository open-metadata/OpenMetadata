# Post-Upgrade Steps

### Reindex

{% partial file="/v1.4/deployment/reindex.md" /%}

Since this is required after the upgrade, we want to reindex `All` the entities.

### (Optional) Update your OpenMetadata Ingestion Client

If you are running the ingestion workflows **externally** or using a custom Airflow installation, you need to make sure that the Python Client you use is aligned
with the OpenMetadata server version.

For example, if you are upgrading the server to the version `x.y.z`, you will need to update your client with

```bash
pip install openmetadata-ingestion[<plugin>]==x.y.z
```

The `plugin` parameter is a list of the sources that we want to ingest. An example would look like this `openmetadata-ingestion[mysql,snowflake,s3]==1.2.0`.
You will find specific instructions for each connector [here](/connectors).

Moreover, if working with your own Airflow deployment - not the `openmetadata-ingestion` image - you will need to upgrade
as well the `openmetadata-managed-apis` version:

```bash
pip install openmetadata-managed-apis==x.y.z
```

### Re Deploy Ingestion Pipelines

{% partial file="/v1.4/deployment/redeploy.md" /%}

If you are seeing broken dags select all the pipelines from all the services and re deploy the pipelines.

# Openmetadata-ops Script

## Overview

The `openmetadata-ops` script is designed to manage and migrate databases and search indexes, reindex existing data into Elastic Search or OpenSearch, and redeploy service pipelines.

## Usage

``` bash
sh openmetadata-ops.sh [-dhV] [COMMAND]
```

#### Commands
* analyze-tables 

Migrates secrets from the database to the configured Secrets Manager. Note that this command does not support migrating between external Secrets Managers.

* changelog

Prints the change log of database migration.

* check-connection

Checks if a connection can be successfully obtained for the target database.

* deploy-pipelines

Deploys all the service pipelines.

* drop-create

Deletes any tables in the configured database and creates new tables based on the current version of OpenMetadata. This command also re-creates the search indexes.

* info

Shows the list of migrations applied and the pending migrations waiting to be applied on the target database.

* migrate

Migrates the OpenMetadata database schema and search index mappings.

* migrate-secrets

Migrates secrets from the database to the configured Secrets Manager. Note that this command does not support migrating between external Secrets Managers.

* reindex

Reindexes data into the search engine from the command line.

* repair

Repairs the DATABASE_CHANGE_LOG table, which is used to track all the migrations on the target database. This involves removing entries for the failed migrations and updating the checksum of migrations already applied on the target database.

* validate

Checks if all the migrations have been applied on the target database.

### Examples

Display Help To display the help message:

```bash
sh openmetadata-ops.sh --help
```

### Migrate Database Schema

To migrate the database schema and search index mappings:
```bash
sh openmetadata-ops.sh migrate
```

### Reindex Data

To reindex data into the search engine:
```bash
sh openmetadata-ops.sh reindex
```
