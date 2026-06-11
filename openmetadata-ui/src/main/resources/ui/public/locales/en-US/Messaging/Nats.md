# NATS

In this section, we provide guides and references to use the NATS connector.

## Requirements

Connecting to NATS requires **JetStream to be enabled** on the server. Start your NATS server with the `-js` flag or set `jetstream: enabled` in the server configuration.

$$note
Only **JetStream streams** are ingested as OpenMetadata Topics. Core NATS subjects (without JetStream) cannot be listed via the API and are therefore not supported.
$$

$$note
Schema ingestion is optional and relies on a **JetStream KV bucket** where keys match stream names and values contain the schema text (Avro JSON, JSON Schema, or Protobuf). Configure `Schema KV Bucket` to enable it.
$$

## Connection Details

$$section
### NATS Servers $(id="natsServers")

Comma-separated list of NATS server URLs. Each URL should include the protocol and port.

Example: `nats://host1:4222,nats://host2:4222`

For TLS connections use: `tls://host1:4222`
$$

$$section
### JetStream Enabled $(id="jetStreamEnabled")

Enable JetStream to ingest streams as OpenMetadata Topics.

When enabled, the connector uses the JetStream management API (`$JS.API.*`) to list streams, fetch stream configuration and state, and optionally retrieve schemas from a KV bucket.

Disable only if you want to test basic connectivity without ingesting any topics.
$$

$$section
### Username $(id="username")

Username for NATS basic authentication (`user:password`).

Must be used together with **Password**. Leave empty if using Token or NKey authentication.
$$

$$section
### Password $(id="password")

Password for NATS basic authentication.

Must be used together with **Username**.
$$

$$section
### Token $(id="token")

Token for NATS token-based authentication.

Cannot be combined with Username/Password or NKey authentication.
$$

$$section
### NKey Seed $(id="nkeySeed")

NKey seed (starting with `SU`) for NATS NKey-based authentication.

NKeys provide cryptographic authentication without sending credentials over the wire. Generate a key pair with the [nkeys](https://github.com/nats-io/nkeys) tool.
$$

$$section
### TLS Configuration $(id="tlsConfig")

TLS/SSL configuration for encrypted NATS connections.

Required when the server is configured with TLS (`tls://` URLs). Provide the CA certificate at minimum; client certificates are only needed for mutual TLS (mTLS).
$$

$$section
### CA Certificate $(id="caCertificate")

The CA certificate (PEM format) used to verify the NATS server's TLS certificate.
$$

$$section
### SSL Certificate $(id="sslCertificate")

The client certificate (PEM format) used for mutual TLS (mTLS) authentication.
$$

$$section
### SSL Key $(id="sslKey")

The private key (PEM format) associated with the client SSL certificate.
$$

$$section
### Additional NATS Config $(id="additionalConfig")

Additional NATS client configuration options passed directly to the `nats.connect()` call.

See the full list of options in the <a href="https://nats-io.github.io/nats.py/" target="_blank">nats.py documentation</a>.
$$

$$section
### Schema KV Bucket $(id="schemaKvBucket")

Name of the JetStream KV bucket where stream schemas are stored.

Each key in the bucket must match a stream name exactly. Values should contain the raw schema text in one of the supported formats:
- **Avro**: JSON with `{"type": "record", ...}` at the root
- **JSON Schema**: JSON with `$schema` or `properties` at the root
- **Protobuf**: Text starting with `syntax = "proto3";` or `syntax = "proto2";`

Leave empty to skip schema ingestion.
$$

$$section
### Topic Filter Pattern $(id="topicFilterPattern")

Regular expression patterns to include or exclude streams from ingestion.

- **Includes**: only streams matching these patterns are ingested
- **Excludes**: streams matching these patterns are skipped

Leave empty to ingest all streams.
$$
