---
title: Kafka Connector Troubleshooting
slug: /connectors/messaging/kafka/troubleshooting
---

# Troubleshooting

## Consumer and schema registry config

When configuring the Kafka connector, we could need to pass extra parameters to the consumer or the schema registry to
be able to connect. The accepted values for the consumer can be found in the following
[link](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md), while the ones optional for
the schema registry are [here](https://docs.confluent.io/5.5.1/clients/confluent-kafka-python/index.html#confluent_kafka.schema_registry.SchemaRegistryClient).

The image below shows what the configuration of a local Kafka server with a secured schema registry would look like:

{% image
src="/images/v1.0/connectors/kafka/kafka-config.png"
alt="Configuration of a local Kafka server with a secured schema registry"
caption="Configuration of a local Kafka server with a secured schema registry" /%}

In case you are performing the ingestion through the CLI with a YAML file, the service connection config should look
like this:

```yaml
  serviceConnection:
    config:
      type: Kafka
      bootstrapServers: localhost:9092
      schemaRegistryURL: http://localhost:8081
      consumerConfig:
        "ssl.truststore.password": "password"
      schemaRegistryConfig:
        "basic.auth.user.info": "username:password"
```