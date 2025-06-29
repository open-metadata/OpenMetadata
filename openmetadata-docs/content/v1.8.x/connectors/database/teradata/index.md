---
title: Teradata Connector | OpenMetadata Data Warehouse Guide
slug: /connectors/database/teradata
---

{% connectorDetailsHeader
name="Teradata"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "View Lineage", "View Column-level Lineage", "Sample Data"]
unavailableFeatures=["Query Usage", "Data Quality", "Owners", "Tags", "Stored Procedures", "dbt"]
/ %}

In this section, we provide guides and references to use the Teradata connector.

Configure and schedule Teradata metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Lineage](/how-to-guides/data-lineage/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality/configure)
- [Troubleshooting](/connectors/database/teradata/troubleshooting)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/greenplum/yaml"} /%}

## Requirements
{%inlineCallout icon="description" bold="OpenMetadata 1.6 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

Connector was tested on Teradata DBS version 17.20. Since there are no significant changes in metadata objects, so it should work with 15.x, 16.x versions.


## Metadata Ingestion

By default, all valid users in Teradata DB has full access to metadata objects, so there are no any specific requirements to user privileges.

{% partial 
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Teradata", 
    selectServicePath: "/images/v1.8/connectors/teradata/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/teradata/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/teradata/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to Teradata.
- **Password**: Password to connect to Teradata
- **Logmech**: Specifies the logon authentication method. Possible values are TD2 (the default), JWT, LDAP, KRB5 for Kerberos, or TDNEGO.  
- **LOGDATA**: Specifies additional data needed by a logon mechanism, such as a secure token, Distinguished Name, or a domain/realm name. LOGDATA values are specific to each logon mechanism.
- **Host and Port**: Enter the fully qualified hostname and port number (default port for Teradata is 1025) for your Teradata deployment in the Host and Port field.
- **Transaction Mode**: Specifies the transaction mode for the connection. Possible values are DEFAULT (the default), ANSI, or TERA.
- **Teradata Database Account**: Specifies an account string to override the default account string defined for the database user. Accounts are used by the database for workload management and resource usage monitoring.
- **Connection Options** and **Connection Arguments**: additional connection parameters. For more information please view teradatasql [docs](https://pypi.org/project/teradatasql/).

{% partial file="/v1.8/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.8/connectors/database/related.md" /%}
