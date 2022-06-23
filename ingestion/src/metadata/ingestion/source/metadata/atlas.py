import json
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingServiceType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.atlas_client import AtlasClient, AtlasSourceConfig
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.fqn import FQN_SEPARATOR
from metadata.utils.helpers import (
    get_database_service_or_create,
    get_messaging_service_or_create,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


@dataclass
class AtlasSourceStatus(SourceStatus):
    tables_scanned: List[str] = field(default_factory=list)
    filtered: List[str] = field(default_factory=list)

    def table_scanned(self, table: str) -> None:
        self.tables_scanned.append(table)

    def dropped(self, topic: str) -> None:
        self.filtered.append(topic)


@dataclass
class AtlasSource(Source):
    config: AtlasSourceConfig
    atlas_client: AtlasClient
    status: AtlasSourceStatus
    tables: Dict[str, Any]
    topics: Dict[str, Any]

    def __init__(
        self,
        config: AtlasSourceConfig,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.status = AtlasSourceStatus()
        # TODO: use metadata.get_service_or_create
        self.service = get_database_service_or_create(config, metadata_config)

        schema_registry_url = "http://localhost:8081"
        bootstrap_servers = "http://localhost:9092"
        self.message_service = get_messaging_service_or_create(
            config.service_name,
            MessagingServiceType.Kafka.name,
            schema_registry_url,
            bootstrap_servers.split(","),
            metadata_config,
        )
        self.atlas_client = AtlasClient(config)
        path = Path(self.config.entity_types)
        if not path.is_file():
            logger.error(f"File not found {self.config.entity_types}")
            raise FileNotFoundError()
        f = open(self.config.entity_types)
        self.config.entity_types = json.load(f)
        self.tables: Dict[str, Any] = {}
        self.topics: Dict[str, Any] = {}

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = AtlasSourceConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def prepare(self):
        for key in self.config.entity_types["Table"].keys():
            self.tables[key] = self.atlas_client.list_entities(entity_type=key)
        for key in self.config.entity_types["Topic"]:
            self.topics[key] = self.atlas_client.list_entities(entity_type=key)

    def next_record(self):
        if self.tables:
            for key in self.tables:
                yield from self._parse_table_entity(key, self.tables[key])
        if self.topics:
            for topic in self.topics:
                yield from self._parse_topic_entity(topic)

    def close(self):
        return super().close()

    def get_status(self) -> SourceStatus:
        return self.status

    def _parse_topic_entity(self, name):
        for key in self.topics.keys():
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

                except Exception as e:
                    logger.error("error occured", e)
                    logger.error(f"Failed to parse {topic_entity}")

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
                        self.config.entity_types["Table"][name]["db"]
                    ]
                    db = self.get_database_entity(db_entity["displayText"])
                    table_name = tbl_attrs["name"]
                    fqn = f"{self.config.service_name}{FQN_SEPARATOR}{db.name.__root__}{FQN_SEPARATOR}{table_name}"
                    tbl_description = tbl_attrs["description"]

                    om_table_entity = Table(
                        id=uuid.uuid4(),
                        name=table_name,
                        description=tbl_description,
                        fullyQualifiedName=fqn,
                        columns=tbl_columns,
                    )

                    table_and_db = OMetaDatabaseAndTable(
                        table=om_table_entity, database=db
                    )
                    yield table_and_db

                    yield from self.ingest_lineage(tbl_entity["guid"], name)

                except Exception as e:
                    logger.error("error occured", e)
                    logger.error(f"Failed to parse {table_entity}")

    def _parse_table_columns(self, table_response, tbl_entity, name) -> List[Column]:
        om_cols = []
        col_entities = tbl_entity["relationshipAttributes"][
            self.config.entity_types["Table"][name]["column"]
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
                    dataTypeDisplay="{}({})".format(column["dataType"], "1"),
                    dataLength=col_data_length,
                    ordinalPosition=ordinal_pos,
                )
                om_cols.append(om_column)
            except Exception as err:
                logger.error(f"{err}")
                continue
        return om_cols

    def get_database_entity(self, database_name: str) -> Database:
        return Database(
            name=database_name,
            service=EntityReference(id=self.service.id, type=self.config.service_type),
        )

    def ingest_lineage(self, source_guid, name) -> Iterable[AddLineageRequest]:
        lineage_response = self.atlas_client.get_lineage(source_guid)
        lineage_relations = lineage_response["relations"]
        tbl_entity = self.atlas_client.get_entity(lineage_response["baseEntityGuid"])
        for key in tbl_entity["referredEntities"].keys():
            db_entity = tbl_entity["entities"][0]["relationshipAttributes"][
                self.config.entity_types["Table"][name]["db"]
            ]
            db = self.get_database_entity(db_entity["displayText"])
            table_name = tbl_entity["referredEntities"][key]["relationshipAttributes"][
                "table"
            ]["displayText"]

            fqn = f"{self.config.service_name}{FQN_SEPARATOR}{db.name.__root__}{FQN_SEPARATOR}{table_name}"
            from_entity_ref = self.get_lineage_entity_ref(
                fqn, self.metadata_config, "table"
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
                        self.config.entity_types["Table"][name]["db"]
                    ]

                    db = self.get_database_entity(db_entity["displayText"])
                    table_name = tbl_entity["referredEntities"][key][
                        "relationshipAttributes"
                    ]["table"]["displayText"]
                    fqn = f"{self.config.service_name}{FQN_SEPARATOR}{db.name.__root__}{FQN_SEPARATOR}{table_name}"
                    to_entity_ref = self.get_lineage_entity_ref(
                        fqn, self.metadata_config, "table"
                    )
                    if (
                        from_entity_ref
                        and to_entity_ref
                        and not from_entity_ref == to_entity_ref
                    ):
                        lineage = AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=from_entity_ref, toEntity=to_entity_ref
                            )
                        )
                        yield lineage

    def get_lineage_entity_ref(self, fqn, metadata_config, type) -> EntityReference:
        metadata = OpenMetadata(metadata_config)
        if type == "table":
            table = metadata.get_by_name(entity=Table, fqn=fqn)
            if not table:
                return
            return EntityReference(id=table.id.__root__, type="table")
        elif type == "pipeline":
            pipeline = metadata.get_by_name(entity=Pipeline, fqn=fqn)
            if not pipeline:
                return
            return EntityReference(id=pipeline.id.__root__, type="pipeline")

    def test_connection(self) -> None:
        pass
