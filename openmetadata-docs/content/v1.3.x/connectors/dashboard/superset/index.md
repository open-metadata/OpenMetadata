---
title: Superset
slug: /connectors/dashboard/superset
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

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/superset/yaml"} /%}

## Requirements

The ingestion also works with Superset 2.0.0 🎉

**API Connection**: To extract metadata from Superset via API, user must have at least `can read on Chart` & `can read on Dashboard` permissions.

**Database Connection**: To extract metadata from Superset via MySQL or Postgres database, database user must have at least `SELECT` privilege on `dashboards` & `slices` tables within superset schema.

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Superset", 
    selectServicePath: "/images/v1.3/connectors/superset/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/superset/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/superset/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: The `Host and Post` parameter is common for all three modes of authentication which specifies the host and port of the Superset instance. This should be specified as a string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set the hostPort parameter to `https://org.superset.com:8088`.

- **Superset Connection**: Add the connection details to fetch metadata from Superset either through APIs or Database.

##### For Superset API Connection

Superset API connection is the default mode of authentication where we fetch the metadata using [Superset APIs](https://superset.apache.org/docs/api/). 

{% note %}
Superset only supports basic or ldap authentication through APIs so if you have SSO enabled on your Superset instance then this mode of authentication will not work for you and you can opt for MySQL or Postgres Connection to fetch metadata directly from the database in the backend of Superset.
{% /note %}

- **Username**: Username to connect to Superset, for ex. `user@organization.com`. This user should have access to relevant dashboards and charts in Superset to fetch the metadata.
- **Password**: Password of the user account to connect with Superset.
- **Provider**: Choose between `db`(default) or `ldap` mode of Authentication provider for the Superset service. This parameter is used internally to connect to Superset's REST API.
- **Verify SSL**:
Client SSL verification. Make sure to configure the SSLConfig if enabled.
Possible values:
  * `validate`: Validate the certificate using the public certificate (recommended).
  * `ignore`: Ignore the certification validation (not recommended for production).
  * `no-ssl`: SSL validation is not needed.

- **SSL Config**: Client SSL configuration in case we are connection to a host with SSL enabled.

- **Certificate Path**: CA certificate path in the instance where the ingestion run. E.g., `/path/to/public.cert`. Will be used if Verify SSL is set to `validate`.

#### For MySQL Connection

You can use Mysql Connection when you have SSO enabled and your Superset is backed by Mysql database.

- **Username**: Specify the User to connect to MySQL. It should have enough privileges to read all the metadata. Make sure the user has select privileges on `dashboards`, `tables` & `slices` tables of superset schema.
- **Password**: Password to connect to MySQL.
- **Host and Port**: Enter the fully qualified hostname and port number for your MySQL deployment in the Host and Port field.
- **databaseSchema**: Enter the database schema which is associated with the Superset instance..

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

#### For Postgres Connection

You can use Postgres Connection when you have SSO enabled and your Superset is backed by Postgres database.

- **Username**: Specify the User to connect to Postgres. Make sure the user has select privileges on `dashboards`, `tables` & `slices` tables of superset schema.
- **Password**: Password to connect to Postgres.
- **Host and Port**: Enter the fully qualified hostname and port number for your Postgres deployment in the Host and Port field.
- **Database**: Initial Postgres database to connect to. Specify the name of database associated with Superset instance.

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
