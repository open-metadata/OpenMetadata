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
DBT source methods.
"""
import traceback
from typing import Dict, Iterable, List, Optional

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    DataModel,
    ModelType,
    Table,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DBTMixin:

    metadata: OpenMetadata

    def get_data_model(self, table_fqn: str) -> Optional[DataModel]:
        return self.data_models.get(table_fqn)

    def _parse_data_model(self):
        """
        Get all the DBT information and feed it to the Table Entity
        """
        if (
            self.source_config.dbtConfigSource
            and self.dbt_manifest
            and self.dbt_catalog
        ):
            logger.info("Parsing Data Models")
            self.manifest_entities = {
                **self.dbt_manifest["nodes"],
                **self.dbt_manifest["sources"],
            }
            self.catalog_entities = {
                **self.dbt_catalog["nodes"],
                **self.dbt_catalog["sources"],
            }

            for key, mnode in self.manifest_entities.items():
                try:
                    name = mnode["alias"] if "alias" in mnode.keys() else mnode["name"]
                    cnode = self.catalog_entities.get(key)
                    columns = (
                        self._parse_data_model_columns(name, mnode, cnode)
                        if cnode
                        else []
                    )

                    if mnode["resource_type"] == "test":
                        continue
                    upstream_nodes = self._parse_data_model_upstream(mnode)
                    model_name = (
                        mnode["alias"] if "alias" in mnode.keys() else mnode["name"]
                    )
                    database = mnode["database"] if mnode["database"] else "default"
                    schema = mnode["schema"] if mnode["schema"] else "default"
                    raw_sql = mnode.get("raw_sql", "")
                    description = mnode.get("description")
                    model = DataModel(
                        modelType=ModelType.DBT,
                        description=description if description else None,
                        path=f"{mnode['root_path']}/{mnode['original_file_path']}",
                        rawSql=raw_sql,
                        sql=mnode.get("compiled_sql", raw_sql),
                        columns=columns,
                        upstream=upstream_nodes,
                    )
                    model_fqn = fqn.build(
                        self.metadata,
                        entity_type=DataModel,
                        service_name=self.config.serviceName,
                        database_name=database,
                        schema_name=schema,
                        model_name=model_name,
                    )
                    self.data_models[model_fqn] = model
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(err)

    def _parse_data_model_upstream(self, mnode):
        upstream_nodes = []
        if "depends_on" in mnode and "nodes" in mnode["depends_on"]:
            for node in mnode["depends_on"]["nodes"]:
                try:
                    parent_node = self.manifest_entities[node]
                    parent_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.config.serviceName,
                        database_name=parent_node["database"]
                        if parent_node["database"]
                        else "default",
                        schema_name=parent_node["schema"]
                        if parent_node["schema"]
                        else "default",
                        table_name=parent_node["name"],
                    )
                    if parent_fqn:
                        upstream_nodes.append(parent_fqn)
                except Exception as err:  # pylint: disable=broad-except
                    logger.error(
                        f"Failed to parse the node {node} to capture lineage {err}"
                    )
                    continue
        return upstream_nodes

    def _parse_data_model_columns(
        self, model_name: str, mnode: Dict, cnode: Dict
    ) -> List[Column]:
        columns = []
        ccolumns = cnode.get("columns")
        manifest_columns = mnode.get("columns", {})
        for key in ccolumns:
            ccolumn = ccolumns[key]
            col_name = ccolumn["name"].lower()
            try:
                ctype = ccolumn["type"]
                col_type = ColumnTypeParser.get_column_type(ctype)
                description = manifest_columns.get(key.lower(), {}).get("description")
                if description is None:
                    description = ccolumn.get("comment")
                col = Column(
                    name=col_name,
                    description=description if description else None,
                    dataType=col_type,
                    dataLength=1,
                    ordinalPosition=ccolumn["index"],
                )
                columns.append(col)
            except Exception as err:  # pylint: disable=broad-except
                logger.error(f"Failed to parse column {col_name} due to {err}")

        return columns

    def create_dbt_lineage(self) -> Iterable[AddLineageRequest]:
        """
        After everything has been processed, add the lineage info
        """
        logger.info("Processing DBT lineage")
        for data_model_name, data_model in self.data_models.items():
            for upstream_node in data_model.upstream:
                try:
                    from_entity: Table = self.metadata.get_by_name(
                        entity=Table, fqn=upstream_node
                    )
                    to_entity: Table = self.metadata.get_by_name(
                        entity=Table, fqn=data_model_name
                    )
                    if from_entity and to_entity:
                        yield AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=from_entity.id.__root__,
                                    type="table",
                                ),
                                toEntity=EntityReference(
                                    id=to_entity.id.__root__,
                                    type="table",
                                ),
                            )
                        )

                except Exception as err:  # pylint: disable=broad-except
                    logger.error(
                        f"Failed to parse the node {upstream_node} to capture lineage {err}"
                    )
