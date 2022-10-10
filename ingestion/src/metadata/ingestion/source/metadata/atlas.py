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

"""
Atlas source to extract metadata
"""

import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List

import yaml

from metadata.clients.atlas_client import AtlasClient
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.connections.metadata.atlasConnection import (
    AtlasConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class AtlasSourceStatus(SourceStatus):
    tables_scanned: List[str] = []
    filtered: List[str] = []

    def table_scanned(self, table: str) -> None:
        self.tables_scanned.append(table)

    def dropped(self, topic: str) -> None:
        self.filtered.append(topic)


@dataclass
class AtlasSource(Source):
    """
    Atlas source class
    """

    config: WorkflowSource
    atlas_client: AtlasClient
    status: AtlasSourceStatus
    tables: Dict[str, Any]
    topics: Dict[str, Any]

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection = self.config.serviceConnection.__root__.config
        self.status = AtlasSourceStatus()

        self.schema_registry_url = "http://localhost:8081"
        self.bootstrap_servers = "http://localhost:9092"

        self.atlas_client = AtlasClient(config)
        path = Path(self.service_connection.entityTypes)
        if not path.is_file():
            logger.error(f"File not found {self.service_connection.entityTypes}")
            raise FileNotFoundError()
        with open(
            self.service_connection.entityTypes, "r", encoding="utf-8"
        ) as entity_types_file:
            self.service_connection.entityTypes = yaml.load(
                entity_types_file, Loader=yaml.SafeLoader
            )
        self.tables: Dict[str, Any] = {}
        self.topics: Dict[str, Any] = {}

        self.service = None
        self.message_service = None

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):

        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: AtlasConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, AtlasConnection):
            raise InvalidSourceException(
                f"Expected AtlasConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        """
        Not required to implement
        """

    def next_record(self):
        for key in self.service_connection.entityTypes["Table"].keys():
            self.service = self.metadata.get_by_name(
                entity=DatabaseService, fqn=self.service_connection.dbService
            )
            self.tables[key] = self.atlas_client.list_entities(entity_type=key)

        for key in self.service_connection.entityTypes.get("Topic", []):
            self.message_service = self.metadata.get_by_name(
                entity=MessagingService, fqn=self.service_connection.messagingService
            )
            self.topics[key] = self.atlas_client.list_entities(entity_type=key)

        if self.tables:
            for key in self.tables:
                yield from self._parse_table_entity(key, self.tables[key])
        if self.topics:
            for topic in self.topics:
                yield from self._parse_topic_entity(topic)

    def close(self):
        """
        Not required to implement
        """

    def get_status(self) -> SourceStatus:
        return self.status

    def _parse_topic_entity(self, name):
        for key in self.topics:
            topic_entity = self.atlas_client.get_entity(self.topics[key])
            tpc_entities = topic_entity["entities"]
            for tpc_entity in tpc_entities:
                try:
                    tpc_attrs = tpc_entity["attributes"]
                    topic_name = tpc_attrs["name"]
                    topic = CreateTopicRequest(
                        name=topic_name[0:63],
                        service=EntityReference(
                            id=self.message_service.id, type="messagingService"
                        ),
                        partitions=1,
                    )

                    yield topic
                    yield from self.ingest_lineage(tpc_entity["guid"], name)

                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Failed to parse topi entry [{topic_entity}]: {exc}"
                    )

    def _parse_table_entity(self, name, entity):
        for table in entity:
            table_entity = self.atlas_client.get_entity(table)
            tbl_entities = table_entity["entities"]
            for tbl_entity in tbl_entities:
                try:
                    tbl_columns = self._parse_table_columns(
                        table_entity, tbl_entity, name
                    )
                    tbl_attrs = tbl_entity["attributes"]
                    db_entity = tbl_entity["relationshipAttributes"][
                        self.service_connection.entityTypes["Table"][name]["db"]
                    ]
                    yield self.get_database_entity(db_entity["displayText"])

                    database_fqn = fqn.build(
                        self.metadata,
                        entity_type=Database,
                        service_name=self.service_connection.dbService,
                        database_name=db_entity["displayText"],
                    )

                    database_object = self.metadata.get_by_name(
                        entity=Database, fqn=database_fqn
                    )

                    yield CreateDatabaseSchemaRequest(
                        name=db_entity["displayText"],
                        database=EntityReference(
                            id=database_object.id, type="database"
                        ),
                    )

                    database_schema_fqn = fqn.build(
                        self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.config.serviceConnection.__root__.config.dbService,
                        database_name=db_entity["displayText"],
                        schema_name=db_entity["displayText"],
                    )
                    database_schema_object = self.metadata.get_by_name(
                        entity=DatabaseSchema, fqn=database_schema_fqn
                    )

                    yield CreateTableRequest(
                        name=tbl_attrs["name"],
                        databaseSchema=EntityReference(
                            id=database_schema_object.id, type="databaseSchema"
                        ),
                        description=tbl_attrs["description"],
                        columns=tbl_columns,
                    )

                    yield from self.ingest_lineage(tbl_entity["guid"], name)

                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Failed to parse {table_entity}: {exc}")

    def _parse_table_columns(self, table_response, tbl_entity, name) -> List[Column]:
        om_cols = []
        col_entities = tbl_entity["relationshipAttributes"][
            self.service_connection.entityTypes["Table"][name]["column"]
        ]
        referred_entities = table_response["referredEntities"]
        ordinal_pos = 1
        for col in col_entities:
            try:
                col_guid = col["guid"]
                col_ref_entity = referred_entities[col_guid]
                column = col_ref_entity["attributes"]
                col_data_length = "1"
                om_column = Column(
                    name=column["name"],
                    description=column.get("comment", None),
                    dataType=ColumnTypeParser.get_column_type(
                        column["dataType"].upper()
                    ),
                    dataTypeDisplay=column["dataType"],
                    dataLength=col_data_length,
                    ordinalPosition=ordinal_pos,
                )
                om_cols.append(om_column)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error parsing column [{col}]: {exc}")
                continue
        return om_cols

    def get_database_entity(self, database_name: str) -> Database:
        return CreateDatabaseRequest(
            name=database_name,
            service=EntityReference(id=self.service.id, type="databaseService"),
        )

    def ingest_lineage(self, source_guid, name) -> Iterable[AddLineageRequest]:
        """
        Fetch and ingest lineage
        """
        lineage_response = self.atlas_client.get_lineage(source_guid)
        lineage_relations = lineage_response["relations"]
        tbl_entity = self.atlas_client.get_entity(lineage_response["baseEntityGuid"])
        for key in tbl_entity["referredEntities"].keys():
            if not tbl_entity["entities"][0]["relationshipAttributes"].get(
                self.service_connection.entityTypes["Table"][name]["db"]
            ):
                continue
            db_entity = tbl_entity["entities"][0]["relationshipAttributes"][
                self.service_connection.entityTypes["Table"][name]["db"]
            ]
            if not tbl_entity["referredEntities"].get(key):
                continue
            table_name = tbl_entity["referredEntities"][key]["relationshipAttributes"][
                "table"
            ]["displayText"]
            from_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=self.config.serviceName,
                database_name=db_entity["displayText"],
                schema_name=db_entity["displayText"],
                table_name=table_name,
            )
            from_entity_ref = self.get_lineage_entity_ref(
                from_fqn, self.metadata_config, "table"
            )
            for edge in lineage_relations:
                if (
                    lineage_response["guidEntityMap"][edge["toEntityId"]]["typeName"]
                    == "processor"
                ):
                    continue

                tbl_entity = self.atlas_client.get_entity(edge["toEntityId"])
                for key in tbl_entity["referredEntities"]:
                    db_entity = tbl_entity["entities"][0]["relationshipAttributes"][
                        self.service_connection.entityTypes["Table"][name]["db"]
                    ]

                    db = self.get_database_entity(db_entity["displayText"])
                    table_name = tbl_entity["referredEntities"][key][
                        "relationshipAttributes"
                    ]["table"]["displayText"]
                    to_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.config.serviceName,
                        database_name=db.name.__root__,
                        schema_name=db_entity["displayText"],
                        table_name=table_name,
                    )
                    to_entity_ref = self.get_lineage_entity_ref(
                        to_fqn, self.metadata_config, "table"
                    )
                    yield from self.yield_lineage(from_entity_ref, to_entity_ref)

    def yield_lineage(self, from_entity_ref, to_entity_ref):
        if from_entity_ref and to_entity_ref and from_entity_ref != to_entity_ref:
            lineage = AddLineageRequest(
                edge=EntitiesEdge(fromEntity=from_entity_ref, toEntity=to_entity_ref)
            )
            yield lineage

    def get_lineage_entity_ref(
        self, to_fqn, metadata_config, entity_type
    ) -> EntityReference:
        metadata = OpenMetadata(metadata_config)
        if entity_type == "table":
            table = metadata.get_by_name(entity=Table, fqn=to_fqn)
            if table:
                return EntityReference(id=table.id.__root__, type="table")
        if entity_type == "pipeline":
            pipeline = metadata.get_by_name(entity=Pipeline, fqn=to_fqn)
            if pipeline:
                return EntityReference(id=pipeline.id.__root__, type="pipeline")
        return None

    def test_connection(self) -> None:
        pass
