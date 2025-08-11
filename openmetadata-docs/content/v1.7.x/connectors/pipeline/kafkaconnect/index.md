---
title: KafkaConnect | OpenMetadata Messaging Pipeline Connector
description: Configure Kafka Connect for metadata ingestion from real-time event streams, schema updates, and topic usage.
slug: /connectors/pipeline/kafkaconnect
---

{% connectorDetailsHeader
name="KafkaConnect"
stage="PROD"
platform="Collate"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage", "Usage"]
unavailableFeatures=["Owners", "Tags"]
/ %}


In this section, we provide guides and references to use the KafkaConnect connector.

Configure and schedule KafkaConnect metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
    - [KafkaConnect Versions](#kafkaconnect-versions)
- [Metadata Ingestion](#metadata-ingestion)
    - [Service Name](#service-name)
    - [Connection Details](#connection-details)
    - [Metadata Ingestion Options](#metadata-ingestion-options)
- [Troubleshooting](/connectors/pipeline/glue-pipeline/troubleshooting)
    - [Workflow Deployment Error](#workflow-deployment-error)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/kafkaconnect/yaml"} /%}

## Requirements

### KafkaConnect Versions

OpenMetadata is integrated with kafkaconnect up to version [3.6.1](https://docs.kafkaconnect.io/getting-started) and will continue to work for future kafkaconnect versions.

The ingestion framework uses [kafkaconnect python client](https://libraries.io/pypi/kafka-connect-py) to connect to the kafkaconnect instance and perform the API calls

## Metadata Ingestion

{% partial 
    file="/v1.7/connectors/metadata-ingestion-ui.md" 
    variables={
        connector: "KafkaConnect", 
        selectServicePath: "/images/v1.7/connectors/kafkaconnect/select-service.webp",
        addNewServicePath: "/images/v1.7/connectors/kafkaconnect/add-new-service.webp",
        serviceConnectionPath: "/images/v1.7/connectors/kafkaconnect/service-connection.webp",
    } 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: The hostname or IP address of the Kafka Connect worker with the REST API enabled eg.`https://localhost:8083` or `https://127.0.0.1:8083` or `https://<yourkafkaconnectresthostnamehere>`

- **Kafka Connect Config**: OpenMetadata supports username/password.
    1. Basic Authentication
        - Username: Username to connect to Kafka Connect. This user should be able to send request to the Kafka Connect API and access the [Rest API](https://docs.confluent.io/platform/current/connect/references/restapi.html) GET endpoints.
        - Password: Password to connect to Kafka Connect.

- **verifySSL** : Whether SSL verification should be perform when authenticating.

- **Kafka Service Name** : The Service Name of the Ingested [Kafka](/connectors/messaging/kafka#4.-name-and-describe-your-service) instance associated with this KafkaConnect instance. 

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Displaying Lineage Information
Steps to retrieve and display the lineage information for a Kafka Connect service.
1. Ingest Kafka Messaging Service Metadata: Identify the Kafka messaging service associated with the Kafka Connect service .Ensure all connected topics are comprehensively ingested.
2. Ingest Source and Sink Database/Storage System Metadata: Identify both the source and sink database or storage systems used by the Kafka Connect service. Ingest metadata for these database or storage systems
3. Ingest Kafka Connect Service Metadata: Finally, Ingest your Kafka Connect service.

By successfully completing these steps, the lineage information for the service will be displayed.

{% image
  src="/images/v1.7/connectors/kafkaconnect/lineage.webp"
  alt="Kafkaconnect Lineage" /%}


## Supported Connectors
Currently, the following source and sink connectors for Kafka Connect are supported for lineage tracking:
* [MySQL](/connectors/database/mysql)
* [PostgreSQL](/connectors/database/postgres)
* [MSSQL](/connectors/database/mssql)
* [MongoDB](/connectors/database/mongodb)
* [Amazon S3](/connectors/storage/s3)

For these connectors, lineage information can be obtained provided they are configured with a source or sink and the corresponding metadata ingestion is enabled.

### Missing Lineage
If lineage information is not displayed for a Kafka Connect service, follow these steps to diagnose the issue.
1. *Kafka Service Association*: Make sure the Kafka service that the data is being ingested from is associated with this Kafka Connect service. Additionally, verify that the correct name is passed on in the Kafka Service Name field during configuration. This field helps establish the lineage between the Kafka service and the Kafka Connect flow.
2. *Source and Sink Configuration*: Verify that the Kafka Connect connector associated with the service is configured with a source and/or sink database or storage system. Connectors without a defined source or sink cannot provide lineage data.
3. *Metadata Ingestion*: Ensure that metadata for both the source and sink database/storage systems is ingested and passed to the lineage system. This typically involves configuring the relevant connectors to capture and transmit this information.
