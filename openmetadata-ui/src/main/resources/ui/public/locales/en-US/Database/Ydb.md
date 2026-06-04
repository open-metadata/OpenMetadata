# YDB

In this section, we provide guides and references to use the YDB connector.

## Requirements

YDB is an open-source distributed SQL database. OpenMetadata connects via the `ydb-sqlalchemy` driver using the gRPC transport.

The user (or service account) must have `ydb.databases.connect` permission on the target database. For anonymous access on a local YDB instance no credentials are required.

You can find further information on the YDB connector in the <a href="https://docs.open-metadata.org/connectors/database/ydb" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme. Always `yql+ydb` for YDB.
$$

$$section
### Protocol $(id="protocol")

Transport protocol for the YDB gRPC connection.

- `grpc` — plain-text, suitable for local or trusted-network deployments.
- `grpcs` — TLS-encrypted, required for production and any TLS-secured deployment. Pair with a CA Certificate when using a custom or self-signed CA.
$$

$$section
### Host and Port $(id="hostPort")

Host and port of the YDB endpoint. Examples:

- Local YDB: `localhost:2136`
- YC serverless: `ydb.serverless.example.com:2135`
$$

$$section
### Database $(id="database")

YDB database path. Examples:

- Local: `/local`
- YC: `/ru-central1/b1g.../etn...`
$$

$$section
### Auth Config $(id="authType")

Authentication mode for YDB. Five modes are supported:

| Mode | When to use |
|------|-------------|
| **Anonymous** | Local or dev YDB with no authentication |
| **Static Credentials** | Username + password |
| **Access Token** | Short-lived IAM token (e.g. `yc iam create-token`) |
| **Service Account Key (JSON)** | Service account JSON key file contents |
| **Metadata URL** | VM instance metadata (no explicit credentials) |
$$

## Static Credentials

$$section
### Username $(id="username")

Username for YDB static authentication.
$$

$$section
### Password $(id="password")

Password for YDB static authentication.
$$

## Access Token

$$section
### Access Token $(id="token")

IAM access token.
$$

## Service Account Key (JSON)

$$section
### Service Account JSON $(id="serviceAccountJson")

Full contents of a service account JSON key file. The key is stored encrypted.
$$

$$section
### CA Certificate $(id="caCertificate")

PEM-encoded CA certificate for TLS verification when using `grpcs`. Leave empty to use the system trust store. Required only when connecting to a server with a self-signed or private CA certificate.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

$$section
### Schema Filter Pattern $(id="schemaFilterPattern")

Regex to only include/exclude schemas that match the pattern. In YDB, schemas correspond to directory prefixes (e.g. `staging`, `marts/analytics`).
$$

$$section
### Table Filter Pattern $(id="tableFilterPattern")

Regex to only include/exclude tables that match the pattern.
$$
