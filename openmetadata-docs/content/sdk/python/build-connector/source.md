---
title: Source
slug: /sdk/python/build-connector/source
---

# Source

The **Source** is the connector to external systems and outputs a record for downstream to process and push to OpenMetadata.

## Source API

```python
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

**create** method is used to create an instance of Source.

**prepare** will be called through Python's init method. This will be a place where you could make connections to external sources or initiate the client library.

**next_record** is where the client can connect to an external resource and emit the data downstream.

**get_status** is for the [workflow](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/api/workflow.py) to call and report the status of the source such as how many records its processed any failures or warnings.

## Example

A simple example of this implementation is

```python
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

    def next_record(self) -> Iterable[Entity]:

        yield from self.yield_create_request_database_service(self.config)

        service_entity: DatabaseService = self.metadata.get_by_name(
            entity=DatabaseService, fqn=self.config.serviceName
        )
        service_id = service_entity.id

        yield CreateDatabaseRequest(
            name="awesome-database",
            service=EntityReference(
                id=service_id,
                type="databaseService",
            ),
        )

        database_entity: Database = self.metadata.get_by_name(
            entity=Database, fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.database_service.name.__root__,
                    database_name="awesome-database",
                )
        )
        database_id = database_entity.id

        yield CreateDatabaseSchemaRequest(
            name="awesome-schema",
            description="description",
            database=EntityReference(id=database_id, type="database"),
        )

        database_schema_entity: DatabaseSchema = self.metadata.get_by_name(
            entity=DatabaseSchema, fqn.build(
                    self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.database_service.name.__root__,
                    database_name="awesome-database",
                    schema_name="awesome-schema"
                )
        )
        database_schema_id = database_schema_entity.id

        yield CreateTableRequest(
            name="awesome-table",
            description="description",
            columns="columns",
            databaseSchema=EntityReference(
                id=database_schema_id, type="databaseSchema"
            ),
            tableConstraints=table.get("tableConstraints"),
            tableType=table["tableType"],
        )

    def close(self):
        pass

    def get_status(self):
        return self.status
```

## For Consumers of Openmetadata-ingestion to define custom connectors in their own package with same namespace

As a consumer of Openmetadata-ingestion package, You can to add your custom connectors within the same namespace but in a different package repository.
<br/>

**Here is the situation**

```
├─my_code_repository_package
  ├── src
      ├── my_other_relevant_code_package
      ├── metadata
      │   └── ingestion
      │       └── source
      │        └── database
      │         └── my_awesome_connector.py
      └── setup.py
├── openmetadata_ingestion
  ├── src
      ├── metadata
      │   └── ingestion
      │       └── source
      │        └── database
      │         └── existingSource1
      |         └── existingSource2
      |         └── ....
      └── setup.py
```

If you want my_awesome_connector.py to build as a source and run as a part of workflows defined in openmetadata_ingestion below are the steps.
<br/>

**First add your coustom project in PyCharm.**
<Image
src={"/images/sdk/python/build-connector/add-project-in-pycharm.png"}
alt="Add project in pycharm"
/>
<br/>

**Now Go to IDE and Project Settings in PyCharm, inside that go to project section, and select python interpreter, Select virtual environment created for the project as python interpreter**
<Image
src={"/images/sdk/python/build-connector/select-interpreter.png"}
alt="Select interpreter in pycharm"
/>
<br/>

**Now apply and okay that interpreter**
<Image
src={"/images/sdk/python/build-connector/add-interpreter.png"}
alt="Select interpreter in pycharm"
/>
