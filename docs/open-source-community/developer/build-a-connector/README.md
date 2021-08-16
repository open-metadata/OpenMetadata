---
description: >-
  This design doc will walk through developing a connector for OpenMetadata
---


# Ingestion API

Ingestion is a simple python framework to ingest the metadata from various sources.

Please look at our framework [APIs](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/api)


## Workflow

[workflow](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/api/workflow.py) is a simple orchestration job that runs the components in an Order.

It consists of [Source](./source.md) ,[Processor](./processor.md), [Sink](./sink.md) .  It also provides support for [Stage](./stage.md) , [BulkSink](./bulksink.md)

Workflow execution happens in serial fashion.

1. It runs **source** component first. **Source** component retrieves a record from external sources and emits the record downstream. 
2. if the **processor** component is configured **workflow** sends the record to processor next
3. There can be multiple processors attached to the workflow it passes them in the order they are configurd
4. Once the **processors** finished , it sends the modified to record to Sink. 
5. The above steps repeats per record emitted from source component

In the cases where we need to aggregation over the records, we can use **stage** to write to a file or other store. Use the file written to in **stage** and pass it to **bulksink** to publish to external services such as **openmetadata** or **elasticsearch**



{% page-ref page="source.md" %}

{% page-ref page="processor.md" %}

{% page-ref page="sink.md" %}

{% page-ref page="stage.md" %}

{% page-ref page="bulksink.md" %}





