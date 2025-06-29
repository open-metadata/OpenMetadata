---
title: Sink
slug: /sdk/python/build-connector/sink
---

# Sink
The **Sink** will get the event emitted by the source, one at a time. It can use this record to make external service calls to store or index etc.For OpenMetadata we have [MetadataRestTablesSink](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/sink/metadata_rest.py).

## API

```python
class Sink(ReturnStep, ABC):
    """All Sinks must inherit this base class."""

    # From the parent - Just to showcase
    @abstractmethod
    def _run(self, record: Entity) -> Either:
        """
        Main entrypoint to execute the step
        """
```

**_run** this method is called for each record coming down in the workflow chain and can be used to store the record in external services etc.

## Example
[Example implementation](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/sink/metadata_rest.py#L87)
