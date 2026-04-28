# Redpanda

In this section, we provide guides and references to use the Redpanda connector.

## Requirements
Connecting to Redpanda does not require any previous configuration.

$$note
Note that the ingestion of the Redpanda topics' schema is done separately by configuring the **Schema Registry URL**. However, only the **Bootstrap Servers** information is mandatory to extract basic metadata.
$$
You can find further information on the Redpanda connector in the <a href="https://docs.open-metadata.org/connectors/messaging/redpanda" target="_blank">docs</a>.

## Kafka Connect Lineage

Redpanda is wire-compatible with Apache Kafka, so the existing **Kafka Connect** pipeline connector works with Redpanda out of the box. If you have Kafka Connect sink connectors running against Redpanda (e.g., JDBC Sink, BigQuery Sink, S3 Sink), you can set up a Kafka Connect pipeline in OpenMetadata to automatically extract topic-to-table lineage.

To configure this:
1. Set up a Redpanda messaging service in OpenMetadata (this connector)
2. Set up a **Kafka Connect** pipeline service, pointing to your Kafka Connect REST API
3. The pipeline connector will automatically detect sink connectors and create lineage from Redpanda topics to destination tables

## Connection Details

$$section
### Bootstrap Servers $(id="bootstrapServers")

List of brokers as comma separated values of broker `host` or `host:port`. E.g., `host1:9092,host2:9092`
$$

$$section
### Schema Registry URL $(id="schemaRegistryURL")

URL of the Schema Registry used to ingest the schemas of the topics.

**NOTE**: For now, the schema will be the last version found for the schema name `{topic-name}-value`. An <a href="https://github.com/open-metadata/OpenMetadata/issues/10399" target="_blank">issue</a> to improve how it currently works has been opened.
$$

$$section
### Security Protocol $(id="securityProtocol")

Security Protocol used in bootstrap server.

Supported:
`PLAINTEXT`: Un-authenticated, non-encrypted channel
`SASL_PLAINTEXT`: SASL authenticated, non-encrypted channel
`SASL_SSL`: SASL authenticated, SSL channel
`SSL`: SSL channel
$$

$$section
### SASL Username $(id="saslUsername")

SASL username for use with the PLAIN and SASL-SCRAM mechanisms.
$$

$$section
### SASL Password $(id="saslPassword")

SASL password for use with the PLAIN and SASL-SCRAM mechanisms.
$$

$$section
### SASL Mechanism $(id="saslMechanism")

SASL mechanism to use for authentication.

Supported: `GSSAPI`, `PLAIN`, `SCRAM-SHA-256`, `SCRAM-SHA-512`, `OAUTHBEARER`.

**NOTE**: Only one mechanism must be configured.
$$

$$section
### Schema Registry Basic Auth User Info $(id="basicAuthUserInfo")

Schema Registry Client HTTP credentials in the form of `username:password`.

By default, user info is extracted from the URL if present.
$$

$$section
### Consumer Config $(id="consumerConfig")

The accepted additional values for the consumer configuration can be found in the following <a href="https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md" target="_blank">link</a>.
$$

$$section
### Schema Registry Config $(id="schemaRegistryConfig")

The accepted additional values for the Schema Registry configuration can be found in the following <a href="https://docs.confluent.io/5.5.1/clients/confluent-kafka-python/index.html#confluent_kafka.schema_registry.SchemaRegistryClient" target="_blank">link</a>.
$$

$$section
### Consumer Config SSL $(id="consumerConfigSSL")

SSL configuration for the Kafka consumer connection used by Redpanda. Configure CA certificate, client certificate, and private key for mTLS authentication.
$$

$$section
### Schema Registry SSL $(id="schemaRegistrySSL")

SSL configuration for the Schema Registry connection used by Redpanda. Configure CA certificate, client certificate, and private key for mTLS authentication.
$$

$$section
### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation.
$$

$$section
### SSL Certificate $(id="sslCertificate")
The SSL certificate used for client authentication.
$$

$$section
### SSL Key $(id="sslKey")
The private key associated with the SSL certificate.
$$

$$section
### Redpanda Admin API URL $(id="redpandaAdminApiUrl")

URL of the Redpanda Admin API, typically running on port 9644. When configured, OpenMetadata will extract data transform metadata to create topic-to-topic lineage. E.g., `http://localhost:9644`
$$

$$section
### Admin API SSL $(id="adminApiSSL")

SSL configuration for the Redpanda Admin API connection. Use this when the Admin API is exposed over HTTPS with a custom CA or mutual TLS. Provide the CA certificate to validate the server certificate, and optionally the client certificate and private key for mTLS authentication.
$$
