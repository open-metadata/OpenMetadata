---
title: Run the Trino Connector Externally
slug: /connectors/database/trino/yaml
---

# Run the Trino Connector Externally

{% multiTablesWrapper %}

| Feature            | Status                       |
| :----------------- | :--------------------------- |
| Stage              | PROD                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="check" /%} |
| Data Profiler      | {% icon iconName="check" /%} |
| Data Quality       | {% icon iconName="check" /%} |
| Stored Procedures  | {% icon iconName="cross" /%} |
| Owners             | {% icon iconName="cross" /%} |
| Tags               | {% icon iconName="cross" /%} |
| DBT                | {% icon iconName="check" /%} |
| Supported Versions | --                           |

| Feature      | Status                       |
| :----------- | :--------------------------- |
| Lineage      | {% icon iconName="check" /%} |
| Table-level  | {% icon iconName="check" /%} |
| Column-level | {% icon iconName="check" /%} |

{% /multiTablesWrapper %}

In this section, we provide guides and references to use the Trino connector.

Configure and schedule Trino metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.2/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}



### Python Requirements

To run the Trino ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[trino]"
```

{% tilesContainer %}

To ingest metadata from the Trino source, the user must have select privileges for the following tables.
- `information_schema.schemata`
- `information_schema.columns`
- `information_schema.tables`
- `information_schema.views`
- `system.metadata.table_comments`

{% /tilesContainer %}

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/trinoConnection.json)
you can find the structure to create a connection to Trino.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Trino:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Trino. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

- **authType**: User can authenticate the Trino Instance with auth type as `Basic Authentication` i.e. Password **or** by using `JWT Authentication`.
  - **Basic Auth**:
    - **password**: Password to connect to Trino.
  - **JWT Auth Config**:
    - **jwt**: JWT can be used to authenticate with trino. Follow the steps in the [official trino](https://trino.io/docs/current/security/jwt.html) documentation to setup trino with jwt.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: Enter the fully qualified hostname and port number for your Trino deployment in the Host and Port field.

{% /codeInfo %}
{% codeInfo srNumber=4 %}

**catalog**: Trino offers a catalog feature where all the databases are stored. (Providing the Catalog is not mandatory from 0.12.2 or greater versions)

{% /codeInfo %}
{% codeInfo srNumber=5 %}

**DatabaseSchema**: DatabaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.

{% /codeInfo %}
{% codeInfo srNumber=6 %}

**proxies**: Proxies for the connection to Trino data source

{% /codeInfo %}
{% codeInfo srNumber=7 %}

**params**: URL parameters for connection to the Trino data source

{% /codeInfo %}


{% partial file="/v1.2/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.2/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.2/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=8 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=9 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: trino
  serviceName: <service name>
  serviceConnection:
    config:
      type: Trino
```
```yaml {% srNumber=1 %}
      hostPort: <hostPort>
```
```yaml {% srNumber=2 %}
      username: <username>
```
```yaml {% srNumber=3 %}
      authType:
      # For basic auth
        password: password
      # # For JWT auth
      #   jwt: jwt_token
```
```yaml {% srNumber=4 %}
      catalog: <catalog>
```
```yaml {% srNumber=5 %}
      # databaseSchema: schema
```
```yaml {% srNumber=6 %}
      # proxies:
      #   http: http_proxy
      #   https: https_proxy
```
```yaml {% srNumber=7 %}
      # We can add URL parameters if needed
      # params:
      #   key: value
```
```yaml {% srNumber=8 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=9 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.2/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.2/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.2/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.2/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.2/connectors/yaml/data-profiler.md" variables={connector: "trino"} /%}

## SSL Configuration

In order to integrate SSL in the Metadata Ingestion Config, the user will have to add the SSL config under **connectionArguments** which is placed in source.

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=25 %}

### SSL Modes
There are couple of types of SSL modes that redshift supports which can be added to ConnectionArguments, they are as follows:
- **false**: In order to disable SSL verification, set the `verify` parameter to `False`.
- **\<path-to-crt\>**: To use self-signed certificates, specify a path to the certificate in `verify` parameter.
More details can be found in [the Python requests library documentation](https://requests.readthedocs.io/en/latest/user/advanced.html?highlight=ssl#ssl-cert-verification).

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% srNumber=25 %}
source:
  type: trino
  serviceName: <service name>
  serviceConnection:
    config:
      type: Trino
      hostPort: <hostPort>
      username: <username>
      catalog: <catalog>
      ...
      ...
      connectionArguments:
        verify: <verify-mode>

```
{% /codeBlock %}
{% /codePreview %}

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
