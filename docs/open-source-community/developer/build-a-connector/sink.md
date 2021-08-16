#Sink 

Sink will get the event emitted by the source, one at a time. It can use this record to make external service calls to store or index etc.. For OpenMetadata
we have [MetadataRestTablesSink](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/sink/metadata_rest_tables.py)

## API

```py
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

**create** method is called during the workflow instantiation and creates a instance of the sink

**write_record** this method is called for each record coming down in workflow chain and can be used to store the record in external services etc..

**get_status** to report the status of the sink ex: how many records, failures or warnings etc..

**close** gets called before the workflow stops. Can be used to cleanup any connections or other resources.


## Example

Example implmentation

```py

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

    def write_record(self, table_and_db: OMetaDatabaseAndTable) -> None:
        try:
            db_request = CreateDatabaseEntityRequest(name=table_and_db.database.name,
                                                     description=table_and_db.database.description,
                                                     service=EntityReference(id=table_and_db.database.service.id,
                                                                             type="databaseService"))
            db = self.rest.create_database(db_request)
            table_request = CreateTableEntityRequest(name=table_and_db.table.name,
                                                     columns=table_and_db.table.columns,
                                                     description=table_and_db.table.description,
                                                     database=db.id)
            created_table = self.rest.create_or_update_table(table_request)
            logger.info(
                'Successfully ingested {}.{}'.format(table_and_db.database.name.__root__, created_table.name.__root__))
            self.status.records_written(
                '{}.{}'.format(table_and_db.database.name.__root__, created_table.name.__root__))
        except (APIError, ValidationError) as err:
            logger.error(
                "Failed to ingest table {} in database {} ".format(table_and_db.table.name, table_and_db.database.name))
            logger.error(err)
            self.status.failures(table_and_db.table.name)

    def get_status(self):
        return self.status

    def close(self):
        pass
```
