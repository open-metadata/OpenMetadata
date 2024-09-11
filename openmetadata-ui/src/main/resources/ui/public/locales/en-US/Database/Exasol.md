# Exasol

In this section, we provide guides and references for using the Exasol connector.

## Requirements

* Exasol >= 7.1

## Connection Details

$$section
### Connection Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

Username to connect to Exasol. This user should have privileges to read all the metadata in Exasol.
$$

$$section
### Password $(id="password")

Password of the user connecting to Exasol.
$$

$$section
### Host and Port $(id="hostPort")

This parameter specifies the host and port of the Exasol instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:8563`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:8563` as the value.
$$

$$section
### Verify SSL $(id="verifySSL")
Mode/setting for ssl validation:

* no-ssl
* ignore
* validate

$$section
### SSL Mode $(id="sslMode")

SSL Mode to connect to the Exasol database:

* disable
* allow
* prefer
* require
* verify-ca
* verify-full

$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$
