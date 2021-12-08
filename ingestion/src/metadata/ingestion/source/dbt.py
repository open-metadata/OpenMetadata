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
import uuid
from typing import Dict, Iterable, Optional

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.dbtmodel import DbtModel
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity, IncludeFilterPattern
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndModel
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLSourceStatus
from metadata.utils.column_helpers import get_column_type, register_custom_str_type
from metadata.utils.helpers import get_database_service_or_create

logger: logging.Logger = logging.getLogger(__name__)


class DBTSourceConfig(ConfigModel):
    service_type: str
    service_name: str
    manifest_file: str
    catalog_file: str
    run_results_file: Optional[str]
    database: str
    host_port: str = "localhost"
    filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()

    def get_service_type(self) -> DatabaseServiceType:
        return DatabaseServiceType[self.service_type]


register_custom_str_type("CHARACTER VARYING", "VARCHAR")


class DbtSource(Source[Entity]):
    dbt_manifest: Dict
    dbt_catalog: Dict
    dbt_run_results: Dict
    manifest_schema: str
    manifest_version: str
    catalog_schema: str
    catalog_version: str

    def __init__(
        self, config: DBTSourceConfig, metadata_config: MetadataServerConfig, ctx
    ):
        super().__init__(ctx)
        self.status = SQLSourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service = get_database_service_or_create(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = DBTSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        self.dbt_catalog = json.load(open(self.config.catalog_file, "r"))
        self.dbt_manifest = json.load(open(self.config.manifest_file, "r"))
        if self.config.run_results_file is not None:
            self.dbt_run_results = json.load(open(self.config.run_results_file, "r"))

        if "metadata" in self.dbt_manifest.keys():
            self.manifest_schema = self.dbt_manifest["metadata"]["dbt_schema_version"]
            self.manifest_version = self.dbt_manifest["metadata"]["dbt_version"]
        if "metadata" in self.dbt_catalog.keys():
            self.catalog_schema = self.dbt_catalog["metadata"]["dbt_schema_version"]
            self.catalog_version = self.dbt_manifest["metadata"]["dbt_version"]

    def next_record(self) -> Iterable[Entity]:
        yield from self._parse_dbt()

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def _get_database(self, database_name: str) -> Database:
        return Database(
            name=database_name,
            service=EntityReference(id=self.service.id, type=self.config.service_type),
        )

    def _parse_columns(self, model_name: str, cnode: Dict) -> [Column]:
        columns = []
        ccolumns = cnode.get("columns")

        for key in ccolumns:
            ccolumn = ccolumns[key]
            try:
                ctype = ccolumn["type"]
                col_type = get_column_type(self.status, model_name, ctype)
                col = Column(
                    name=ccolumn["name"].lower(),
                    description=ccolumn.get("comment", ""),
                    dataType=col_type,
                    dataLength=1,
                    ordinalPosition=ccolumn["index"],
                )
                columns.append(col)
            except Exception as e:
                logger.error(f"Failed to parse column type due to {e}")

        return columns

    def _parse_dbt(self):
        manifest_nodes = self.dbt_manifest["nodes"]
        manifest_sources = self.dbt_manifest["sources"]
        manifest_entities = {**manifest_nodes, **manifest_sources}
        catalog_nodes = self.dbt_catalog["nodes"]
        catalog_sources = self.dbt_catalog["sources"]
        catalog_entities = {**catalog_nodes, **catalog_sources}

        for key, mnode in manifest_entities.items():
            name = mnode["alias"] if "alias" in mnode.keys() else mnode["name"]
            description = mnode.get("description", "")
            cnode = catalog_entities.get(key)
            database = self._get_database(mnode["database"])
            if cnode is not None:
                columns = self._parse_columns(name, cnode)
            else:
                columns = []
            if mnode["resource_type"] == "test":
                continue
            model = DbtModel(
                id=uuid.uuid4(),
                name=name,
                description=description,
                dbtNodeType=mnode["resource_type"].capitalize(),
                viewDefinition=mnode["raw_sql"],
                columns=columns,
            )
            model_and_db = OMetaDatabaseAndModel(model=model, database=database)
            yield model_and_db
