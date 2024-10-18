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
### SSL/TLS Settings $(id="tls")
Mode/setting for SSL validation:

#### validate-certificate (**default**)
Uses Transport Layer Security (TLS) and validates the server certificate using system certificate stores.

#### ignore-certificate
Uses Transport Layer Security (TLS) but disables the validation of the server certificate. This should not be used in production. It can be useful during testing with self-signed certificates.

#### disable-tls
Does not use any Transport Layer Security (TLS). Data will be sent in plain text (no encryption).
While this may be helpful in rare cases of debugging, make sure you do not use this in production.

