# OpenLineage

In this section, we provide guides and references to use the OpenLineage connector. You can view the full documentation <a href="https://docs.open-metadata.org/connectors/pipeline/openlineage" target="_blank">here</a>.

## Requirements

We ingest OpenLineage metadata by reading OpenLineage events from a Kafka topic or an AWS Kinesis Data Stream. Select the broker type and fill in the corresponding fields below.

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
### Initial consumer offsets $(id="consumerOffsets")
The initial offset to start reading events from when no committed offset exists.

For **Kafka**, this should be specified as `earliest` or `latest`.

For **Kinesis**, this should be specified as `TRIM_HORIZON` (start from the oldest available record) or `LATEST` (read only new records).
$$
$$section
### Single poll timeout $(id="poolTimeout")
This setting indicates how long the connector should wait for new messages in a single poll call (Kafka) or between read calls (Kinesis).

This should be specified as a number of seconds represented as a decimal number. E.g., `1.0`.
$$

$$section
### Session timeout  $(id="sessionTimeout")
This setting indicates how long the connector should wait for new messages before assuming there are no more messages to be processed and successfully ending the ingestion process.

This should be specified as a number of seconds represented as an integer number. E.g., `30` .
$$
$$section
### Kafka securityProtocol $(id="securityProtocol")
Kafka Security protocol config.

This should be specified as `PLAINTEXT`, `SASL_PLAINTEXT`, `SSL`, or `SASL_SSL` .
$$

$$section
### Kafka SASL mechanism $(id="saslMechanism")
When Kafka security protocol is set to `SASL_PLAINTEXT` or `SASL_SSL` then the SASL mechanism is needed.
$$

$$section
### Kafka SASL username $(id="saslUsername")
When Kafka security protocol is set to `SASL_PLAINTEXT` or `SASL_SSL` then the SASL username is needed.

This should be specified as a username or API key string .
$$

$$section
### Kafka SASL password $(id="saslPassword")
When Kafka security protocol is set to `SASL_PLAINTEXT` or `SASL_SSL` then the SASL password is needed.

This should be specified as a password or API secret string .
$$

$$section
### Kafka SSL certificate location $(id="SSLCertificateLocation")
When Kafka security protocol is set to `SSL` or `SASL_SSL` then path to SSL certificate is needed.
Certificate have to be in PEM format  

This should be specified path to pem file . E.g., `/path/to/kafka/certificate.pem` .
$$

$$section
### Kafka SSL key location $(id="SSLKeyLocation")
When Kafka security protocol is set to `SSL` or `SASL_SSL` then path to SSL key is needed.
Key have to be in PEM format  

This should be specified path to pem file . E.g., `/path/to/kafka/key.pem` .
$$

$$section
### Kafka SSL CA location $(id="SSLCALocation")
When Kafka security protocol is set to `SSL` or `SASL_SSL` then path to SSL CA is needed.
CA have to be in PEM format  

This should be specified path to pem file . E.g., `/path/to/kafka/CA.pem` .
$$

## Kinesis Connection Details

These fields apply when the broker type is set to **Kinesis**. OpenMetadata reads OpenLineage events from an AWS Kinesis Data Stream.

$$section
### Kinesis Data Stream name $(id="streamName")
The name of the AWS Kinesis Data Stream that OpenLineage events are published to.

This should be specified as a stream name string. E.g., `openlineage-events`.
$$

$$section
### AWS Access Key ID $(id="awsAccessKeyId")
When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts:
- An access key ID (e.g., `AKIAIOSFODNN7EXAMPLE`)
- A secret access key (e.g., `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)

You must use both together to authenticate your requests. Enter the access key ID here.
$$

$$section
### AWS Secret Access Key $(id="awsSecretAccessKey")
The secret access key paired with the access key ID above. Treat it as a secret and do not share it.
$$

$$section
### AWS Region $(id="awsRegion")
Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

This is the region where your Kinesis Data Stream lives. E.g., `us-east-2`.

This is a **required** field for Kinesis, even if other credential values are sourced from the environment.
$$

$$section
### AWS Session Token $(id="awsSessionToken")
If you are using temporary (STS) credentials, supply the session token that pairs with the access key ID and secret access key. Leave it empty when using long-lived credentials. See the AWS docs on [temporary security credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html).
$$

$$section
### Endpoint URL $(id="endPointURL")
The AWS service endpoint URL to connect to. Leave empty to use the default Kinesis endpoint for the selected region; set it only when targeting a custom or VPC endpoint.
$$

$$section
### Profile Name $(id="profileName")
The name of a profile from your local AWS configuration to use with the boto session. Leave empty to use the default credentials chain.
$$

$$section
### Assume Role ARN $(id="assumeRoleArn")
The Amazon Resource Name (ARN) of the role to assume. Provide this to read the stream through an assumed IAM role. E.g., `arn:aws:iam::123456789012:role/openlineage-reader`.
$$

$$section
### Assume Role Session Name $(id="assumeRoleSessionName")
An identifier for the assumed role session. Used to uniquely identify a session when the same role is assumed by different principals or for different reasons. Only used when **Assume Role ARN** is set.
$$

$$section
### Assume Role Source Identity $(id="assumeRoleSourceIdentity")
The source identity to set when assuming the role. Used to monitor and control access of the assumed-role session. Only used when **Assume Role ARN** is set.
$$