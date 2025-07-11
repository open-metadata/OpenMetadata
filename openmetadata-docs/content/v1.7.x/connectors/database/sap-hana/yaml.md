---
title: Run the SAP HANA Connector Externally
slug: /connectors/database/sap-hana/yaml
---

{% connectorDetailsHeader
name="SAP HANA"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Sample Data", "Auto-Classification"]
unavailableFeatures=["Query Usage", "Stored Procedures", "Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the SAP HANA connector.

Configure and schedule SAP HANA metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Lineage](#lineage)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 1.1 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}


{% note %}
The connector is compatible with HANA or HANA express versions since HANA SPS 2.
{% /note %}

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the SAP HANA ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[sap-hana]"
```

### Metadata

To extract metadata the user used in the connection needs to have access to the `SYS` schema.

You can create a new user to run the ingestion with:

```SQL
CREATE USER openmetadata PASSWORD Password123;
```

And, if you have password policies forcing users to reset the password, you can disable that policy for this technical user with:

```SQL
ALTER USER openmetadata DISABLE PASSWORD LIFETIME;
```

Note that in order to get the metadata for **Calculation Views**, **Analytics Views** and **Attribute Views**, you need to have enough
permissions on the `_SYS_BIC` schema. You can grant the required permissions to the user by running the following SQL commands:

```SQL
GRANT SELECT ON SCHEMA _SYS_BIC TO <user_or_role>;
```

The same applies to the `_SYS_REPO` schema, required for lineage extraction.

### Profiler & Data Quality

Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. The user should also be allowed to view information in `tables` for all objects in the database. More information on the profiler workflow setup can be found [here](/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](/how-to-guides/data-quality-observability/quality).

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/sapHanaConnection.json)
you can find the structure to create a connection to SAP HANA.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for SAP HANA:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

We support two possible connection types:
1. **SQL Connection**, where you will the username, password and host.
2. **HDB User Store** [connection](https://help.sap.com/docs/SAP_HANA_PLATFORM/b3ee5778bc2e4a089d3299b82ec762a7/dd95ac9dbb571014a7d7f0234d762fdb.html?version=2.0.05&locale=en-US).
   Note that the HDB Store will need to be locally available to the instance running the ingestion process.
   If you are unsure about this setting, you can run the ingestion process passing the usual SQL connection details.

##### SQL Connection

If using the SQL Connection, inform:

{% codeInfo srNumber=1 %}

**hostPort**: Host and port of the SAP HANA service. This should be specified as a string in the format `hostname:port`. E.g., `localhost:39041`, `host.docker.internal:39041`.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**username**: Specify the User to connect to SAP HANA. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**password**: Password to connect to SAP HANA.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**database**: Optional parameter to connect to a specific database.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**databaseSchema**: databaseSchema of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.

{% /codeInfo %}

##### HDB User Store

If you have a User Store configured, then:

{% codeInfo srNumber=6 %}

**userKey**: HDB Store User Key generated from the command `hdbuserstore SET <KEY> <host:port> <USERNAME> <PASSWORD>`.

{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}
#### Advanced Configuration

{% codeInfo srNumber=7 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: sapHana
  serviceName: <service name>
  serviceConnection:
    config:
      type: SapHana
      connection:
```
```yaml {% srNumber=1 %}
        ## Parameters for the SQL Connection
        # hostPort: <hostPort>
```
```yaml {% srNumber=2 %}
        # username: <username>
```
```yaml {% srNumber=3 %}
        # password: <password>
```
```yaml {% srNumber=4 %}
        # database: <database>
```
```yaml {% srNumber=5 %}
        # databaseSchema: <schema>
```
```yaml {% srNumber=6 %}
        ## Parameter for the HDB User Store
        # userKey: <key>
```
```yaml {% srNumber=7 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=8 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.7/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.7/connectors/yaml/lineage.md" variables={connector: "sapHana"} /%}

{% partial file="/v1.7/connectors/yaml/data-profiler.md" variables={connector: "sapHana"} /%}

{% partial file="/v1.7/connectors/yaml/auto-classification.md" variables={connector: "sapHana"} /%}

{% partial file="/v1.7/connectors/yaml/data-quality.md" /%}

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
