---
title: How to Ingest Metadata | Official Documentation
description: Learn how to ingest metadata using connectors for databases, pipelines, dashboards, and storage systems.
slug: /how-to-guides/admin-guide/how-to-ingest-metadata
---

# How to Ingest Metadata

*This section deals with integrating third-party sources with OpenMetadata and running the workflows from the UI.*

OpenMetadata gives you the flexibility to bring in your data from third-party sources using CLI, or the UI. Let’s start with ingesting your metadata from various sources through the UI. Follow the easy steps to add a connector to fetch metadata on a regular basis at your desired frequency.

{% note %}

**Note:** Ensure that you have **Admin access** in the source tools to be able to add a connector and ingest metadata.

{% /note %}

Admin users can connect to multiple data sources like Databases, Dashboards, Pipelines, ML Models, Messaging, Storage, as well as Metadata services.

{%note%}

{%inlineCallout
color="violet-70"
bold="Connector Documentation"
icon="add_moderator"
href="/connectors"%}
Refer to the Docs to ingest metadata from multiple sources - Databases, Dashboards, Pipelines, ML Models, Messaging, Storage, as well as Metadata services.
 {%/inlineCallout%}

- **Database Services:** [ADLS Datalake](/connectors/database/adls-datalake), [Athena](/connectors/database/athena), [AzureSQL](/connectors/database/azuresql), [BigQuery](/connectors/database/bigquery), [Clickhouse](/connectors/database/clickhouse), [Databricks](/connectors/database/databricks), [DB2](/connectors/database/db2), [DeltaLake](/connectors/database/deltalake), [Domo Database](/connectors/database/domo-database), [Druid](/connectors/database/druid), [DynamoDB](/connectors/database/dynamodb), [GCS Datalake](/connectors/database/gcs-datalake), [Glue](/connectors/database/glue), [Hive](/connectors/database/hive), [Impala](/connectors/database/impala), [MariaDB](/connectors/database/mariadb), [MongoDB](/connectors/database/mongodb), [MSSQL](/connectors/database/mssql), [MySQL](/connectors/database/mysql), [Oracle](/connectors/database/oracle), [PinotDB](/connectors/database/pinotdb), [PostgreSQL](/connectors/database/postgres), [Presto](/connectors/database/presto),  [Redshift](/connectors/database/redshift), [Salesforce](/connectors/database/salesforce), [SAP HANA](/connectors/database/sap-hana), [SAS](/connectors/database/sas), [SingleStore](/connectors/database/singlestore), [Snowflake](/connectors/database/snowflake), [SQLite](/connectors/database/sqlite), [S3 Datalake](/connectors/database/s3-datalake), [Trino](/connectors/database/trino), and [Vertica](/connectors/database/vertica).

- **Dashboard Services:** [Domo Dashboard](/connectors/dashboard/domo-dashboard), [Looker](/connectors/dashboard/looker), [Metabase](/connectors/dashboard/metabase), [Mode](/connectors/dashboard/mode), [PowerBI](/connectors/dashboard/powerbi), [Qlik Sense](/connectors/dashboard/qliksense), [QuickSight](/connectors/dashboard/quicksight), [Redash](/connectors/dashboard/redash), [Superset](/connectors/dashboard/superset), and [Tableau](/connectors/dashboard/tableau).

- **Messaging Services:** [Kafka](/connectors/messaging/kafka), [Kinesis](/connectors/messaging/kinesis), and [Redpanda](/connectors/messaging/redpanda).

- **Pipeline Services:** [Airbyte](/connectors/pipeline/airbyte), [Airflow](/connectors/pipeline/airflow), [Dagster](/connectors/pipeline/dagster), [Databricks Pipeline](/connectors/pipeline/databricks-pipeline), [Domo Pipeline](/connectors/pipeline/domo-pipeline), [Fivetran](/connectors/pipeline/fivetran), [Glue Pipeline](/connectors/pipeline/glue-pipeline), [NiFi](/connectors/pipeline/nifi), and [Spline](/connectors/pipeline/spline).

- **ML Model Services:** [MLflow](/connectors/ml-model/mlflow), and [Sagemaker](/connectors/ml-model/sagemaker).

- **Storage Service:** [Amazon S3](/connectors/storage/s3)

- **Metadata Services:** [Amundsen](/connectors/metadata/amundsen), and [Atlas](/connectors/metadata/atlas)

{%/note%}

Let’s start with an example of fetching metadata from a database service, i.e., Snowflake.

- Start by creating a service connection by clicking on **Settings** from the left nav bar. Navigate to the **Services** section, and click on **Databases**. Click on **Add New Service**.
{% image
    src="/images/v1.9/how-to-guides/admin-guide/connector1.png"
    alt="Create a Service Connection"
    caption="Create a Service Connection"
    /%}
{% image
    src="/images/v1.9/how-to-guides/admin-guide/connector1.1.png"
    alt="Create a Service Connection"
    caption="Create a Service Connection"
    /%}
{% image
    src="/images/v1.9/how-to-guides/admin-guide/connector1.2.png"
    alt="Create a Service Connection"
    caption="Create a Service Connection"
    /%}

- Select the Database service of your choice. For example, Snowflake. Click **Next**.
{% image
    src="/images/v1.9/how-to-guides/admin-guide/connector2.jpg"
    alt="Select the Database Connector"
    caption="Select the Database Connector"
    /%}

- To configure Snowflake, enter a unique service name. Click **Next**.
  - **Name:** No spaces allowed. Apart from letters and numbers, you can use _ - . & ( )
  - **Description:** It is optional, but best to add documentation to improve data culture.
{% image
    src="/images/v1.9/how-to-guides/admin-guide/snowflake1.png"
    alt="Configure Snowflake"
    caption="Configure Snowflake"
    /%}

- Enter the **Connection Details**. The Connector documentation is available right within OpenMetadata in the right side panel. The connector details will differ based on the service selected. Users can add their credentials to create a service and further set up the workflows.
{% image
    src="/images/v1.9/how-to-guides/admin-guide/snowflake2.png"
    alt="Connection Details"
    caption="Connection Details"
    /%}

- Users can **Test the Connection** before creating the service. Test Connection checks for access, and also about what details can be ingested using the connection.
{% image
    src="/images/v1.9/how-to-guides/admin-guide/snowflake3.png"
    alt="Test the Connection"
    caption="Test the Connection"
    /%}

- The **Connection Status** will verify access to the service as well as to the data assets. Once the connection has been tested, you can save the details.
{% image
    src="/images/v1.9/how-to-guides/admin-guide/testconnection1.png"
    alt="Connection Successful"
    caption="Connection Successful"
    /%}

- Add the default schema, database, and table patterns, then click Save to create and configure the database service. Administrators can subsequently set up pipelines to ingest source data into OpenMetadata.
  - Clicking on **Save** will navigate to the Database service page, where you can view the Insights, Databases, Agents, and Connection Details Tabs. You can also **Add the Metadata Agent** from the Agents tab.

  - Or, you can directly start with **Adding Agent**.
{% image
    src="/images/v1.9/how-to-guides/admin-guide/snowflake4.png"
    alt="Snowflake Service Created"
    caption="Snowflake Service Created"
    /%}

{% note %}
**Tip:** In the Service page, the **Connection Tab** provides information on the connection details as well as details on what data can be ingested from the source using this connection.
{% /note %}

{% image
    src="/images/v1.9/how-to-guides/admin-guide/snowflake5.png"
    alt="View Snowflake Service"
    caption="View Snowflake Service"
    /%}

- Click on **Add Agent** and enter the details to ingest metadata:
  - **Name:** The name is randomly generated, and includes the Service Name, and a randomly generated text to create a unique name.
  - **Database Filter Pattern:** to include or exclude certain databases. A database service has multiple databases, of which you can selectively ingest the required databases.
  - **Schema Filter Pattern:** to include or exclude certain schemas. A database can have multiple schemas, of which you can selectively ingest the required schemas.
  - **Table Filter Pattern:** Use the toggle options to:
    - Use FQN for Filtering
    - Include Views - to generate lineage
    - Include Tags
    - Enable Debug Log: We recommend enabling the debug log.
    - Mark Deleted Tables
  - **View Definition Parsing Timeout Limit:** The default is set to 300.

{% image
    src="/images/v1.9/how-to-guides/admin-guide/snowflake6.png"
    alt="Configure Metadata Agent"
    caption="Configure Metadata Agent"
    /%}

- **Schedule Metadata Agent** - Define when the metadata Agent pipeline must run on a regular basis. Users can also use a **Custom Cron** expression.
{% image
    src="/images/v1.9/how-to-guides/admin-guide/schedule.png"
    alt="Schedule and Deploy Metadata Agent"
    caption="Schedule and Deploy Metadata Agent"
    /%}

After the pipeline has been created and deployed successfully, click on **View Service**. The **Agents Tab** will provide all the details for the recent runs, like if the pipeline is queued, running, failed, or successful. On hovering over the Agent details, admin users can view the scheduling frequency, as well as the start and end times for the recent runs. Users can perform certain actions, like:
- **Run** the pipeline now.
- **Kill** to end all the currently running pipelines.
- **Redeploy:** When a  service connection is setup, it fetches the data as per the access provided. If the connection credentials are changed at a later point in time, redeploying will fetch additional data with updated access, if any.

{% image
    src="/images/v1.9/how-to-guides/admin-guide/view-service.png"
    alt="View Service Agent"
    caption="View Service Agent"
    /%}

By connecting to a database service, you can ingest the databases, schemas, tables, and columns. In the Service page, the **Databases Tab** will display all the ingested databases. Users can further drilldown to view the **Schemas**, and **Tables**.
{% image
    src="/images/v1.9/how-to-guides/admin-guide/snowflake7.png"
    alt="View Table Details"
    caption="View Table Details"
    /%}

{% note %}
**Note:** Once you’ve run a metadata Agent pipeline, you can create separate pipelines to bring in [**Usage**](/connectors/ingestion/workflows/usage), [**Lineage**](/connectors/ingestion/workflows/lineage), [**dbt**](/connectors/ingestion/workflows/dbt), or to run [**Profiler**](/how-to-guides/data-quality-observability/profiler/workflow). To add pipelines, select the required type of Agent and enter the required details.
{% /note %}

{% image
    src="/images/v1.9/how-to-guides/admin-guide/snowflake8.png"
    alt="Add Agent Pipelines for Usage, Lineage, Profiler, and dbt"
    caption="Add Agent Pipelines for Usage, Lineage, Profiler, and dbt"
    /%}

Admin users can create, edit, or delete services. They can also view the connection details for the existing services.

{% note %}
**Pro Tip:** Refer to the [Best Practices for Metadata Agent](/connectors/ingestion/best-practices).
{% /note %}

{%inlineCallout
  color="violet-70"
  bold="Delete a Service Connection"
  icon="MdArrowForward"
  href="/how-to-guides/admin-guide/delete-service-connection"%}
  Permanently delete a service connection.
{%/inlineCallout%}
