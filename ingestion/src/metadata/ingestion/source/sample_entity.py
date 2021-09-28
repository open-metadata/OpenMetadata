import json
import logging
import random
import uuid
from dataclasses import dataclass, field
from typing import Iterable, List
from faker import Faker

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table, Column
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import Source
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.ometa.openmetadata_rest import OpenMetadataAPIClient
from metadata.ingestion.source.sample_data import get_database_service_or_create
from metadata.generated.schema.entity.data.table import Constraint
from metadata.ingestion.source.sql_source import SQLConnectionConfig
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.utils.helpers import snake_to_camel
from metadata.ingestion.processor.pii import ColumnNameScanner

from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest

logger: logging.Logger = logging.getLogger(__name__)


class SampleEntitySourceConfig(SQLConnectionConfig):
    no_of_services: int
    no_of_databases: int
    no_of_tables: int
    no_of_columns: int

    def get_connection_url(self):
        pass


@dataclass
class SampleEntitySourceStatus(SourceStatus):
    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def scanned(self, entity_type: str, entity_name: str) -> None:
        self.success.append(entity_name)
        logger.info('{} Scanned: {}'.format(entity_type, entity_name))

    def filtered(self, entity_type: str, entity_name: str, err: str) -> None:
        self.warnings.append(entity_name)
        logger.warning("Dropped {} {} due to {}".format(entity_type, entity_name, err))


class SampleEntitySource(Source):

    def __init__(self, config: SampleEntitySourceConfig, metadata_config: MetadataServerConfig, ctx):
        super().__init__(ctx)
        self.faker = Faker()
        self.status = SampleEntitySourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.client = OpenMetadataAPIClient(metadata_config)
        self.database_service_json = json.load(open("./examples/sample_data/datasets/service.json", 'r'))
        self.database_service = get_database_service_or_create(self.database_service_json, self.metadata_config)
        self.column_scanner = ColumnNameScanner()
        self.service_name = lambda: self.faker.first_name()
        self.service_type = lambda: random.choice(['BigQuery', 'Hive', 'MSSQL', 'MySQL', 'Postgres', 'Redshift',
                                                   'Snowflake'])
        self.database_name = lambda: self.faker.first_name()
        self.table_name = lambda: self.faker.first_name()
        self.column_name = lambda: self.faker.first_name()
        self.description = lambda: self.faker.text()
        self.tags = self.__get_tags()
        self.tagFQN = lambda: self.faker.first_name()
        self.labelType = lambda: random.choice(['Automated', 'Derived', 'Manual', 'Propagated'])
        self.state = lambda: random.choice(['Confirmed', 'Suggested'])
        self.href = lambda: self.faker.url()
        self.col_type = lambda: random.choice(['INT', 'STRING', 'VARCHAR', 'DATE'])
        self.col_constraint = lambda: random.choice(
            [Constraint.UNIQUE, Constraint.NOT_NULL, Constraint.NULL])

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SampleEntitySourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def __get_tags(self) -> {}:
        user_tags = self.client.list_tags_by_category("user")
        tags_dict = {}
        for tag in user_tags:
            tags_dict[tag.name.__root__] = tag
        return tags_dict

    def scan(self, text):
        types = set()
        for pii_type in self.regex:
            if self.regex[pii_type].match(text) is not None:
                types.add(pii_type.name)

        logging.debug("PiiTypes are %s", ",".join(str(x) for x in list(types)))
        return list(types)

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        yield from self.ingest_tables()

    def ingest_tables(self) -> Iterable[OMetaDatabaseAndTable]:
        for h in range(self.config.no_of_services):
            service = {'jdbc': {'connectionUrl': f'jdbc://localhost', 'driverClass': 'jdbc'},
                       'name': self.service_name(), 'description': str(self.description), 'serviceType': self.service_type()}
            create_service = self.client.create_database_service(CreateDatabaseServiceEntityRequest(**service))
            logger.info('Ingesting service {}/{}'.format(h + 1, self.config.no_of_services))
            for i in range(self.config.no_of_databases):
                db = Database(id=uuid.uuid4(),
                              name=self.database_name().replace(".", "_"),
                              description=self.description(),
                              service=EntityReference(id=create_service.id, type=self.config.service_type))

                logger.info('Ingesting database {}/{} in service: {}/{}'
                            .format(i + 1, self.config.no_of_databases, h + 1, self.config.no_of_services))

                for j in range(self.config.no_of_tables):
                    table_columns = []
                    table_entity = Table(id=uuid.uuid4(),
                                         name=self.table_name().replace(".", "_"),
                                         tableType='Regular',
                                         description=self.description(),
                                         columns=table_columns)
                    row_order = 0
                    for t in range(self.config.no_of_columns):
                        pii_tags = []
                        col_name = self.column_name()
                        pii_tags += self.column_scanner.scan(col_name)
                        tag_labels = []
                        for pii_tag in pii_tags:
                            if snake_to_camel(pii_tag) in self.tags.keys():
                                tag_entity = self.tags[snake_to_camel(pii_tag)]
                            else:
                                logging.debug("Fail to tag column {} with tag {}".format(col_name, pii_tag))
                                continue
                            tag_labels.append(TagLabel(tagFQN=tag_entity.fullyQualifiedName,
                                                       labelType='Automated',
                                                       state='Suggested',
                                                       href=tag_entity.href))
                        table_columns.append(
                            Column(name=col_name,
                                   description=self.description(),
                                   dataType=self.col_type(),
                                   constraint=self.col_constraint(),
                                   dataLength=100,
                                   ordinalPosition=row_order,
                                   tags=tag_labels)
                        )
                        table_entity.columns = table_columns
                        row_order = row_order + 1

                    table_and_db = OMetaDatabaseAndTable(
                        table=table_entity, database=db
                    )
                    yield table_and_db

    def close(self):
        pass

    def get_status(self):
        return self.status
