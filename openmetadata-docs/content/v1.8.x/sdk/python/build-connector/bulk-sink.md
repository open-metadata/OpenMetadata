---
title: Bulk Sink
description: Learn to build powerful bulk sink connectors with OpenMetadata's Python SDK. Step-by-step guide with code examples for efficient data ingestion.
slug: /sdk/python/build-connector/bulk-sink
---

# BulkSink
**BulkSink** is an optional component in the workflow. It can be used to bulk update the records generated in a workflow. It needs to be used in conjunction with Stage

## API

```python
class BulkSink(BulkStep, ABC):
    """All Stages must inherit this base class."""

    # From the parent - Adding here just to showcase
    @abstractmethod
    def run(self) -> None:
        pass
```


**run** this method is called only once in Workflow. Its developer responsibility is to make bulk actions inside this method. Such as read the entire file or store to generate the API calls to external services.

## Example
[Example implementation](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/bulksink/metadata_usage.py#L52)