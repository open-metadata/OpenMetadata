# Trino

In this section, we provide guides and references to use the Trino connector. You can view the full documentation for Trino <a href="https://docs.open-metadata.org/connectors/database/trino" target="_blank">here</a>.

## Requirements
To extract metadata, the user needs to have `SELECT` permission on the following tables:
- `information_schema.schemata`
- `information_schema.columns`
- `information_schema.tables`
- `information_schema.views`
- `system.metadata.table_comments`

Access to resources will be based on the user access permission to access specific data sources. More information regarding access and security can be found in the Trino documentation <a href="https://trino.io/docs/current/security.html" target="_blank">here</a>.

### Profiler & Data Quality
Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

You can find further information on the Trino connector in the <a href="https://docs.open-metadata.org/connectors/database/trino" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.
$$

$$section
### Username $(id="username")
Username to connect to Trino. This user should have `SELECT` permission on the `SYSTEM.METADATA` and `INFORMATION_SCHEMA` - see the section above for more details.
$$

### Auth Config $(id="authType")
There are 2 types of auth configs:
- Basic Auth.
- JWT Auth.

User can authenticate the Trino Instance with auth type as `Basic Authentication` i.e. Password **or** by using `JWT Authentication`.


## Basic Auth

$$section
### Password $(id="password")
Password to connect to Trino.
$$

## JWT Auth Config

$$section
### JWT $(id="jwt")
JWT can be used to authenticate with trino.
Follow the steps in the <a href="https://trino.io/docs/current/security/jwt.html" target="_blank">official trino</a> documentation to setup trino with jwt.

$$

## Azure

$$section
### Client ID $(id="clientId")

To get the Client ID (also known as application ID), follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Trino.
4. From the Overview section, copy the `Application (client) ID`.

$$

$$section
### Client Secret $(id="clientSecret")
To get the client secret, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Trino.
4. Under `Manage`, select `Certificates & secrets`.
5. Under `Client secrets`, select `New client secret`.
6. In the `Add a client secret` pop-up window, provide a description for your application secret. Choose when the application should expire, and select `Add`.
7. From the `Client secrets` section, copy the string in the `Value` column of the newly created application secret.

$$

$$section
### Tenant ID $(id="tenantId")

To get the tenant ID, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Trino.
4. From the `Overview` section, copy the `Directory (tenant) ID`.
$$

$$section
### Scopes $(id="Scopes")

To let OM use the Trino Auth APIs using your Azure AD app, you'll need to add the scope
1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Trino.
4. From the `Expose an API` section, copy the `Application ID URI`
5. Make sure the URI ends with `/.default` in case it does not, you can append the same manually
$$

$$section
### Host Port $(id="hostPort")
This parameter specifies the host and port of the Trino instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:8080`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:8080` as the value.
$$

$$section
### Catalog $(id="catalog")
Catalog of the data source. 
$$

$$section
### Database Schema $(id="databaseSchema")
This is an optional parameter. When set, the value will be used to restrict the metadata reading to a single database (corresponding to the value passed in this field). When left blank, OpenMetadata will scan all the databases.
$$

$$section
### Proxies $(id="proxies")
Proxies for the connection to Trino data source
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
