---
This guide will help you setup the Ingestion framework and connectors
---

![Python version 3.8+](https://img.shields.io/badge/python-3.8%2B-blue)

OpenMetadata Ingestion is a simple framework to build connectors and ingest metadata of various systems through OpenMetadata APIs. It could be used in an orchestration framework(e.g. Apache Airflow) to ingest metadata.
**Prerequisites**

- Python &gt;= 3.8.x

### Docs

Please refer to the documentation here https://docs.open-metadata.org/connectors

<img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=c1a30c7c-6dc7-4928-95bf-6ee08ca6aa6a" />

### TopologyRunner

All the Ingestion Workflows run through the TopologyRunner.

The flow is depicted in the images below.

**TopologyRunner Standard Flow**

![image](../openmetadata-docs/images/v1.4/features/ingestion/workflows/metadata/multithreading/single-thread-flow.png)

**TopologyRunner Multithread Flow**

![image](../openmetadata-docs/images/v1.4/features/ingestion/workflows/metadata/multithreading/multi-thread-flow.png)
