---
title: Run the Delta Lake Connector Externally
slug: /connectors/database/deltalake/yaml
---

{% connectorDetailsHeader
name="DeltaLake"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "dbt"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Deltalake connector.

Configure and schedule Deltalake metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

Deltalake requires to run with Python 3.8, 3.9 or 3.10. We do not yet support the Delta connector
for Python 3.11

### Python Requirements

To run the Deltalake ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[deltalake]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/deltaLakeConnection.json)
you can find the structure to create a connection to Deltalake.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Deltalake:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**Metastore Host Port**: Enter the Host & Port of Hive Metastore Service to configure the Spark Session. Either
  of `metastoreHostPort`, `metastoreDb` or `metastoreFilePath` is required.

**Metastore File Path**: Enter the file path to local Metastore in case Spark cluster is running locally. Either
  of `metastoreHostPort`, `metastoreDb` or `metastoreFilePath` is required.

**Metastore DB**: The JDBC connection to the underlying Hive metastore DB. Either
  of `metastoreHostPort`, `metastoreDb` or `metastoreFilePath` is required.

**appName (Optional)**: Enter the app name of spark session.

**Connection Arguments (Optional)**: Key-Value pairs that will be used to pass extra `config` elements to the Spark
  Session builder.

We are internally running with `pyspark` 3.X and `delta-lake` 2.0.0. This means that we need to consider Spark
configuration options for 3.X.

##### Metastore Host Port

When connecting to an External Metastore passing the parameter `Metastore Host Port`, we will be preparing a Spark Session with the configuration

```
.config("hive.metastore.uris", "thrift://{connection.metastoreHostPort}") 
```

Then, we will be using the `catalog` functions from the Spark Session to pick up the metadata exposed by the Hive Metastore.

##### Metastore File Path

If instead we use a local file path that contains the metastore information (e.g., for local testing with the default `metastore_db` directory), we will set

```
.config("spark.driver.extraJavaOptions", "-Dderby.system.home={connection.metastoreFilePath}") 
```

To update the `Derby` information. More information about this in a great [SO thread](https://stackoverflow.com/questions/38377188/how-to-get-rid-of-derby-log-metastore-db-from-spark-shell).

- You can find all supported configurations [here](https://spark.apache.org/docs/latest/configuration.html)
- If you need further information regarding the Hive metastore, you can find
  it [here](https://spark.apache.org/docs/3.0.0-preview/sql-data-sources-hive-tables.html), and in The Internals of
  Spark SQL [book](https://jaceklaskowski.gitbooks.io/mastering-spark-sql/content/spark-sql-hive-metastore.html).


##### Metastore Database

You can also connect to the metastore by directly pointing to the Hive Metastore db, e.g., `jdbc:mysql://localhost:3306/demo_hive`.

Here, we will need to inform all the common database settings (url, username, password), and the driver class name for JDBC metastore.

You will need to provide the driver to the ingestion image, and pass the `classpath` which will be used in the Spark Configuration under `sparks.driver.extraClassPath`.


{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=2 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: deltalake
  serviceName: "<service name>"
  serviceConnection:
    config:
      type: DeltaLake
```
```yaml {% srNumber=1 %}
      metastoreConnection:
        # Pick only of the three
        ## 1. Hive Service Thrift Connection
        metastoreHostPort: "<metastore host port>"
        ## 2. Hive Metastore db connection
        # metastoreDb: jdbc:mysql://localhost:3306/demo_hive
        # username: username
        # password: password
        # driverName: org.mariadb.jdbc.Driver
        # jdbcDriverClassPath: /some/path/
        ## 3. Local file for Testing
        # metastoreFilePath: "<path_to_metastore>/metastore_db"
      appName: MyApp
```
```yaml {% srNumber=2 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=3 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
