---
title: DB2
slug: /connectors/database/db2
---

{% connectorDetailsHeader
name="DB2"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "View Lineage", "View Column-level Lineage", "dbt"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures"]
/ %}

{%important%}
OpenMetadata doesn't ship DB2 connector in the ingestion contain by default.
Please make sure you install the below Python package in the ingestion container if you are planning on running DB2 Connector.

If you are running this as part of docker
```code
docker exec -it openmetadata_ingestion pip install '.[db2]'
```

Using python pip, Please make sure you provide appropriate version of ingestion in below command
```code
 pip install 'openmetadata-ingestion[db2]==1.2.4.0'
```

{%/important%}

In this section, we provide guides and references to use the DB2 connector.

Configure and schedule DB2 metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.5/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/db2/yaml"} /%}

## Requirements

To create a new Db2 user please follow the guidelines mentioned [here](https://www.ibm.com/docs/ko/samfess/8.2.0?topic=schema-creating-users-manually)

Db2 user must have the below permissions to ingest the metadata:

- `SELECT` privilege on `SYSCAT.SCHEMATA` to fetch the metadata of schemas.
```sql
-- Grant SELECT on tables for schema metadata
GRANT SELECT ON SYSCAT.SCHEMATA TO USER_NAME;
```

- `SELECT` privilege on `SYSCAT.TABLES` to fetch the metadata of tables.
```sql
-- Grant SELECT on tables for table metadata
GRANT SELECT ON SYSCAT.TABLES TO USER_NAME;
```

- `SELECT` privilege on `SYSCAT.VIEWS` to fetch the metadata of views.
```sql
-- Grant SELECT on tables for view metadata
GRANT SELECT ON SYSCAT.VIEWS TO USER_NAME;
```

### Profiler & Data Quality

Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](/how-to-guides/data-quality-observability/quality).

## Metadata Ingestion
{% partial 
  file="/v1.5/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "DB2", 
    selectServicePath: "/images/v1.5/connectors/db2/select-service.png",
    addNewServicePath: "/images/v1.5/connectors/db2/add-new-service.png",
    serviceConnectionPath: "/images/v1.5/connectors/db2/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to DB2. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to DB2.
- **database**: Database of the data source.
- **Host and Port**: Enter the fully qualified hostname and port number for your DB2 deployment in the Host and Port field.

{% note %}
If you are using DB2 for IBM i:

- From advanced config you need to chose `ibmi` scheme
- In Host and Port you should not add the Port Number.
{% /note %}

{% partial file="/v1.5/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.5/connectors/test-connection.md" /%}

{% partial file="/v1.5/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.5/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.5/connectors/troubleshooting.md" /%}

{% partial file="/v1.5/connectors/database/related.md" /%}

