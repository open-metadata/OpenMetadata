---
title: MySQL
slug: /connectors/database/mysql
---

{% connectorDetailsHeader
name="MySQL"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "View Lineage", "View Column-level Lineage", "Query Usage"]
unavailableFeatures=["Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the MySQL connector.

Configure and schedule MySQL metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Enable Security](#securing-mysql-connection-with-ssl-in-openmetadata)

{% partial file="/v1.5/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/mysql/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/mysql/connections) user credentials with the MySQL connector.

## Requirements

### Metadata
Note that We support MySQL (version 8.0.0 or greater) and the user should have access to the `INFORMATION_SCHEMA` table.  By default a user can see only the rows in the `INFORMATION_SCHEMA` that correspond to objects for which the user has the proper access privileges.

```SQL
-- Create user. If <hostName> is omitted, defaults to '%'
-- More details https://dev.mysql.com/doc/refman/8.0/en/create-user.html
CREATE USER '<username>'[@'<hostName>'] IDENTIFIED BY '<password>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a specific object
GRANT SELECT ON world.hello TO '<username>';
```

### Lineage & Usage 
To extract lineage & usage you need to enable the query logging in mysql and the user used in the connection needs to have select access to the `mysql.general_log`.

```sql
-- Enable Logging 
SET GLOBAL general_log='ON';
set GLOBAL log_output='table';

-- Grant SELECT on log table
GRANT SELECT ON mysql.general_log TO '<username>'@'<host>';
```

### Profiler & Data Quality
Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](/how-to-guides/data-quality-observability/quality).

## Metadata Ingestion

{% partial 
  file="/v1.5/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "MySQL", 
    selectServicePath: "/images/v1.5/connectors/mysql/select-service.png",
    addNewServicePath: "/images/v1.5/connectors/mysql/add-new-service.png",
    serviceConnectionPath: "/images/v1.5/connectors/mysql/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.5/connectors/test-connection.md" /%}

{% partial file="/v1.5/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.5/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing MySQL Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and MySQL, navigate to the `Advanced Config` section. Here, you can provide the CA certificate used for SSL validation by specifying the `caCertificate`.  Alternatively, if both client and server require mutual authentication, you'll need to use all three parameters: `ssl_key`, `ssl_cert`, and `ssl_ca`. In this case, `ssl_cert` is used for the client’s SSL certificate, `ssl_key` for the private key associated with the SSL certificate, and `ssl_ca` for the CA certificate to validate the server’s certificate.

{% image
  src="/images/v1.5/connectors/ssl_connection.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.5/connectors/troubleshooting.md" /%}

{% partial file="/v1.5/connectors/database/related.md" /%}
