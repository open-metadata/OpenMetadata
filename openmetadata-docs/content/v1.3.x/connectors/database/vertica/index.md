---
title: Vertica
slug: /connectors/database/vertica
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
- [Data Profiler](/connectors/ingestion/workflows/profiler)
- [Data Quality](/connectors/ingestion/workflows/data-quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/vertica/yaml"} /%}

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

## Metadata Ingestion
{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Vertica", 
    selectServicePath: "/images/v1.3/connectors/vertica/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/vertica/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/vertica/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to Vertica. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Vertica.
- **Host and Port**: Enter the fully qualified hostname and port number for your Vertica deployment in the Host and Port field.

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
