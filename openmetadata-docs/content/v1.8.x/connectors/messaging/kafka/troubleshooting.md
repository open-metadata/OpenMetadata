---
title: Kafka Connector Troubleshooting
slug: /connectors/messaging/kafka/troubleshooting
---

# Troubleshooting

{% partial file="/v1.8/connectors/troubleshooting.md" /%}

## Consumer and schema registry config

When configuring the Kafka connector, we could need to pass extra parameters to the consumer or the schema registry to
be able to connect. The accepted values for the consumer can be found in the following
[link](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md), while the ones optional for
the schema registry are [here](https://docs.confluent.io/platform/current/clients/confluent-kafka-python/html/index.html#schemaregistryclient).

If you encounter issues connecting to the Schema Registry, ensure that the protocol is explicitly specified in the Schema Registry URL. For example:
- Use `http://localhost:8081` instead of `localhost:8081`.
The Schema Registry requires a properly formatted URL, including the protocol (`http://` or `https://`). While this differentiation is expected in the Schema Registry configuration, it may not be immediately apparent.

In case you are performing the ingestion through the CLI with a YAML file, the service connection config should look
like this:

```yaml
  serviceConnection:
    config:
      type: Kafka
      bootstrapServers: localhost:9092
      schemaRegistryURL: http://localhost:8081
      schemaRegistryTopicSuffixName: "suffix-name"
      consumerConfig:
        "ssl.truststore.password": "password"
      schemaRegistryConfig:
        "basic.auth.user.info": "username:password"
```

## Connecting to Confluent Cloud Kafka

If you are using Confluent kafka and SSL encryption is enabled you need to add `security.protocol` as key and `SASL_SSL` as value under Consumer Config
