# KafkaConnect
In this section, we provide guides and references to use the KafkaConnect connector.

## Requirements

OpenMetadata is integrated with kafkaconnect up to version <a href="https://docs.kafkaconnect.io/getting-started" target="_blank">3.6.1</a> and will continue to work for future kafkaconnect versions.

The ingestion framework uses <a href="https://libraries.io/pypi/kafka-connect-py" target="_blank">kafkaconnect python client</a> to connect to the kafkaconnect instance and perform the API calls.

You can find further information on the kafkaconnect connector in the <a href="https://docs.open-metadata.org/connectors/pipeline/kafkaconnect" target="_blank">docs</a>.

## Connection Details
$$section
### Host and Port $(id="hostPort")
Pipeline Service Management URI. This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:8083`, `http://host.docker.internal:8083`.
$$

$$section
### KafkaConnect Config $(id="KafkaConnectConfig")
OpenMetadata supports basic authentication (username/password)
`Optional`.
$$

$$section
### Username $(id="username")
Username to connect to KafkaConnect. This user should be able to send request to the KafkaConnect API.
$$

$$section
### Password $(id="password")
Password to connect to KafkaConnect.
$$

$$section
### Verify SSL $(id="verifySSL")
Whether SSL verification should be performed when authenticating.
$$

$$section
### Kafka Service Name $(id="messagingServiceName")
The Service Name of the Ingested [Kafka](/connectors/messaging/kafka#4.-name-and-describe-your-service) instance associated with this KafkaConnect instance.
$$
