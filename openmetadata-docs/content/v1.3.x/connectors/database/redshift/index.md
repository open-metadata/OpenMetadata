---
title: Redshift
slug: /connectors/database/redshift
---

{% connectorDetailsHeader
name="Redshift"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Stored Procedures"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Redshift connector.

Configure and schedule Redshift metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](/connectors/ingestion/workflows/usage)
- [Data Profiler](/connectors/ingestion/workflows/profiler)
- [Data Quality](/connectors/ingestion/workflows/data-quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/redshift/yaml"} /%}

## Requirements

### Metadata
Redshift user must grant `SELECT` privilege on table [SVV_TABLE_INFO](https://docs.aws.amazon.com/redshift/latest/dg/r_SVV_TABLE_INFO.html) to fetch the metadata of tables and views. For more information visit [here](https://docs.aws.amazon.com/redshift/latest/dg/c_visibility-of-data.html).

```sql
-- Create a new user
-- More details https://docs.aws.amazon.com/redshift/latest/dg/r_CREATE_USER.html
CREATE USER test_user with PASSWORD 'password';

-- Grant SELECT on table
GRANT SELECT ON TABLE svv_table_info to test_user;
```

### Profiler & Data Quality
Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler) and data quality tests [here](https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality).

### Usage & Lineage
For the usage and lineage workflow, the user will need `SELECT` privilege on `STL_QUERY` table. You can find more information on the usage workflow [here](https://docs.open-metadata.org/connectors/ingestion/workflows/usage) and the lineage workflow [here](https://docs.open-metadata.org/connectors/ingestion/workflows/lineage).

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Redshift", 
    selectServicePath: "/images/v1.3/connectors/redshift/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/redshift/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/redshift/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to Redshift. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Redshift.
- **Database (Optional)**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.

{% note %}
During the metadata ingestion for redshift, the tables in which the distribution style i.e, `DISTSTYLE` is not `AUTO` will be marked as partitioned tables
{% /note %}

**SSL Configuration**

In order to integrate SSL in the Metadata Ingestion Config, the user will have to add the SSL config under connectionArguments which is placed in the source.

**SSL Modes**

There are a couple of types of SSL modes that Redshift supports which can be added to ConnectionArguments, they are as follows:
- **disable**: SSL is disabled and the connection is not encrypted.

- **allow**: SSL is used if the server requires it.

- **prefer**: SSL is used if the server supports it. Amazon Redshift supports SSL, so SSL is used when you set sslmode to prefer.

- **require**: SSL is required.

- **verify-ca**: SSL must be used and the server certificate must be verified.

- **verify-full**: SSL must be used. The server certificate must be verified and the server hostname must match the hostname attribute on the certificate.

For more information, you can visit [Redshift SSL documentation](https://docs.aws.amazon.com/redshift/latest/mgmt/connecting-ssl-support.html)

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
