import logging
import uuid
from dataclasses import dataclass, field
from typing import List

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import IncludeFilterPattern, WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.utils.atlas_client import AtlasClient, AtlasSourceConfig
from metadata.utils.helpers import get_database_service_or_create

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
        self.atlas_client = AtlasClient(config)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = AtlasSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        self.tables = self.atlas_client.list_entities()

    def next_record(self):
        for table in self.tables:
            table_entity = self.atlas_client.get_table(table)
            yield from self._parse_table_entity(table_entity)

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def _parse_table_entity(self, table_entity):
        tbl_entities = table_entity["entities"]
        for tbl_entity in tbl_entities:
            try:
                tbl_columns = self._parse_table_columns(table_entity, tbl_entity)
                tbl_attrs = tbl_entity["attributes"]
                db_entity = tbl_entity["relationshipAttributes"]["db"]
                db = self._get_database(db_entity["displayText"])
                table_name = tbl_attrs["name"]
                fqn = f"{self.config.service_name}.{db.name.__root__}.{table_name}"
                tbl_description = (
                    tbl_attrs["description"]
                    if tbl_attrs["description"] is not None
                    else " "
                )
                tbl_type = tbl_attrs["tableType"]
                tbl_type = "Regular" if tbl_type == "Managed" else tbl_type
                om_table_entity = Table(
                    id=uuid.uuid4(),
                    name=table_name,
                    tableType=tbl_type,
                    description=tbl_description,
                    fullyQualifiedName=fqn,
                    columns=tbl_columns,
                )
                table_and_db = OMetaDatabaseAndTable(table=om_table_entity, database=db)
                yield table_and_db
            except Exception as e:
                logger.error(e)
                logger.error(f"Failed to parse {table_entity}")
                pass

    def _parse_table_columns(self, table_response, tbl_entity) -> List[Column]:
        om_cols = []
        col_entities = tbl_entity["relationshipAttributes"]["columns"]
        referred_entities = table_response["referredEntities"]
        ordinal_pos = 1
        for col in col_entities:
            col_guid = col["guid"]
            col_ref_entity = referred_entities[col_guid]
            column = col_ref_entity["attributes"]
            data_type_display = column["dataType"].upper()
            col_data_length = "1"
            om_column = Column(
                name=column["name"],
                description=column.get("comment", None),
                dataType=column["dataType"].upper(),
                dataTypeDisplay="{}({})".format(column["dataType"], "1")
                if data_type_display is None
                else f"{data_type_display}",
                dataLength=col_data_length,
                ordinalPosition=ordinal_pos,
            )
            om_cols.append(om_column)
        return om_cols

    def _get_database(self, database_name: str) -> Database:
        return Database(
            name=database_name,
            service=EntityReference(id=self.service.id, type=self.config.service_type),
        )
