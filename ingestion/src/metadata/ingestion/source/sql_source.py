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
Generic source to build SQL connectors.
"""
import json
import logging
import re
import traceback
import uuid
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy import create_engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    DataModel,
    ModelType,
    Table,
    TableData,
    TableProfile,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity, WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.table_metadata import DeleteTable
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source_common import (
    SQLConnectionConfig,
    SQLSourceStatus,
)
from metadata.utils.column_helpers import check_column_complex_type, get_column_type
from metadata.utils.helpers import get_database_service_or_create

logger: logging.Logger = logging.getLogger(__name__)


def _get_table_description(schema: str, table: str, inspector: Inspector) -> str:
    description = None
    try:
        table_info: dict = inspector.get_table_comment(table, schema)
    # Catch any exception without breaking the ingestion
    except Exception as err:  # pylint: disable=broad-except
        logger.error(f"Table Description Error : {err}")
    else:
        description = table_info["text"]
    return description


class SQLSource(Source[OMetaDatabaseAndTable]):
    """
    Source Connector implementation to extract
    Database & Table information and convert it
    to OpenMetadata Entities
    """

    def __init__(
        self,
        config: SQLConnectionConfig,
        metadata_config: MetadataServerConfig,
        ctx: WorkflowContext,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.service = get_database_service_or_create(config, metadata_config)
        self.metadata = OpenMetadata(metadata_config)
        self.status = SQLSourceStatus()
        self.sql_config = self.config
        self.connection_string = self.sql_config.get_connection_url()
        self.engine = create_engine(
            self.connection_string,
            **self.sql_config.options,
            connect_args=self.sql_config.connect_args,
        )
        self.connection = self.engine.connect()
        self.data_profiler = None
        self.data_models = {}
        self.database_source_state = set()
        if self.config.dbt_catalog_file is not None:
            with open(self.config.dbt_catalog_file, "r", encoding="utf-8") as catalog:
                self.dbt_catalog = json.load(catalog)
        if self.config.dbt_manifest_file is not None:
            with open(self.config.dbt_manifest_file, "r", encoding="utf-8") as manifest:
                self.dbt_manifest = json.load(manifest)

    def _instantiate_profiler(self) -> bool:
        """
        If the profiler is configured, load it and run.

        Return True if the profiling ran correctly
        """
        try:
            if self.config.data_profiler_enabled:
                if self.data_profiler is None:
                    # pylint: disable=import-outside-toplevel
                    from metadata.profiler.dataprofiler import DataProfiler

                    # pylint: enable=import-outside-toplevel

                    self.data_profiler = DataProfiler(
                        status=self.status, config=self.config
                    )
                return True
        # Catch any errors during profiling init and continue ingestion
        except Exception as exc:  # pylint: disable=broad-except
            logger.error(
                f"Error loading profiler {exc}"
                "DataProfiler configuration is enabled. Please make sure you ran "
                "pip install 'openmetadata-ingestion[data-profiler]'"
            )
        return False

    def prepare(self):
        self._parse_data_model()

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        pass

    @staticmethod
    def standardize_schema_table_names(schema: str, table: str) -> Tuple[str, str]:
        return schema, table

    def fetch_sample_data(self, schema: str, table: str) -> Optional[TableData]:
        """
        Get some sample data from the source to be added
        to the Table Entities
        """
        try:
            query = self.config.query.format(schema, table)
            logger.info(query)
            results = self.connection.execute(query)
            cols = []
            for col in results.keys():
                cols.append(col.replace(".", "_DOT_"))
            rows = []
            for res in results:
                row = list(res)
                rows.append(row)
            return TableData(columns=cols, rows=rows)
        # Catch any errors and continue the ingestion
        except Exception as err:  # pylint: disable=broad-except
            logger.error(f"Failed to generate sample data for {table} - {err}")
        return None

    def next_record(self) -> Iterable[Entity]:
        inspector = inspect(self.engine)
        schema_names = inspector.get_schema_names()
        for schema in schema_names:
            # clear any previous source database state
            self.database_source_state.clear()
            if not self.sql_config.schema_filter_pattern.included(schema):
                self.status.filter(schema, "Schema pattern not allowed")
                continue
            if self.config.include_tables:
                yield from self.fetch_tables(inspector, schema)
            if self.config.include_views:
                yield from self.fetch_views(inspector, schema)
            if self.config.mark_deleted_tables_as_deleted:
                schema_fqdn = f"{self.config.service_name}.{schema}"
                yield from self.delete_tables(schema_fqdn)

    def fetch_tables(
        self, inspector: Inspector, schema: str
    ) -> Iterable[OMetaDatabaseAndTable]:
        """
        Scrape an SQL schema and prepare Database and Table
        OpenMetadata Entities
        """
        tables = inspector.get_table_names(schema)
        for table_name in tables:
            try:
                schema, table_name = self.standardize_schema_table_names(
                    schema, table_name
                )
                if not self.sql_config.table_filter_pattern.included(table_name):
                    self.status.filter(
                        f"{self.config.get_service_name()}.{table_name}",
                        "Table pattern not allowed",
                    )
                    continue
                description = _get_table_description(schema, table_name, inspector)
                fqn = f"{self.config.service_name}.{schema}.{table_name}"
                self.database_source_state.add(fqn)
                table_columns = self._get_columns(schema, table_name, inspector)
                table_entity = Table(
                    id=uuid.uuid4(),
                    name=table_name,
                    tableType="Regular",
                    description=description if description is not None else " ",
                    fullyQualifiedName=fqn,
                    columns=table_columns,
                )
                try:
                    if self.sql_config.generate_sample_data:
                        table_data = self.fetch_sample_data(schema, table_name)
                        table_entity.sampleData = table_data
                # Catch any errors during the ingestion and continue
                except Exception as err:  # pylint: disable=broad-except
                    logger.error(repr(err))
                    logger.error(err)

                if self._instantiate_profiler():
                    profile = self.run_data_profiler(table_name, schema)
                    table_entity.tableProfile = (
                        [profile] if profile is not None else None
                    )
                # check if we have any model to associate with
                table_entity.dataModel = self._get_data_model(schema, table_name)

                table_and_db = OMetaDatabaseAndTable(
                    table=table_entity, database=self._get_database(schema)
                )
                yield table_and_db
                self.status.scanned(
                    "{}.{}".format(self.config.get_service_name(), table_name)
                )
            except Exception as err:
                traceback.print_exc()
                logger.error(err)
                self.status.failures.append(
                    "{}.{}".format(self.config.service_name, table_name)
                )
                continue

    def fetch_views(
        self, inspector: Inspector, schema: str
    ) -> Iterable[OMetaDatabaseAndTable]:
        """
        Get all views in the SQL schema and prepare
        Database & Table OpenMetadata Entities
        """
        for view_name in inspector.get_view_names(schema):
            try:
                if self.config.scheme == "bigquery":
                    schema, view_name = self.standardize_schema_table_names(
                        schema, view_name
                    )
                if not self.sql_config.table_filter_pattern.included(view_name):
                    self.status.filter(
                        f"{self.config.get_service_name()}.{view_name}",
                        "View pattern not allowed",
                    )
                    continue
                try:
                    if self.config.scheme == "bigquery":
                        view_definition = inspector.get_view_definition(
                            f"{self.config.project_id}.{schema}.{view_name}"
                        )
                    else:
                        view_definition = inspector.get_view_definition(
                            view_name, schema
                        )
                    view_definition = (
                        "" if view_definition is None else str(view_definition)
                    )
                except NotImplementedError:
                    view_definition = ""
                fqn = f"{self.config.service_name}.{schema}.{view_name}"
                self.database_source_state.add(fqn)
                table = Table(
                    id=uuid.uuid4(),
                    name=view_name.replace(".", "_DOT_"),
                    tableType="View",
                    description=_get_table_description(schema, view_name, inspector)
                    or "",
                    # This will be generated in the backend!! #1673
                    fullyQualifiedName=view_name,
                    columns=self._get_columns(schema, view_name, inspector),
                    viewDefinition=view_definition,
                )
                if self.sql_config.generate_sample_data:
                    table_data = self.fetch_sample_data(schema, view_name)
                    table.sampleData = table_data
                table.dataModel = self._get_data_model(schema, view_name)
                table_and_db = OMetaDatabaseAndTable(
                    table=table, database=self._get_database(schema)
                )
                yield table_and_db
            # Catch any errors and continue the ingestion
            except Exception as err:  # pylint: disable=broad-except
                logger.error(err)
                self.status.warnings.append(f"{self.config.service_name}.{view_name}")
                continue

    def delete_tables(self, schema_fqdn: str) -> DeleteTable:
        database_state = self._build_database_state(schema_fqdn)
        for table in database_state:
            if table.fullyQualifiedName not in self.database_source_state:
                yield DeleteTable(table=table)

    def _parse_data_model(self):
        """
        Get all the DBT information and feed it to the Table Entity
        """
        if self.config.dbt_manifest_file and self.config.dbt_catalog_file:
            logger.info("Parsing Data Models")
            manifest_entities = {
                **self.dbt_manifest["nodes"],
                **self.dbt_manifest["sources"],
            }
            catalog_entities = {
                **self.dbt_catalog["nodes"],
                **self.dbt_catalog["sources"],
            }

            for key, mnode in manifest_entities.items():
                try:
                    name = mnode["alias"] if "alias" in mnode.keys() else mnode["name"]
                    cnode = catalog_entities.get(key)
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
                    model_name = model_name.replace(".", "_DOT_")
                    schema = mnode["schema"]
                    raw_sql = mnode.get("raw_sql", "")
                    model = DataModel(
                        modelType=ModelType.DBT,
                        description=mnode.get("description", ""),
                        path=f"{mnode['root_path']}/{mnode['original_file_path']}",
                        rawSql=raw_sql,
                        sql=mnode.get("compiled_sql", raw_sql),
                        columns=columns,
                        upstream=upstream_nodes,
                    )
                    model_fqdn = f"{schema}.{model_name}"
                except Exception as err:
                    print(err)
                self.data_models[model_fqdn] = model

    def _parse_data_model_upstream(self, mnode):
        upstream_nodes = []
        if "depends_on" in mnode and "nodes" in mnode["depends_on"]:
            for node in mnode["depends_on"]["nodes"]:
                try:
                    _, database, table = node.split(".", 2)
                    table = table.replace(".", "_DOT_")
                    table_fqn = f"{self.config.service_name}.{database}.{table}"
                    upstream_nodes.append(table_fqn)
                except Exception as err:  # pylint: disable=broad-except
                    logger.error(
                        f"Failed to parse the node {node} to capture lineage {err}"
                    )
                    continue
        return upstream_nodes

    def _get_data_model(self, schema, table_name):
        table_fqn = f"{schema}.{table_name}"
        if table_fqn in self.data_models:
            model = self.data_models[table_fqn]
            return model
        return None

    def _parse_data_model_columns(
        self, model_name: str, mnode: Dict, cnode: Dict
    ) -> [Column]:
        columns = []
        ccolumns = cnode.get("columns")
        manifest_columns = mnode.get("columns", {})
        for key in ccolumns:
            ccolumn = ccolumns[key]
            try:
                ctype = ccolumn["type"]
                col_type = get_column_type(self.status, model_name, ctype)
                description = manifest_columns.get(key.lower(), {}).get(
                    "description", None
                )
                if description is None:
                    description = ccolumn.get("comment", None)
                col = Column(
                    name=ccolumn["name"].lower(),
                    description=description,
                    dataType=col_type,
                    dataLength=1,
                    ordinalPosition=ccolumn["index"],
                )
                columns.append(col)
            except Exception as err:  # pylint: disable=broad-except
                logger.error(f"Failed to parse column type due to {err}")

        return columns

    def _get_database(self, schema: str) -> Database:
        return Database(
            name=schema.replace(".", "_DOT_"),
            service=EntityReference(id=self.service.id, type=self.config.service_type),
        )

    @staticmethod
    def _get_column_constraints(
        column, pk_columns, unique_columns
    ) -> Optional[Constraint]:
        """
        Prepare column constraints for the Table Entity
        """
        constraint = None

        if column["nullable"]:
            constraint = Constraint.NULL
        elif not column["nullable"]:
            constraint = Constraint.NOT_NULL

        if column["name"] in pk_columns:
            constraint = Constraint.PRIMARY_KEY
        elif column["name"] in unique_columns:
            constraint = Constraint.UNIQUE

        return constraint

    def _get_columns(
        self, schema: str, table: str, inspector: Inspector
    ) -> Optional[List[Column]]:
        """
        Get columns types and constraints information
        """

        # Get inspector information:
        pk_constraints = inspector.get_pk_constraint(table, schema)
        try:
            unique_constraints = inspector.get_unique_constraints(table, schema)
        except NotImplementedError:
            logger.warning("Cannot obtain constraints - NotImplementedError")
            unique_constraints = []

        pk_columns = (
            pk_constraints["column_constraints"]
            if len(pk_constraints) > 0 and "column_constraints" in pk_constraints.keys()
            else {}
        )

        unique_columns = [
            constraint["column_names"]
            for constraint in unique_constraints
            if "column_names" in constraint.keys()
        ]

        dataset_name = f"{schema}.{table}"
        table_columns = []
        columns = inspector.get_columns(table, schema)
        try:
            for row_order, column in enumerate(columns):
                try:
                    if "." in column["name"]:
                        logger.info(
                            f"Found '.' in {column['name']}, changing '.' to '_DOT_'"
                        )
                        column["name"] = column["name"].replace(".", "_DOT_")
                    children = None
                    data_type_display = None
                    col_data_length = None
                    arr_data_type = None
                    if (
                        "raw_data_type" in column
                        and column["raw_data_type"] is not None
                    ):
                        column["raw_data_type"] = self.parse_raw_data_type(
                            column["raw_data_type"]
                        )
                        (
                            col_type,
                            data_type_display,
                            arr_data_type,
                            children,
                        ) = check_column_complex_type(
                            self.status,
                            dataset_name,
                            column["raw_data_type"],
                            column["name"],
                        )
                    else:
                        col_type = get_column_type(
                            self.status, dataset_name, column["type"]
                        )
                        if col_type == "ARRAY" and re.match(
                            r"(?:\w*)(?:\()(\w*)(?:.*)", str(column["type"])
                        ):
                            arr_data_type = re.match(
                                r"(?:\w*)(?:[(]*)(\w*)(?:.*)", str(column["type"])
                            ).groups()
                            data_type_display = column["type"]
                    if repr(column["type"]).upper().startswith("ARRAY("):
                        arr_data_type = "STRUCT"
                        data_type_display = (
                            repr(column["type"])
                            .replace("(", "<")
                            .replace(")", ">")
                            .lower()
                        )
                    col_constraint = self._get_column_constraints(
                        column, pk_columns, unique_columns
                    )
                    if col_type.upper() in {"CHAR", "VARCHAR", "BINARY", "VARBINARY"}:
                        col_data_length = column["type"].length
                    if col_type == "NULL":
                        col_type = "VARCHAR"
                        data_type_display = "varchar"
                        logger.warning(
                            f"Unknown type {column['type']} mapped to VARCHAR: {column['name']}"
                        )
                    om_column = Column(
                        name=column["name"],
                        description=column.get("comment", None),
                        dataType=col_type,
                        dataTypeDisplay="{}({})".format(
                            col_type, 1 if col_data_length is None else col_data_length
                        )
                        if data_type_display is None
                        else f"{data_type_display}",
                        dataLength=1 if col_data_length is None else col_data_length,
                        constraint=col_constraint,
                        ordinalPosition=row_order,
                        children=children if children is not None else None,
                        arrayDataType=arr_data_type,
                    )
                except Exception as err:
                    logger.error(traceback.print_exc())
                    logger.error(f"{err} : {column}")
                    continue
                table_columns.append(om_column)
            return table_columns
        except Exception as err:
            logger.error(f"{repr(err)}: {table} {err}")
            return None

    def run_data_profiler(self, table: str, schema: str) -> TableProfile:
        """
        Run the profiler for a table in a schema.

        Prepare specific namings for different sources, e.g. bigquery
        """
        dataset_name = f"{schema}.{table}"
        self.status.scanned(f"profile of {dataset_name}")
        logger.info(f"Running Profiling for {dataset_name}. ")
        if self.config.scheme == "bigquery":
            table = dataset_name
        profile = self.data_profiler.run_profiler(
            dataset_name=dataset_name,
            profile_date=self.sql_config.data_profiler_date,
            schema=schema,
            table=table,
        )
        logger.debug(f"Finished profiling {dataset_name}")
        return profile

    def parse_raw_data_type(self, raw_data_type):
        return raw_data_type

    def _build_database_state(self, schema_fqdn: str) -> [EntityReference]:
        after = None
        tables = []
        while True:
            table_entities = self.metadata.list_entities(
                entity=Table, after=after, limit=100, params={"database": schema_fqdn}
            )
            tables.extend(table_entities.entities)
            if table_entities.after is None:
                break
            after = table_entities.after
        return tables

    def close(self):
        if self.connection is not None:
            self.connection.close()

    def get_status(self) -> SourceStatus:
        return self.status
