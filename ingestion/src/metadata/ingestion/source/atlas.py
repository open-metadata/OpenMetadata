import logging
import traceback
import uuid
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

from pydantic import SecretStr

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.data.topic import SchemaType, Topic
from metadata.generated.schema.entity.services.messagingService import (
    MessagingServiceType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.utils.atlas_client import AtlasClient, AtlasSourceConfig
from metadata.utils.column_helpers import get_column_type
from metadata.utils.helpers import (
    get_database_service_or_create,
    get_messaging_service_or_create,
)

logger: logging.Logger = logging.getLogger(__name__)


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
    tables: List[str]

    def __init__(
        self,
        config: AtlasSourceConfig,
        metadata_config: MetadataServerConfig,
        ctx: WorkflowContext,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = AtlasSourceStatus()
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

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = AtlasSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        self.tables = self.atlas_client.list_entities()

    def next_record(self):
        yield from self._parse_table_entity()

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def _parse_table_entity(self):
        for table in self.tables:
            table_entity = self.atlas_client.get_table(table)
            tbl_entities = table_entity["entities"]
            for tbl_entity in tbl_entities:
                try:
                    tbl_columns = self._parse_table_columns(table_entity, tbl_entity)
                    tbl_attrs = tbl_entity["attributes"]
                    db_entity = tbl_entity["relationshipAttributes"]["rdbms_db"]
                    db = self._get_database(db_entity["displayText"])
                    table_name = tbl_attrs["name"]
                    fqn = f"{self.config.service_name}.{db.name.__root__}.{table_name}"
                    tbl_description = (
                        tbl_attrs["description"]
                        if tbl_attrs["description"] is not None
                        else " "
                    )

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

                    tbl_attrs = tbl_entity["attributes"]
                    table_name = tbl_attrs["name"]
                    topic = CreateTopicRequest(
                        name=table_name[0:63],
                        service=EntityReference(
                            id=self.service.id, type="messagingService"
                        ),
                        partitions=1,
                    )

                    yield topic

                    tbl_columns = self._parse_table_columns(table_entity, tbl_entity)
                    tbl_attrs = tbl_entity["attributes"]
                    db_entity = tbl_entity["relationshipAttributes"]["rdbms_db"]
                    db = self._get_database(db_entity["displayText"])
                    table_name = tbl_attrs["name"]

                    om_table_entity = CreateTableRequest(
                        name=table_name, columns=tbl_columns, database=db.id
                    )
                    created_table = self.metadata.create_or_update(om_table_entity)
                    yield created_table

                except Exception as e:
                    logger.error("error occured", e)
                    logger.error(f"Failed to parse {table_entity}")
                    pass

            if self.config.service_name == "atlas_lineage":
                yield from self.ingest_lineage(table)

    def _parse_table_columns(self, table_response, tbl_entity) -> List[Column]:
        om_cols = []
        col_entities = tbl_entity["relationshipAttributes"]["columns"]
        referred_entities = table_response["referredEntities"]
        dataset_name = tbl_entity["attributes"]["name"]
        ordinal_pos = 1
        for col in col_entities:
            try:
                col_guid = col["guid"]
                col_ref_entity = referred_entities[col_guid]
                column = col_ref_entity["attributes"]
                data_type_display = tbl_entity["attributes"]["name"]
                col_data_length = "1"
                om_column = Column(
                    name=column["name"],
                    description=column.get("comment", None),
                    dataType=get_column_type(
                        self.status, dataset_name, column["dataType"].upper()
                    ),
                    dataTypeDisplay="{}({})".format(column["dataType"], "1")
                    if data_type_display is None
                    else f"{data_type_display}",
                    dataLength=col_data_length,
                    ordinalPosition=ordinal_pos,
                )
                om_cols.append(om_column)
            except Exception as err:
                logger.error(f"{err}")
                continue
        return om_cols

    def _get_database(self, database_name: str) -> Database:
        return Database(
            name=database_name,
            service=EntityReference(id=self.service.id, type=self.config.service_type),
        )

    def _parse_table_columns(self, table_response, tbl_entity) -> List[Column]:
        om_cols = []
        col_entities = tbl_entity["relationshipAttributes"]["rdbms_columns"]
        referred_entities = table_response["referredEntities"]
        dataset_name = tbl_entity["attributes"]["name"]
        ordinal_pos = 1
        for col in col_entities:
            try:
                col_guid = col["guid"]
                col_ref_entity = referred_entities[col_guid]
                column = col_ref_entity["attributes"]
                data_type_display = tbl_entity["attributes"]["name"]
                logger.info(column["data_type"])
                logger.info(
                    get_column_type(
                        self.status, dataset_name, column["data_type"].upper()
                    )
                )
                col_data_length = "1"
                om_column = Column(
                    name=column["name"],
                    description=column.get("comment", None),
                    dataType=get_column_type(
                        self.status, dataset_name, column["data_type"].upper()
                    ),
                    dataTypeDisplay="{}({})".format(column["data_type"], "1"),
                    dataLength=col_data_length,
                    ordinalPosition=ordinal_pos,
                )
                om_cols.append(om_column)
            except Exception as err:
                logger.error(f"{err}")
                continue
        return om_cols

    def ingest_lineage(self, source_guid) -> Iterable[AddLineageRequest]:
        lineageResponse = self.atlas_client.get_lineage(source_guid)
        lineage_relations = lineageResponse["relations"]
        tbl_entity = self.atlas_client.get_table(lineageResponse["baseEntityGuid"])
        tbl_attrs = tbl_entity["attributes"]
        db_entity = tbl_entity["relationshipAttributes"]["rdbms_db"]
        db = self._get_database(db_entity["displayText"])
        table_name = tbl_attrs["name"]
        fqn = f"{self.config.service_name}.{db.name.__root__}.{table_name}"
        from_entity_ref = self.get_lineage_entity_ref(
            fqn, self.metadata_config, "table"
        )
        for edge in lineage_relations:
            if (
                lineageResponse["guidEntityMap"][edge["toEntityId"]]["typeName"]
                == "processor"
            ):
                continue
            tbl_entity = self.atlas_client.get_table(edge["toEntityId"])
            tbl_attrs = tbl_entity["attributes"]
            db_entity = tbl_entity["relationshipAttributes"]["rdbms_db"]
            db = self._get_database(db_entity["displayText"])
            table_name = tbl_attrs["name"]
            fqn = f"{self.config.service_name}.{db.name.__root__}.{table_name}"
            to_entity_ref = self.get_lineage_entity_ref(
                fqn, self.metadata_config, "table"
            )
            lineage = AddLineageRequest(
                edge=EntitiesEdge(fromEntity=from_entity_ref, toEntity=to_entity_ref)
            )
            yield lineage

    def get_lineage_entity_ref(self, fqn, metadata_config, type) -> EntityReference:
        metadata = OpenMetadata(metadata_config)
        if type == "table":
            table = metadata.get_by_name(entity=Table, fqdn=fqn)
            return EntityReference(id=table.id, type="table")
        elif type == "pipeline":
            pipeline = metadata.get_by_name(entity=Pipeline, fqdn=fqn)
            return EntityReference(id=pipeline.id, type="pipeline")
