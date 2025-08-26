# AlationSink

In this section, we provide guides and references to use the Alation Sink connector.

The connector will ingest data from OpenMetadata into Alation.

## Requirements
The connector uses `POST` requests to write the data into Alation.
Hence, an user credentials or an access token with `Source Admin` or `Catalog Admin` or `Server Admin` permissions will be required.

## Connection Details

$$section
### Host Port $(id="hostPort")

Host and port of the Alation service.
$$

$$section
### Authentication Type $(id="authType")

Following authentication types are supported:

1. Basic Authentication: We'll use the user credentials to generate the access token required to authenticate Alation APIs.
- username: Username of the user.
- password: Password of the user.

2. Access Token Authentication: The access token created using the steps mentioned <a href="https://developer.alation.com/dev/docs/authentication-into-alation-apis#create-via-ui" target="_blank">here</a> can directly be entered. We'll use that directly to authenticate the Alation APIs
- accessToken: Generated access token
$$

$$section
### Project Name $(id="projectName")

Project name to create the refreshToken. Can be anything.
$$


$$section
### Pagination Limit $(id="paginationLimit")

Pagination limit used for Alation APIs pagination
$$

$$section
### DataSource Links $(id="datasourceLinks")

Add a custom mapping between OpenMetadata databases and Alation DataSources.
If this mapping is present the connector will only look for the datasource in Alation to create other entities inside it. It will not create the datasource in Alation and it'll need to be created beforehand.

The mapping needs to be of the format `alation_datasource_id: openmetadata database fqn`

Below is an example of the mapping:
```yaml
datasourceLinks: {
    "23": "sample_data.ecommerce_db",
    "15": "mysql_prod.customers_db",
}
```
$$


$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
