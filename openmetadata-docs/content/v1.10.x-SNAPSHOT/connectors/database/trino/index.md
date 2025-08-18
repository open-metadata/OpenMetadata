---
title: Trino Connector | OpenMetadata Distributed SQL Integration
description: Configure OpenMetadata'sTrino database connector to seamlessly integrate your distributed SQL engine with automated metadata discovery and lineage tracking.
slug: /connectors/database/trino
---

{% connectorDetailsHeader
name="Trino"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Sample Data", "Auto-Classification"]
unavailableFeatures=["Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Trino connector.

Configure and schedule Trino metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Lineage](/how-to-guides/data-lineage/workflow)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Troubleshooting](/connectors/database/trino/troubleshooting)

{% partial file="/v1.10/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/trino/yaml"} /%}

## Requirements

### Metadata

To extract metadata, the user needs to be able to have `SELECT` privilege on all the tables that you would like to ingest in OpenMetadata as well as `SELECT` privilege `system.metadata.table_comments` table.

Access to resources will be based on the user access permission to access specific data sources. More information regarding access and security can be found in the Trino documentation [here](https://trino.io/docs/current/security.html).

### Profiler & Data Quality

Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](/how-to-guides/data-quality-observability/quality).

## Metadata Ingestion
{% partial 
  file="/v1.10/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Trino", 
    selectServicePath: "/images/v1.10/connectors/trino/select-service.png",
    addNewServicePath: "/images/v1.10/connectors/trino/add-new-service.png",
    serviceConnectionPath: "/images/v1.10/connectors/trino/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to Trino. It should have enough privileges to read all the metadata.
- **Auth Config**: User can authenticate the Trino Instance with auth type as `Basic Authentication` i.e. Password **or** by using `JWT Authentication`.
  - **Basic Auth**:
    - **Password**: Password to connect to Trino.
  - **JWT Auth Config**:
    - **JWT**: JWT can be used to authenticate with trino. Follow the steps in the [official trino](https://trino.io/docs/current/security/jwt.html) documentation to setup trino with jwt.
  - **Azure**: 
    - **Client ID**: To get the Client ID (also known as application ID), follow these steps:
        1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
        2. Search for `App registrations` and select the `App registrations link`.
        3. Select the `Azure AD` app you're using for Trino.
        4. From the Overview section, copy the `Application (client) ID`.
    - **Client Secret**: To get the client secret, follow these steps:
        1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
        2. Search for `App registrations` and select the `App registrations link`.
        3. Select the `Azure AD` app you're using for Trino.
        4. Under `Manage`, select `Certificates & secrets`.
        5. Under `Client secrets`, select `New client secret`.
        6. In the `Add a client secret` pop-up window, provide a description for your application secret. Choose when the application should expire, and select `Add`.
        7. From the `Client secrets` section, copy the string in the `Value` column of the newly created application secret.
    - **Tenant ID**: To get the tenant ID, follow these steps:
        1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
        2. Search for `App registrations` and select the `App registrations link`.
        3. Select the `Azure AD` app you're using for Trino.
        4. From the `Overview` section, copy the `Directory (tenant) ID`.
    - **Scopes**: To let OM use the Trino Auth APIs using your Azure AD app, you'll need to add the scope
        1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
        2. Search for `App registrations` and select the `App registrations link`.
        3. Select the `Azure AD` app you're using for Trino.
        4. From the `Expose an API` section, copy the `Application ID URI`
        5. Make sure the URI ends with `/.default` in case it does not, you can append the same manually
- **Host and Port**: Enter the fully qualified hostname and port number for your Trino deployment in the Host and Port field.
- **Catalog**: Trino offers a catalog feature where all the databases are stored.
- **DatabaseSchema**: DatabaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **proxies**: Proxies for the connection to Trino data source
- **params**: URL parameters for connection to the Trino data source
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Trino during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Trino during the connection. These details must be added as Key-Value pairs. 
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`


**SSL Configuration**

In order to integrate SSL in the Metadata Ingestion Config, the user will have to add the SSL config under **connectionArguments** which is placed in source.

**SSL Modes**
There are a couple of types of SSL modes that redshift supports which can be added to ConnectionArguments, they are as follows:
- **false**: In order to disable SSL verification, set the `verify` parameter to `False`.
- **\<path-to-crt\>**: To use self-signed certificates, specify a path to the certificate in `verify` parameter.
Find more details in [the Python requests library documentation](https://requests.readthedocs.io/en/latest/user/advanced.html?highlight=ssl#ssl-cert-verification).

{% partial file="/v1.10/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.10/connectors/test-connection.md" /%}

{% partial file="/v1.10/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.10/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.10/connectors/database/related.md" /%}
