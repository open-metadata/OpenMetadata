# PinotDB

In this section, we provide guides and references to use the PinotDB connector.

## Requirements

You can find further information on the PinotDB connector in the [docs](https://docs.open-metadata.org/connectors/database/pinotdb).

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

username to connect to the PinotDB. This user should have privileges to read all the metadata in PinotDB.
$$

$$section
### Password $(id="password")

password to connect to the PinotDB.
$$

$$section
### Pinot Broker Host Port $(id="hostPort")

This parameter specifies the host and port of the PinotDB instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:8099`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:8099` as the value.
$$

$$section
### Pinot Controller Host $(id="pinotControllerHost")

Pinot Controller Host and Port of the data source. Unlike broker host, prefix http:// or https:// must be added to controller host. For example, you can set it to `http://localhost:9000`
$$

$$section
### Database $(id="database")

Database of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, the OpenMetadata Ingestion attempts to scan all the databases.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
