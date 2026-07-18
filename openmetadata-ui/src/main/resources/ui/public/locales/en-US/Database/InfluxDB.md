# InfluxDB
In this section, we provide guides and references to use the InfluxDB 3 connector. You can view the full documentation for InfluxDB <a href="https://docs.open-metadata.org/connectors/database/influxdb" target="_blank">here</a>.

## Requirements
To extract metadata, the user needs a valid API token with read access to the InfluxDB 3 instance. The connector uses the InfluxDB 3 HTTP SQL API (`/api/v3/query_sql`) for metadata introspection.

You can find further information on the InfluxDB connector in the <a href="https://docs.open-metadata.org/connectors/database/influxdb" target="_blank">here</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")

This parameter specifies the HTTP API endpoint of the InfluxDB 3 instance. This should be specified as a URL string. For example, you might set the hostPort parameter to `https://cluster.influxdata.com` for InfluxDB Cloud, or `http://localhost:8086` for a local instance.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:8086` as the value.
$$

$$section
### API Token $(id="token")

API token to authenticate with InfluxDB 3. This token must have read access to the databases and tables you want to ingest metadata from. You can generate tokens in the InfluxDB UI under Load Data > Tokens.
$$

$$section
### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of InfluxDB, the instance is mapped to the Database level. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$

$$section
### Database Schema $(id="databaseSchema")
This is an optional parameter. When set, the value will be used to restrict the metadata reading to a single InfluxDB database (corresponding to the value passed in this field). When left blank, OpenMetadata will scan all the databases available to the user.
$$
