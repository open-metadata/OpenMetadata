# Redpanda

In this section, we provide guides and references to use the Redpanda connector.

# Requirements
Connecting to Redpanda does not require any previous configuration.

Just to remind you, the ingestion of the Redpanda topics schema is done separately by configuring the **Schema Registry URL**. However, only the **Bootstrap Servers** information is mandatory.

You can find further information on the Redpanda connector in the [docs](https://docs.open-metadata.org/connectors/messaging/redpanda).

## Connection Details

### Bootstrap Servers $(id="bootstrapServers")

List of brokers as comma separated values of broker `host` or `host:port`.

Example: `host1:9092,host2:9092`

### Schema Registry URL $(id="schemaRegistryURL")

URL of the Schema Registry used to ingest the schemas of the topics.

**NOTE**: For now, the schema will be the last version found for the schema name `{topic-name}-value`. An [issue](https://github.com/open-metadata/OpenMetadata/issues/10399) to improve how it currently works has been opened.

### Sasl Username $(id="saslUsername")

SASL username for use with the PLAIN and SASL-SCRAM mechanisms.

### Sasl Password $(id="saslPassword")

SASL password for use with the PLAIN and SASL-SCRAM mechanisms.

### Sasl Mechanism $(id="saslMechanism")

SASL mechanism to use for authentication. 

Supported: _GSSAPI, PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, OAUTHBEARER_. 

**NOTE**: Despite the name only one mechanism must be configured.

### Basic Auth User Info $(id="basicAuthUserInfo")

Schema Registry Client HTTP credentials in the form of `username:password`.

By default userinfo is extracted from the URL if present.

### Consumer Config $(id="consumerConfig")

The accepted additional values for the consumer configuration can be found in the following [link](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md).

### Schema Registry Config $(id="schemaRegistryConfig")

The accepted additional values for the Schema Registry configuration can be found in the following [link](https://docs.confluent.io/5.5.1/clients/confluent-kafka-python/index.html#confluent_kafka.schema_registry.SchemaRegistryClient).

