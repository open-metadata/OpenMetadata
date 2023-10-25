## Prerequisites

Everytime that you plan on upgrading OpenMetadata to a newer version, make sure to go over all these steps:

### 1. Backup your Metadata

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
pip install openmetadata-ingestion~=1.1.1
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

### 2. Review the Deprecation Notice and Breaking Changes

Releases might introduce deprecations and breaking changes that you should be aware of and understand before moving forward.

Below in this page you will find the details for the latest release, and you can find older release notes [here](/deployment/upgrade/versions).

The goal is to answer questions like:
- *Do I need to update my configurations?*
- *If I am running connectors externally, did their service connection change?*

Carefully reviewing this will prevent easy errors.

### (Optional) 3. Update your OpenMetadata Ingestion Client

If you are running the ingestion workflows **externally** or using a custom Airflow installation, you need to make sure that the Python Client you use is aligned
with the OpenMetadata server version.

For example, if you are upgrading the server to the version `x.y.z`, you will need to update your client with

```bash
pip install openmetadata-ingestion[<plugin>]==x.y.z
```

The `plugin` parameter is a list of the sources that we want to ingest. An example would look like this `openmetadata-ingestion[mysql,snowflake,s3]==1.1.5`.
You will find specific instructions for each connector [here](/connectors).

Moreover, if working with your own Airflow deployment - not the `openmetadata-ingestion` image - you will need to upgrade
as well the `openmetadata-managed-apis` version:

```bash
pip install openmetadata-managed-apis==x.y.z
```

## Deprecation Notice

- OpenMetadata only supports Python version 3.8 to 3.10. We will add support for 3.11 in the release 1.3.

## Breaking Changes for 1.2 Stable Release

### Query Entity

The Query Entity now has the `service` property, linking the Query to the Database Service that it belongs to. Note
that `service` is a required property both for the Query Entity and the Create Query Entity.

During the migrations, we pick up the service from the tables from `queryUsedIn`. If this information is not available,
then there is no way to link a query to a service and the query will be removed.

### Service Connection Changes

- Domo Database, Dashboard and Pipeline renamed the `sandboxDomain` in favor of `instanceDomain`.

### Ingestion Framework Changes

We have reorganized the structure of the `Workflow` classes, which requires updated imports:

- **Metadata Workflow**
  - From: `from metadata.ingestion.api.workflow import Workflow`
  - To: `from metadata.workflow.metadata import MetadataWorkflow`

- **Lineage Workflow**
  - From: `from metadata.ingestion.api.workflow import Workflow`
  - To: `from metadata.workflow.metadata import MetadataWorkflow` (same as metadata)

- **Usage Workflow**
  - From: `from metadata.ingestion.api.workflow import Workflow`
  - To: `from metadata.workflow.usage import UsageWorkflow`

- **Profiler Workflow**
  - From: `from metadata.profiler.api.workflow import ProfilerWorkflow`
  - To: `from metadata.workflow.profiler import ProfilerWorkflow`

- **Data Quality Workflow**
  - From: `from metadata.data_quality.api.workflow import TestSuiteWorkflow`
  - To: `from metadata.workflow.data_quality import TestSuiteWorkflow`

- **Data Insights Workflow**
  - From: `from metadata.data_insight.api.workflow import DataInsightWorkflow`
  - To: `from metadata.workflow.data_insight import DataInsightWorkflow`

- **Elasticsearch Reindex Workflow**
  - From: `from metadata.ingestion.api.workflow import Workflow`
  - To: `from metadata.workflow.metadata import MetadataWorkflow` (same as metadata)

The `Workflow` class that you import can then be called as follows:

```python
from metadata.workflow.workflow_output_handler import print_status

workflow = workflow_class.create(workflow_config)
workflow.execute()
workflow.raise_from_status()
print_status(workflow)  # This method has been updated. Before it was `workflow.print_status()`
workflow.stop()
```

If you try to run your workflows externally and start noticing `ImportError`s, you will need to review the points above.

### Metadata CLI Changes

In 1.1.7 and below you could run the Usage Workflow as `metadata ingest -c <path to yaml>`. Now, the Usage Workflow
has its own command `metadata usage -c <path to yaml>`.

### Other Changes

- Pipeline Status are now timestamps in milliseconds.
