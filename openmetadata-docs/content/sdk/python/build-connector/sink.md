---
title: Sink
slug: /sdk/python/build-connector/sink
---

# Sink
The **Sink** will get the event emitted by the source, one at a time. It can use this record to make external service calls to store or index etc.For OpenMetadata we have [MetadataRestTablesSink](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/sink/metadata_rest.py).

## API

```python
@dataclass  # type: ignore[misc]
class Sink(Closeable, metaclass=ABCMeta):
"""All Sinks must inherit this base class."""

    ctx: WorkflowContext

    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext) -> "Sink":
        pass

    @abstractmethod
    def write_record(self, record: Record) -> None:
        # must call callback when done.
        pass

    @abstractmethod
    def get_status(self) -> SinkStatus:
        pass

    @abstractmethod
    def close(self) -> None:
        pass
```

**create** method is called during the workflow instantiation and creates an instance of the sink.

**write_record** this method is called for each record coming down in the workflow chain and can be used to store the record in external services etc.

**get_status** to report the status of the sink ex: how many records, failures or warnings etc.

**close** gets called before the workflow stops. Can be used to clean up any connections or other resources.

## Example
Example implementation

```python
class MetadataRestTablesSink(Sink):
config: MetadataTablesSinkConfig
status: SinkStatus

    def __init__(self, ctx: WorkflowContext, config: MetadataTablesSinkConfig, metadata_config: MetadataServerConfig):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SinkStatus()
        self.wrote_something = False
        self.rest = REST(self.metadata_config)

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = MetadataTablesSinkConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def write_record(self, entity_request) -> None:
        log = f"{type(entity_request).__name__} [{entity_request.name.__root__}]"
        try:
            created = self.metadata.create_or_update(entity_request)
            if created:
                self.status.records_written(
                    f"{type(created).__name__}: {created.fullyQualifiedName.__root__}"
                )
                logger.debug(f"Successfully ingested {log}")
            else:
                self.status.failure(log)
                logger.error(f"Failed to ingest {log}")

        except (APIError, HTTPError) as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to ingest {log} due to api request failure: {err}")
            self.status.failure(log)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to ingest {log}: {exc}")
            self.status.failure(log)

    def get_status(self):
        return self.status

    def close(self):
        pass
```