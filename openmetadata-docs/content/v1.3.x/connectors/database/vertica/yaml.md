---
title: Run the Vertica Connector Externally
slug: /connectors/database/vertica/yaml
---

{% connectorDetailsHeader
name="Vertica"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt"]
unavailableFeatures=["Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Vertica connector.

Configure and schedule Vertica metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Permissions

To run the ingestion we need a user with `SELECT` grants on the schemas that you'd like to ingest, as well as to the
`V_CATALOG` schema. You can grant those as follows for the schemas in your database:

```sql
CREATE USER openmetadata IDENTIFIED BY 'password';
GRANT SELECT ON ALL TABLES IN SCHEMA PUBLIC TO openmetadata;
GRANT SELECT ON ALL TABLES IN SCHEMA V_CATALOG TO openmetadata;
```

Note that these `GRANT`s won't be applied to any new table created on the schema unless the schema
has [Inherited Privileges](https://www.vertica.com/docs/8.1.x/HTML/index.htm#Authoring/AdministratorsGuide/Security/DBUsersAndPrivileges/GrantInheritedPrivileges.htm)

```sql
ALTER SCHEMA s1 DEFAULT INCLUDE PRIVILEGES;
-- If using the PUBLIC schema
ALTER SCHEMA "<db>.public" DEFAULT INCLUDE PRIVILEGES;
```

#### Lineage and Usage

If you also want to run the Lineage and Usage workflows, then the user needs to be granted permissions to the
`V_MONITOR` schema:

```sql
GRANT SELECT ON ALL TABLES IN SCHEMA V_MONITOR TO openmetadata;
```

Note that this setting might only grant visibility to the queries executed by this user. A more complete approach
will be to grant the `SYSMONITOR` role to the `openmetadata` user:

```sql
GRANT SYSMONITOR TO openmetadata;
ALTER USER openmetadata DEFAULT ROLE SYSMONITOR;
```

#### Profiler

To run the profiler, it's not enough to have `USAGE` permissions to the schema as we need to `SELECT` the tables
in there. Therefore, you'll need to grant `SELECT` on all tables for the schemas:

```sql
GRANT SELECT ON ALL TABLES IN SCHEMA <schema> TO openmetadata;
```

### Python Requirements

To run the Vertica ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[vertica]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/verticaConnection.json)
you can find the structure to create a connection to Vertica.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)


### 1. Define the YAML Config

This is a sample config for Vertica:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Vertica. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to Vertica.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: Enter the fully qualified hostname and port number for your Vertica deployment in the Host and Port field.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**database**: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=5 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: vertica
  serviceName: local_vertica
  serviceConnection:
    config:
      type: Vertica
```
```yaml {% srNumber=1 %}
      username: username
```
```yaml {% srNumber=2 %}
      password: password
```
```yaml {% srNumber=3 %}
      hostPort: localhost:5432
```
```yaml {% srNumber=4 %}
      # database: database
```
```yaml {% srNumber=5 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=6 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.3/connectors/yaml/data-profiler.md" variables={connector: "vertica"} /%}

{% partial file="/v1.3/connectors/yaml/data-quality.md" /%}

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
