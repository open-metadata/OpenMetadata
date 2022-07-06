# Upgrade from 0.10 to 0.11

Upgrading from 0.10 to 0.11 can be done directly on your instances. This page will list a couple of details that you should take into consideration when running the upgrade.

Note that you can run the upgrade with the instructions specified in each page:

{% content-ref url="upgrade-on-bare-metal/" %}
[upgrade-on-bare-metal](upgrade-on-bare-metal/)
{% endcontent-ref %}

{% content-ref url="upgrade-on-docker/" %}
[upgrade-on-docker](upgrade-on-docker/)
{% endcontent-ref %}

{% content-ref url="upgrade-on-kubernetes/" %}
[upgrade-on-kubernetes](upgrade-on-kubernetes/)
{% endcontent-ref %}

## Highlights

### Data Indexing

0.11 comes with changes to the Elasticsearch indexes. In this case, indexes will need to be recreated.

You can do so by following this guide: [How to fully index OpenMetadata into Elasticsearch](https://github.com/open-metadata/OpenMetadata/discussions/5300).

### Ingestion Pipelines

The process of how the Ingestion Pipelines retrieve the service data has been updated. During the upgrade, your services will be automatically updated if their schema changed, and the Ingestion Pipelines will be removed.

From the Services > Ingestion tab, you can then re-create and deploy the Ingestion Pipelines.

### Clear the Cache!

Are you having some issues with the UI after upgrading to 0.11? Make sure you are cleaning the browser cache to properly pick up all the updated components and definitions.

### Metadata Workflow Updates

On 0.11 we moved around a couple of things from the `metadata` ingestion workflow, specifically in the `sourceConfig`:

* `generateSampleData`: this now happens on the profiler workflow. This option is removed from the metadata pipeline
* `sampleDataQuery` is not needed anymore, as in the profiler workflow we use real automated sampling
* `enableDataProfiler` is disabled. We do not support anymore run the profiler from metadata workflows

### Service Connection Updates

* BigQuery
  * Removed: `username`, `projectId`, `enablePolicyTagImport`, `database`
  * Added: `taxonomyLocation`, `usageLocation`
* Snowflake:
  * Added: `queryTag`
* Redshift:
  * Added: `ingestAllDatabases`
* Oracle, Mysql, MariaDB, Hive, DB2, Clickhouse, SingleStore, Trino, Presto:
  * Renamed from `database` to `databaseSchema`
* Databricks, Athena:
  * Removed: `database`
* Dashboards:
  * Removed `dbServiceName` from the connection information to the `sourceConfig`
