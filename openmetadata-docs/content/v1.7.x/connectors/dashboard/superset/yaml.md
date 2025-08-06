---
title: Run the Superset Connector Externally
description: Configure `brandName`'sApache Superset connector with YAML. Step-by-step setup guide for dashboard metadata integration and automated discovery.
slug: /connectors/dashboard/superset/yaml
---

{% connectorDetailsHeader
name="Superset"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Dashboards", "Charts", "Lineage", "Owners", "Datamodels"]
unavailableFeatures=["Tags", "Projects"]
/ %}

In this section, we provide guides and references to use the Superset connector.

Configure and schedule Superset metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Enable Security](#securing-superset-connection-with-ssl-in-openmetadata)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

The ingestion also works with Superset 2.0.0 🎉

**Note:**

**API Connection**: To extract metadata from Superset via API, user must have at least `can read on Chart` & `can read on Dashboard` permissions.

**Database Connection**: To extract metadata from Superset via MySQL or Postgres database, database user must have at least `SELECT` privilege on `dashboards` & `slices` tables within superset schema.

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the Superset ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[superset]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/supersetConnection.json)
you can find the structure to create a connection to Superset.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Superset:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: The `Host and Post` parameter is common for all three modes of authentication which specifies the host and port of the Superset instance. This should be specified as a string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set the hostPort parameter to `https://org.superset.com:8088`.

**connection**: Add the connection details to fetch metadata from Superset either through APIs or Database.

#### For Superset API Connection:

Superset API connection is the default mode of authentication where we fetch the metadata using [Superset APIs](https://superset.apache.org/docs/api/). 

**Note**:
Superset only supports basic or ldap authentication through APIs so if you have SSO enabled on your Superset instance then this mode of authentication will not work for you and you can opt for MySQL or Postgres Connection to fetch metadata directly from the database in the backend of Superset.


**username**: Username to connect to Superset, for ex. `user@organization.com`. This user should have access to relevant dashboards and charts in Superset to fetch the metadata.

**password**: Password of the user account to connect with Superset.

**provider**: Choose between `db`(default) or `ldap` mode of Authentication provider for the Superset service. This parameter is used internally to connect to Superset's REST API.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

#### For MySQL Connection:
You can use Mysql Connection when you have SSO enabled and your Superset is backed by Mysql database.

**username**: Specify the User to connect to MySQL. It should have enough privileges to read all the metadata. Make sure the user has select privileges on `dashboards`, `tables` & `slices` tables of superset schema.

**password**: Password to connect to MySQL.

**hostPort**: Enter the fully qualified hostname and port number for your MySQL deployment in the Host and Port field.

- **databaseSchema**: Enter the database schema which is associated with the Superset instance..

- **caCertificate**: Provide the path to ssl ca file.

- **sslCertificate**: Provide the path to ssl client certificate file (ssl_cert).

- **sslKey**: Provide the path to ssl client certificate file (ssl_key).

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to MySQL during the connection. These details must be added as Key-Value pairs.

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to MySQL during the connection. These details must be added as Key-Value pairs. 
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`


{% /codeInfo %}

{% codeInfo srNumber=3 %}

#### For Postgres Connection:

You can use Postgres Connection when you have SSO enabled and your Superset is backed by Postgres database.

- **username**: Specify the User to connect to Postgres. Make sure the user has select privileges on `dashboards`, `tables` & `slices` tables of superset schema.

**password**: Password to connect to Postgres.

**hostPort**: Enter the fully qualified hostname and port number for your Postgres deployment in the Host and Port field.

- **database**: Initial Postgres database to connect to. Specify the name of database associated with Superset instance.

- **caCertificate**: Provide the path to ssl ca file.

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Postgres during the connection. These details must be added as Key-Value pairs.

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Postgres during the connection. These details must be added as Key-Value pairs. 
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`


{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/dashboard/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: superset
  serviceName: local_superset
  serviceConnection:
    config:
      type: Superset
```
```yaml {% srNumber=1 %}
      hostPort: http://localhost:8088
      connection:
        # For Superset API Connection
        username: admin
        password: admin
        provider: db # or provider: ldap

```
```yaml {% srNumber=2 %}
        # For MySQL Connection
        # type: Mysql
        # username: <username>
        # authType:
        #   password: <password>
        # hostPort: <hostPort>
        # databaseSchema: superset

```
```yaml {% srNumber=3 %}
        # For Postgres Connection
        # type: Postgres
        # username: username
        # authType:
        #   password: <password>
        # hostPort: localhost:5432
        # database: superset
```

{% partial file="/v1.7/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

## Securing Superset Connection with SSL in OpenMetadata

1. To establish secure connections between OpenMetadata and Superset, in the `YAML` under `sslConfig`, we need to add `caCertificate` and update the certificate path. Ensure that the certificates are accessible from the Airflow Server.

```yaml
    sslConfig:
      caCertificate: /path/to/cacert.crt
```

2. To establish secure connections between OpenMetadata and Superset's MySQL database, you need to configure SSL certificates appropriately. If you only require SSL validation, specify the `caCertificate` to use the CA certificate for validating the server's certificate. For mutual authentication, where both client and server need to authenticate each other, you must provide all three parameters: `ssl_key` for the client’s private key, `ssl_cert` for the client’s SSL certificate, and `ssl_ca` for the CA certificate to validate the server’s certificate.

```yaml
        type: Mysql
          sslConfig:
            caCertificate: "/path/to/ca_certificate"
            sslCertificate: "/path/to/your/ssl_cert"
            sslKey: "/path/to/your/ssl_key"
```

3. To establish secure connxxwections between OpenMetadata and Superset's PostgreSQL database, you can configure SSL using different SSL modes provided by PostgreSQL, each offering varying levels of security.Under `PostgresConnection Advanced Config`, specify the SSL mode appropriate for your connection, such as `prefer`, `verify-ca`, `allow`, and others. After selecting the SSL mode, provide the CA certificate used for SSL validation (`caCertificate`). Note that PostgreSQL requires only the CA certificate for SSL validation.

```yaml

        type: Postgres
          sslMode: disable #allow prefer require verify-ca verify-full
          sslConfig:
            caCertificate: "/path/to/ca/certificate" 
```

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}
