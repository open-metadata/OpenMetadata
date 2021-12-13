#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import json
import logging
import random
import uuid
from dataclasses import dataclass, field
from typing import Iterable, List

from faker import Faker

from metadata.generated.schema.api.data.createTopic import CreateTopicEntityRequest
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceEntityRequest,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceEntityRequest,
)
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceEntityRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, Constraint, Table
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLConnectionConfig
from metadata.utils.helpers import snake_to_camel

logger: logging.Logger = logging.getLogger(__name__)


class SampleEntitySourceConfig(SQLConnectionConfig):
    no_of_services: int
    no_of_databases: int
    no_of_tables: int
    no_of_columns: int
    no_of_dashboards: int
    no_of_charts: int
    no_of_topics: int
    generate_tables: bool = True
    generate_dashboards: bool = True
    generate_topics: bool = True

    def get_connection_url(self):
        pass


@dataclass
class SampleEntitySourceStatus(SourceStatus):
    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def scanned(self, entity_type: str, entity_name: str) -> None:
        self.success.append(entity_name)
        logger.info("{} Scanned: {}".format(entity_type, entity_name))

    def filtered(self, entity_type: str, entity_name: str, err: str) -> None:
        self.warnings.append(entity_name)
        logger.warning("Dropped {} {} due to {}".format(entity_type, entity_name, err))


class SampleEntitySource(Source[Entity]):
    def __init__(
        self,
        config: SampleEntitySourceConfig,
        metadata_config: MetadataServerConfig,
        ctx,
    ):
        super().__init__(ctx)
        self.faker = Faker()
        self.status = SampleEntitySourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_name = lambda: self.faker.word()
        self.service_type = lambda: random.choice(
            ["BigQuery", "Hive", "MSSQL", "MySQL", "Postgres", "Redshift", "Snowflake"]
        )
        self.database_name = lambda: self.faker.word()
        self.table_name = lambda: self.faker.word()
        self.column_name = lambda: self.faker.word()
        self.description = lambda: self.faker.text()
        self.chart_ids = lambda: self.faker.random_int()
        self.tags = self.__get_tags()
        self.tagFQN = lambda: self.faker.first_name()
        self.labelType = lambda: random.choice(
            ["Automated", "Derived", "Manual", "Propagated"]
        )
        self.state = lambda: random.choice(["Confirmed", "Suggested"])
        self.href = lambda: self.faker.url()
        self.col_type = lambda: random.choice(["INT", "STRING", "VARCHAR", "DATE"])
        self.chart_type = lambda: random.choice(
            ["Area", "Line", "Table", "Bar", "Pie", "Histogram", "Scatter", "Text"]
        )
        self.col_constraint = lambda: random.choice(
            [Constraint.UNIQUE, Constraint.NOT_NULL, Constraint.NULL]
        )

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SampleEntitySourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def __get_tags(self) -> {}:
        return self.metadata.list_tags_by_category("user")

    def scan(self, text):
        types = set()
        for pii_type in self.regex:
            if self.regex[pii_type].match(text) is not None:
                types.add(pii_type.name)

        logging.debug("PiiTypes are %s", ",".join(str(x) for x in list(types)))
        return list(types)

    def next_record(self) -> Iterable[Entity]:
        if self.config.generate_tables:
            yield from self.ingest_tables()
        if self.config.generate_dashboards:
            yield from self.ingest_dashboards()
        if self.config.generate_topics:
            yield from self.ingest_topics()

    def ingest_tables(self) -> Iterable[OMetaDatabaseAndTable]:
        for h in range(self.config.no_of_services):
            service = {
                "jdbc": {"connectionUrl": f"jdbc://localhost", "driverClass": "jdbc"},
                "name": self.service_name(),
                "description": self.description(),
                "serviceType": self.service_type(),
            }
            create_service = None
            while True:
                try:
                    create_service = self.metadata.create_or_update(
                        CreateDatabaseServiceEntityRequest(**service)
                    )
                    break
                except APIError as err:
                    continue

            logger.info(
                "Ingesting service {}/{}".format(h + 1, self.config.no_of_services)
            )
            for i in range(self.config.no_of_databases):
                db = Database(
                    id=uuid.uuid4(),
                    name=self.database_name().replace(".", "_"),
                    description=self.description(),
                    service=EntityReference(
                        id=create_service.id, type=self.config.service_type
                    ),
                )

                logger.info(
                    "Ingesting database {}/{} in service: {}/{}".format(
                        i + 1,
                        self.config.no_of_databases,
                        h + 1,
                        self.config.no_of_services,
                    )
                )

                for j in range(self.config.no_of_tables):
                    table_columns = []
                    table_entity = Table(
                        id=uuid.uuid4(),
                        name=self.table_name().replace(".", "_"),
                        tableType="Regular",
                        description=self.description(),
                        columns=table_columns,
                    )
                    row_order = 0
                    for t in range(self.config.no_of_columns):
                        tag_labels = []
                        tag_entity = random.choice(self.tags)
                        tag_labels.append(
                            TagLabel(
                                tagFQN=tag_entity.fullyQualifiedName,
                                labelType="Automated",
                                state="Suggested",
                                href=tag_entity.href,
                            )
                        )
                        table_columns.append(
                            Column(
                                name=self.column_name(),
                                description=self.description(),
                                dataType=self.col_type(),
                                constraint=self.col_constraint(),
                                dataLength=100,
                                ordinalPosition=row_order,
                                tags=tag_labels,
                            )
                        )
                        table_entity.columns = table_columns
                        row_order = row_order + 1

                    table_and_db = OMetaDatabaseAndTable(
                        table=table_entity, database=db
                    )
                    yield table_and_db

    def ingest_dashboards(self) -> Iterable[Dashboard]:
        for h in range(self.config.no_of_services):
            create_service = None
            while True:
                try:
                    service = {
                        "name": self.service_name(),
                        "description": self.description(),
                        "dashboardUrl": "http://localhost:8088",
                        "userName": "admin",
                        "password": "admin",
                        "serviceType": "Superset",
                    }
                    create_service = self.metadata.create_or_update(
                        CreateDashboardServiceEntityRequest(**service)
                    )
                    break
                except APIError as err:
                    continue

            logger.info(
                "Ingesting service {}/{}".format(h + 1, self.config.no_of_services)
            )
            for i in range(self.config.no_of_dashboards):
                logger.info(
                    "Ingesting dashboard {}/{} in service: {}/{}".format(
                        i + 1,
                        self.config.no_of_databases,
                        h + 1,
                        self.config.no_of_services,
                    )
                )
                chart_ids = []
                for j in range(self.config.no_of_charts):
                    charts = []
                    chart_id = self.chart_ids()
                    chart_entity = Chart(
                        id=uuid.uuid4(),
                        name=str(chart_id),
                        displayName=self.table_name(),
                        description=self.description(),
                        chart_type=self.chart_type(),
                        chartId=str(chart_id),
                        url="http://superset:8080/chartUrl",
                        service=EntityReference(
                            id=create_service.id, type="dashboardService"
                        ),
                    )
                    chart_ids.append(str(chart_id))
                    yield chart_entity

                dashboard = Dashboard(
                    id=uuid.uuid4(),
                    name=str(self.chart_ids()),
                    displayName=self.table_name(),
                    description=self.description(),
                    url="http://superset:8080/dashboardUrl",
                    charts=chart_ids,
                    service=EntityReference(
                        id=create_service.id, type="dashboardService"
                    ),
                )
                yield dashboard

    def ingest_topics(self) -> Iterable[CreateTopicEntityRequest]:
        for h in range(self.config.no_of_services):
            create_service = None
            while True:
                try:
                    service = {
                        "name": self.service_name(),
                        "description": self.description(),
                        "brokers": ["localhost:9092"],
                        "schemaRegistry": "http://localhost:8081",
                        "serviceType": "Kafka",
                    }
                    create_service = self.metadata.create_or_update(
                        CreateMessagingServiceEntityRequest(**service)
                    )
                    break
                except APIError as err:
                    continue

            logger.info(
                "Ingesting service {}/{}".format(h + 1, self.config.no_of_services)
            )
            for j in range(self.config.no_of_topics):
                topic_entity = CreateTopicEntityRequest(
                    name=self.table_name(),
                    description=self.description(),
                    partitions=self.chart_ids(),
                    retentionSize=322122382273,
                    replicationFactor=2,
                    maximumMessageSize=167,
                    cleanupPolicies=["delete"],
                    schemaType="Avro",
                    schemaText='{"namespace":"org.open-metadata.kafka","name":"Customer","type":"record","fields":[{"name":"id","type":"string"},{"name":"first_name","type":"string"},{"name":"last_name","type":"string"},{"name":"email","type":"string"},{"name":"address_line_1","type":"string"},{"name":"address_line_2","type":"string"},{"name":"post_code","type":"string"},{"name":"country","type":"string"}]}',
                    service=EntityReference(
                        id=create_service.id, type="messagingService"
                    ),
                )
                yield topic_entity

    def close(self):
        pass

    def get_status(self):
        return self.status
