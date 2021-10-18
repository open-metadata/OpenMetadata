---
description: This design doc will walk through developing a connector for OpenMetadata
---

# Build a Connector

Ingestion is a simple python framework to ingest the metadata from various sources.

Please look at our framework [APIs](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/api)

## Workflow

[workflow](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/api/workflow.py) is a simple orchestration job that runs the components in an Order.

A workflow consists of [Source](source.md), [Processor](processor.md) and [Sink](sink.md). It also provides support for [Stage](stage.md) and [BulkSink](bulksink.md).

Workflow execution happens in serial fashion.

1. The** Workflow** runs the **source** component first.  The **source** retrieves a record from external sources and emits the record downstream.
2. If the **processor** component is configured, the **workflow** sends the record to the **processor** next.
3. There can be multiple **processor** components attached to the **workflow**.  The **workflow** passes a record to each **processor** in the order they are configured.
4. Once a **processor** is finished, it sends the modified record to **sink**.
5. The above steps are repeated for each record emitted from the **source**.

In the cases where we need aggregation over the records, we can use **stage** to write to a file or other store. Use the file written to in **stage** and pass it to **bulksink** to publish to external services such as **openmetadata** or **elasticsearch**.

{% content-ref url="source.md" %}
[source.md](source.md)
{% endcontent-ref %}

{% content-ref url="processor.md" %}
[processor.md](processor.md)
{% endcontent-ref %}

{% content-ref url="sink.md" %}
[sink.md](sink.md)
{% endcontent-ref %}

{% content-ref url="stage.md" %}
[stage.md](stage.md)
{% endcontent-ref %}

{% content-ref url="bulksink.md" %}
[bulksink.md](bulksink.md)
{% endcontent-ref %}
