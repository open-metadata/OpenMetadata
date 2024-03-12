---
title: OpenLineage
slug: /connectors/pipeline/openlineage
---

# OpenLineage

In this section, we provide guides and references to use the OpenLineage connector.

## What is OpenLineage?

According to [documentation](https://openlineage.io/docs/):

```
OpenLineage is an open framework for data lineage collection and analysis. At its core is an extensible specification that systems can use to interoperate with lineage metadata.
```

OpenLineage, apart from being a specification, is also a set of integrations collecting lineage from various systems such as Apache Airflow and Spark.


## OpenMetadata Openlineage connector

OpenMetadata OpenLineage connector consumes open lineage events from kafka broker and translates it to OpenMetadata Lineage information.

{% image
  src="/images/v1.3/connectors/pipeline/openlineage/connector-flow.svg"
  alt="OpenLineage Connector" /%}


### Airflow OpenLineage events

Configure your Airflow instance 

1. Install appropriate provider in Airflow: [apache-airflow-providers-openlineage](https://airflow.apache.org/docs/apache-airflow-providers-openlineage/stable/index.html)
2. Configure OpenLineage Provider in Airflow - [documentation](https://airflow.apache.org/docs/apache-airflow-providers-openlineage/stable/guides/user.html#using-openlineage-integration)
   1. remember to use `kafka` transport mode as this connector works under assumption OL events are collected from kafka topic
   2. detailed list of configuration options for OpenLineage can be found [here](https://openlineage.io/docs/client/python/#configuration)

### Spark OpenLineage events

Configure Spark Session to produce OpenLineage events compatible with OpenLineage connector available in OpenMetadata.

# @todo complete kafka config
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

## Requirements

{% note %}
We support OpenLineage events created by OpenLineage versions starting from OpenLineage 1.7.0
{% /note %}

## Metadata Ingestion

#### Connection Details

##### Providing connection details via UI

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Openlineage", 
    selectServicePath: "/images/v1.3/connectors/openlineage/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/openlineage/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/openlineage/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagNme="stepsContainer" %}

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
            SSLCertificateLocation='/path/to/kafka/certs/Certificate.pem',
            SSLKeyLocation='/path/to/kafka/certs/Key.pem',
            SSLCALocation='/path/to/kafka/certs/RootCA.pem',
        )
    ),
)

metadata.create_or_update(openlineage_service_request)


```
{% /extraContent %}
{% partial file="/v1.3/connectors/test-connection.md" /%}
{% partial file="/v1.3/connectors/pipeline/configure-ingestion.md" /%}
{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}
{% /stepsContainer %}
{% partial file="/v1.3/connectors/troubleshooting.md" /%}