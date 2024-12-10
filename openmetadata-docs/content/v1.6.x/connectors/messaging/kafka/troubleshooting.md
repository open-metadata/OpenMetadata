---
title: Kafka Connector Troubleshooting
slug: /connectors/messaging/kafka/troubleshooting
---

# Troubleshooting

## Consumer and schema registry config

When configuring the Kafka connector, we could need to pass extra parameters to the consumer or the schema registry to
be able to connect. The accepted values for the consumer can be found in the following
[link](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md), while the ones optional for
the schema registry are [here](https://docs.confluent.io/platform/current/clients/confluent-kafka-python/html/index.html#schemaregistryclient).

The image below shows what the configuration of a local Kafka server with a secured schema registry would look like:

{% image
src="/images/v1.6/connectors/kafka/kafka-config.png"
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

## Connecting to Confluent Cloud Kafka

If you are using Confluent kafka and SSL encryption is enabled you need to add `security.protocol` as key and `SASL_SSL` as value under Consumer Config
