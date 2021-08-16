#BulkSink 

**BulkSink** is an optional component in workflow. It can be used to bulk update the records
generated in a workflow. It needs to be used in conjuction with Stage 

## API

```py
@dataclass  # type: ignore[misc]
class BulkSink(Closeable, metaclass=ABCMeta):
    ctx: WorkflowContext

    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext) -> "BulkSink":
        pass

    @abstractmethod
    def write_records(self) -> None:
        pass

    @abstractmethod
    def get_status(self) -> BulkSinkStatus:
        pass

    @abstractmethod
    def close(self) -> None:
        pass
```

**create** method is called during the workflow instantiation and creates a instance of the bulksink

**write_records** this method is called only once in Workflow. Its developer responsibility to make bulk actions inside this method. Such as read the entire file or store to generate
the API calls to external services

**get_status** to report the status of the bulk_sink ex: how many records, failures or warnings etc..

**close** gets called before the workflow stops. Can be used to cleanup any connections or other resources.


## Example

[Example implmentation](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/bulksink/metadata_usage.py#L36)

