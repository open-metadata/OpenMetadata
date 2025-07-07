---
title: OpenLineage | OpenMetadata Data Lineage Pipeline
description: Connect your data pipelines with OpenMetadata's OpenLineage connector. Track data lineage, monitor pipeline metadata, and gain end-to-end visibility.
slug: /connectors/pipeline/openlineage
---

{% connectorDetailsHeader
name="OpenLineage"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Lineage", "Usage"]
unavailableFeatures=["Pipeline Status", "Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the OpenLineage connector.

Configure and schedule OpenLineage metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Troubleshooting](/connectors/pipeline/openlineage/troubleshooting)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" /%}

## Requirements

OpenMetadata is integrated with OpenLineage up to version 1.7.0 and will continue to work for future OpenLineage versions.

OpenLineage is an open framework for data lineage collection and analysis. At its core is an extensible specification that systems can use to interoperate with lineage metadata.

Apart from being a specification, it is also a set of integrations collecting lineage from various systems such as Apache Airflow and Spark.

### Openlineage connector events

OpenLineage connector consumes open lineage events from kafka broker and translates it to OpenMetadata Lineage information.

1. #### Airflow OpenLineage events

To Configure your Airflow instance 

    1. To Configure your Airflow instance install appropriate provider in [Airflow](https://airflow.apache.org/docs/apache-airflow-providers-openlineage/stable/index.html)
    2. Configure OpenLineage Provider in [Airflow](https://airflow.apache.org/docs/apache-airflow-providers-openlineage/stable/guides/user.html#using-openlineage-integration)
        - Remember to use `kafka` transport mode here as OL events are collected from kafka topic. Detailed list of configuration options for OpenLineage can be found [here](https://openlineage.io/docs/client/python/#configuration)

2. #### Spark OpenLineage events

    Configure Spark Session to produce OpenLineage events compatible with OpenLineage connector available in OpenMetadata. complete the kafka config using the below code.
    ```shell
    from pyspark.sql import SparkSession
    from uuid import uuid4

    spark = SparkSession.builder\
    .config('spark.openlineage.namespace', 'mynamespace')\
    .config('spark.openlineage.parentJobName', 'hello-world')\
    .config('spark.openlineage.parentRunId', str(uuid4()))\
    .config('spark.jars.packages', 'io.openlineage:openlineage-spark:1.7.0')\
    .config('spark.extraListeners', 'io.openlineage.spark.agent.OpenLineageSparkListener')\
    .config('spark.openlineage.transport.type', 'kafka')\
    .getOrCreate()
    ```

## Metadata Ingestion

{% partial 
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Openlineage", 
    selectServicePath: "/images/v1.8/connectors/openlineage/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/openlineage/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/openlineage/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagNme="stepsContainer" %}

{% /extraContent %}
{% partial file="/v1.8/connectors/test-connection.md" /%}
{% partial file="/v1.8/connectors/pipeline/configure-ingestion.md" /%}
{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}
{% /stepsContainer %}


##### Providing connection details programmatically via API
###### 1. Preparing the Client

```python
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

server_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    authProvider="openmetadata",
    securityConfig=OpenMetadataJWTClientConfig(
        jwtToken="<token>"
    ),
)
metadata = OpenMetadata(server_config)

assert metadata.health_check()  # Will fail if we cannot reach the server
```
###### 2. Creating the OpenLineage Pipeline service
```python

from metadata.generated.schema.api.services.createPipelineService import  CreatePipelineServiceRequest
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineServiceType,
    PipelineConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    OpenLineageConnection,
    SecurityProtocol as KafkaSecurityProtocol,
    ConsumerOffsets
)
from metadata.generated.schema.security.ssl.validateSSLClientConfig import (
    ValidateSslClientConfig,
)

openlineage_service_request = CreatePipelineServiceRequest(
    name='openlineage-service',
    displayName='OpenLineage Service',
    serviceType=PipelineServiceType.OpenLineage,
    connection=PipelineConnection(
        config=OpenLineageConnection(
            brokersUrl='broker1:9092,broker2:9092',
            topicName='openlineage-events',
            consumerGroupName='openmetadata-consumer',
            consumerOffsets=ConsumerOffsets.earliest,
            poolTimeout=3.0,
            sessionTimeout=60,
            securityProtocol=KafkaSecurityProtocol.SSL,
            # below ssl confing in optional and used only when securityProtocol=KafkaSecurityProtocol.SSL
            sslConfig=ValidateSslClientConfig(
                sslCertificate='/path/to/kafka/certs/Certificate.pem',
                sslKey='/path/to/kafka/certs/Key.pem',
                caCertificate='/path/to/kafka/certs/RootCA.pem'
                )
        )
    ),
)

metadata.create_or_update(openlineage_service_request)


```
###### 1. Preparing the Client

```python
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

server_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    authProvider="openmetadata",
    securityConfig=OpenMetadataJWTClientConfig(
        jwtToken="<token>"
    ),
)
metadata = OpenMetadata(server_config)

assert metadata.health_check()  # Will fail if we cannot reach the server
```
###### 2. Creating the OpenLineage Pipeline service
```python

from metadata.generated.schema.api.services.createPipelineService import  CreatePipelineServiceRequest
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineServiceType,
    PipelineConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    OpenLineageConnection,
    SecurityProtocol as KafkaSecurityProtocol,
    ConsumerOffsets
)
from metadata.generated.schema.security.ssl.validateSSLClientConfig import (
    ValidateSslClientConfig,
)

openlineage_service_request = CreatePipelineServiceRequest(
    name='openlineage-service',
    displayName='OpenLineage Service',
    serviceType=PipelineServiceType.OpenLineage,
    connection=PipelineConnection(
        config=OpenLineageConnection(
            brokersUrl='broker1:9092,broker2:9092',
            topicName='openlineage-events',
            consumerGroupName='openmetadata-consumer',
            consumerOffsets=ConsumerOffsets.earliest,
            poolTimeout=3.0,
            sessionTimeout=60,
            securityProtocol=KafkaSecurityProtocol.SSL,
            # below ssl confing in optional and used only when securityProtocol=KafkaSecurityProtocol.SSL
            sslConfig=ValidateSslClientConfig(
                sslCertificate='/path/to/kafka/certs/Certificate.pem',
                sslKey='/path/to/kafka/certs/Key.pem',
                caCertificate='/path/to/kafka/certs/RootCA.pem'
                )
        )
    ),
)

metadata.create_or_update(openlineage_service_request)


```
###### 1. Preparing the Client

```python
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

server_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    authProvider="openmetadata",
    securityConfig=OpenMetadataJWTClientConfig(
        jwtToken="<token>"
    ),
)
metadata = OpenMetadata(server_config)

assert metadata.health_check()  # Will fail if we cannot reach the server
```
###### 2. Creating the OpenLineage Pipeline service
```python

from metadata.generated.schema.api.services.createPipelineService import  CreatePipelineServiceRequest
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineServiceType,
    PipelineConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    OpenLineageConnection,
    SecurityProtocol as KafkaSecurityProtocol,
    ConsumerOffsets
)


openlineage_service_request = CreatePipelineServiceRequest(
    name='openlineage-service',
    displayName='OpenLineage Service',
    serviceType=PipelineServiceType.OpenLineage,
    connection=PipelineConnection(
        config=OpenLineageConnection(
            brokersUrl='broker1:9092,broker2:9092',
            topicName='openlineage-events',
            consumerGroupName='openmetadata-consumer',
            consumerOffsets=ConsumerOffsets.earliest,
            poolTimeout=3.0,
            sessionTimeout=60,
            securityProtocol=KafkaSecurityProtocol.SSL,
            # below ssl confing in optional and used only when securityProtocol=KafkaSecurityProtocol.SSL
            sslConfig=ValidateSslClientConfig(
                sslCertificate='/path/to/kafka/certs/Certificate.pem',
                sslKey='/path/to/kafka/certs/Key.pem',
                caCertificate='/path/to/kafka/certs/RootCA.pem'
                )
        )
    ),
)

metadata.create_or_update(openlineage_service_request)

```
