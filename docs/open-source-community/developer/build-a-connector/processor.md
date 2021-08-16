#Processor 

**Processor** is an optional component in workflow. It can be used to modify the record
coming from sources. Processor receives a record from source and can modify and re-emit the
event back to workflow.


## API

```py
@dataclass
class Processor(Closeable, metaclass=ABCMeta):
    ctx: WorkflowContext

    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext) -> "Processor":
        pass

    @abstractmethod
    def process(self, record: Record) -> Record:
        pass

    @abstractmethod
    def get_status(self) -> ProcessorStatus:
        pass

    @abstractmethod
    def close(self) -> None:
        pass
```

**create** method is called during the workflow instantiation and creates a instance of the processor

**process** this method is called for each record coming down in workflow chain and can be used to modify or enrich the record

**get_status** to report the status of the processor ex: how many records, failures or warnings etc..

**close** gets called before the workflow stops. Can be used to cleanup any connections or other resources.


## Example

Example implmentation

```py

class PiiProcessor(Processor):
    config: PiiProcessorConfig
    metadata_config: MetadataServerConfig
    status: ProcessorStatus
    client: REST

    def __init__(self, ctx: WorkflowContext, config: PiiProcessorConfig, metadata_config: MetadataServerConfig):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = ProcessorStatus()
        self.client = REST(self.metadata_config)
        self.tags = self.__get_tags()
        self.column_scanner = ColumnNameScanner()
        self.ner_scanner = NERScanner()

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = PiiProcessorConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def __get_tags(self) -> {}:
        user_tags = self.client.list_tags_by_category("user")
        tags_dict = {}
        for tag in user_tags:
            tags_dict[tag.name.__root__] = tag
        return tags_dict

    def process(self, table_and_db: OMetaDatabaseAndTable) -> Record:
        for column in table_and_db.table.columns:
            pii_tags = []
            pii_tags += self.column_scanner.scan(column.name.__root__)
            pii_tags += self.ner_scanner.scan(column.name.__root__)
            tag_labels = []
            for pii_tag in pii_tags:
                if snake_to_camel(pii_tag) in self.tags.keys():
                    tag_entity = self.tags[snake_to_camel(pii_tag)]
                else:
                    logging.debug("Fail to tag column {} with tag {}".format(column.name, pii_tag))
                    continue
                tag_labels.append(TagLabel(tagFQN=tag_entity.fullyQualifiedName,
                                           labelType='Automated',
                                           state='Suggested',
                                           href=tag_entity.href))
            column.tags = tag_labels

        return table_and_db

    def close(self):
        pass

    def get_status(self) -> ProcessorStatus:
        return self.status
```
