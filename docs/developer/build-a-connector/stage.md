# Stage

The **Stage** is an optional component in the workflow. It can be used to store the records in a file or data store and can be used to aggregate the work done by a processor.

## API

```python
@dataclass  # type: ignore[misc]
class Stage(Closeable, metaclass=ABCMeta):
    ctx: WorkflowContext

    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext) -> "Stage":
        pass

    @abstractmethod
    def stage_record(self, record: Record):
        pass

    @abstractmethod
    def get_status(self) -> StageStatus:
        pass

    @abstractmethod
    def close(self) -> None:
        pass
```

**create** method is called during the workflow instantiation and creates an instance of the processor

**stage_record** this method is called for each record coming down in the workflow chain and can be used to store the record. This method doesn't emit anything for the downstream to process on.

**get_status** to report the status of the stage ex: how many records, failures or warnings etc.

**close** gets called before the workflow stops. Can be used to clean up any connections or other resources.

## Example

Example implementation

```python
class FileStage(Stage):
    config: FileStageConfig
    status: StageStatus

    def __init__(self, ctx: WorkflowContext, config: FileStageConfig, metadata_config: MetadataServerConfig):
        super().__init__(ctx)
        self.config = config
        self.status = StageStatus()

        fpath = pathlib.Path(self.config.filename)
        self.file = fpath.open("w")
        self.wrote_something = False

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = FileStageConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def stage_record(
        self,
        record: TableEntity
    ) -> None:
        json_record = json.loads(record.json())
        self.file.write(json.dumps(json_record))
        self.file.write("\n")
        self.status.records_status(record)

    def get_status(self):
        return self.status

    def close(self):
        self.file.close()
```
