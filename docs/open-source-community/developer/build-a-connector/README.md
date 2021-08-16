---
description: >-
  This design doc will walk through developing a connector for OpenMetadata
---

# Ingestion

Ingestion is a simple python framework to ingest the metadata from various sources.


##API

Please look at our framework [APIs](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/api)


## Workflow

[workflow](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/api/workflow.py) is a simple orchestration job that runs the components in an Order.

It Consists of [Source](./source.md) , Optional [Processor](./processor.md), [Sink](./sink.md) .  It also provides support for [Stage](./stage.md) , [BulkSink](./bulksink.md)

Workflow execution happens in serial fashion.

1. It runs **source** component and retrieves and record it may emit
2. if **processor** component is configured it sends the record to processor first
3. There can be multiple processors attached to the workflow it passes them in the order they are configurd
4. Once the **processors** finished , it sends the modified to record to Sink. All of these happens per record

In the cases where we need to aggregation over the records, we can use **stage** to write to a file or other store. Use the file written to in **stage** and pass it to **bulksink** to publish to external services such as **openmetadata** or **elasticsearch**



{% page-ref page="source.md" %}

{% page-ref page="processor.md" %}

{% page-ref page="sink.md" %}

{% page-ref page="stage.md" %}

{% page-ref page="bulksink.md" %}





