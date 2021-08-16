#Source

Source is the connector to external systems and outputs a record for downstream to process and push to OpenMetadata.

##Source API

```py
@dataclass  # type: ignore[misc]
class Source(Closeable, metaclass=ABCMeta):
    ctx: WorkflowContext

    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext) -> "Source":
        pass

    @abstractmethod
    def prepare(self):
        pass

    @abstractmethod
    def next_record(self) -> Iterable[Record]:
        pass

    @abstractmethod
    def get_status(self) -> SourceStatus:
        pass
```

**create** method is used to create an instance of Source

**prepare** will be called through Python's init method. This will be a place where you could make connections to external sources or initiate the client library

**next_record** is where the client can connect to external resource and emit the data downstream

**get_status** is for [workflow](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/api/workflow.py) to call and report the status of the source such as how many records its processed any failures or warnings


## Example

A simple example of this implementation is

```py
class SampleTablesSource(Source):

    def __init__(self, config: SampleTableSourceConfig, metadata_config: MetadataServerConfig, ctx):
        super().__init__(ctx)
        self.status = SampleTableSourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.client = REST(metadata_config)
        self.service_json = json.load(open(config.sample_schema_folder + "/service.json", 'r'))
        self.database = json.load(open(config.sample_schema_folder + "/database.json", 'r'))
        self.tables = json.load(open(config.sample_schema_folder + "/tables.json", 'r'))
        self.service = get_service_or_create(self.service_json, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SampleTableSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        db = DatabaseEntity(id=uuid.uuid4(),
                            name=self.database['name'],
                            description=self.database['description'],
                            service=EntityReference(id=self.service.id, type=self.config.service_type))
        for table in self.tables['tables']:
            table_metadata = TableEntity(**table)
            table_and_db = OMetaDatabaseAndTable(table=table_metadata, database=db)
            self.status.scanned(table_metadata.name.__root__)
            yield table_and_db

    def close(self):
        pass

    def get_status(self):
        return self.status
```

