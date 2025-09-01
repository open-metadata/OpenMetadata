# OpenLineage

In this section, we provide guides and references to use the OpenLineage connector. You can view the full documentation <a href="https://docs.open-metadata.org/connectors/pipeline/openlineage" target="_blank">here</a>.

## Requirements

We ingest OpenLineage metadata by reading OpenLineage events from kafka topic 

## Connection Details

$$section
### Kafka brokers list $(id="brokersUrl")

OpenMetadata for reaching OpenLineage events connects to kafka brokers.

This should be specified as a broker:port list separated by commas in the format `broker:port`. E.g., `kafkabroker1:9092,kafkabroker2:9092`.


$$

$$section
### Kafka Topic name $(id="topicName")

OpenMetadata is reading OpenLineage events from certain kafka topic 

This should be specified as topic name string . E.g., `openlineage-events`.
$$

$$section
### Kafka consumer group name $(id="consumerGroupName")

Name of consumer kafka consumer group that will be used by OpenLineage kafka consumer

This should be specified as consumer group name string . E.g., `openmetadata-openlineage-consumer`.
$$

$$section
### Kafka initial consumer offsets $(id="consumerOffsets")
When new kafka consumer group is created an initial offset information is required.

This should be specified as `earliest` or `latest` .
$$
$$section
### Kafka single pool timeout $(id="poolTimeout")
This setting indicates how long connector should wait for new messages in single pool cal.

This should be specified as number of seconds represented as decimal number . E.g., `1.0`
$$

$$section
### Kafka session timeout  $(id="sessionTimeout")
This setting indicates how long connector should wait for new messages in kafka session.
After kafka session timeout is reached connector assumes that there is no new messages to be processed
and successfully ends an ingestion process .

This should be specified as number of seconds represented as integer number . E.g., `30` .
$$
$$section
### Kafka securityProtocol $(id="securityProtocol")
Kafka Security protocol config.

This should be specified as `PLAINTEXT`, `SSL`, or `SASL_SSL` .
$$

$$section
### Kafka SASL mechanism $(id="saslMechanism")
When Kafka security protocol is set to `SASL_SSL` then the SASL mechanism is needed.

This should be specified as `PLAIN` .
$$

$$section
### Kafka SASL username $(id="saslUsername")
When Kafka security protocol is set to `SASL_SSL` then the SASL username is needed.

This should be specified as a username or API key string .
$$

$$section
### Kafka SASL password $(id="saslPassword")
When Kafka security protocol is set to `SASL_SSL` then the SASL password is needed.

This should be specified as a password or API secret string .
$$

$$section
### Kafka SSL certificate location $(id="SSLCertificateLocation")
When Kafka security protocol is set to `SSL` then path to SSL certificate is needed.
Certificate have to be in PEM format  

This should be specified path to pem file . E.g., `/path/to/kafka/certificate.pem` .
$$

$$section
### Kafka SSL key location $(id="SSLKeyLocation")
When Kafka security protocol is set to `SSL` then path to SSL key is needed.
Key have to be in PEM format  

This should be specified path to pem file . E.g., `/path/to/kafka/key.pem` .
$$

$$section
### Kafka SSL CA location $(id="SSLCALocation")
When Kafka security protocol is set to `SSL` then path to SSL CA is needed.
CA have to be in PEM format  

This should be specified path to pem file . E.g., `/path/to/kafka/CA.pem` .
$$