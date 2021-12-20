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
import re
import traceback
import uuid
from abc import abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple, Type
from urllib.parse import quote_plus

from pydantic import SecretStr
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
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import (
    ConfigModel,
    IncludeFilterPattern,
    WorkflowContext,
)
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.utils.column_helpers import check_column_complex_type, get_column_type
from metadata.utils.helpers import get_database_service_or_create

logger: logging.Logger = logging.getLogger(__name__)


@dataclass
class SQLSourceStatus(SourceStatus):
    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    filtered: List[str] = field(default_factory=list)

    def scanned(self, table_name: str) -> None:
        self.success.append(table_name)
        logger.info("Table Scanned: {}".format(table_name))

    def filter(
        self, table_name: str, err: str, dataset_name: str = None, col_type: str = None
    ) -> None:
        self.filtered.append(table_name)
        logger.warning("Dropped Table {} due to {}".format(table_name, err))


def build_sql_source_connection_url(
    host_port: str,
    scheme: str,
    username: Optional[str] = None,
    password: Optional[SecretStr] = None,
    database: Optional[str] = None,
    options: dict = {},
) -> str:

    url = f"{scheme}://"
    if username is not None:
        url += f"{username}"
        if password is not None:
            url += f":{quote_plus(password.get_secret_value())}"
        url += "@"
    url += f"{host_port}"
    if database:
        url += f"/{database}"

    if options is not None:
        if database is None:
            url += "/"
        params = "&".join(
            f"{key}={quote_plus(value)}" for (key, value) in options.items() if value
        )
        url = f"{url}?{params}"
    return url


class SQLConnectionConfig(ConfigModel):
    username: Optional[str] = None
    password: Optional[SecretStr] = None
    host_port: str
    database: Optional[str] = None
    scheme: str
    service_name: str
    service_type: str
    query: Optional[str] = "select * from {}.{} limit 50"
    options: dict = {}
    connect_args: dict = {}
    include_views: Optional[bool] = True
    include_tables: Optional[bool] = True
    generate_sample_data: Optional[bool] = True
    data_profiler_enabled: Optional[bool] = False
    data_profiler_date: Optional[str] = datetime.now().strftime("%Y-%m-%d")
    data_profiler_offset: Optional[int] = 0
    data_profiler_limit: Optional[int] = 50000
    table_filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    schema_filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    dbt_manifest_file: Optional[str] = None
    dbt_catalog_file: Optional[str] = None

    @abstractmethod
    def get_connection_url(self):
        return build_sql_source_connection_url(
            host_port=self.host_port,
            scheme=self.scheme,
            username=self.username,
            password=self.password,
            database=self.database,
            options=self.options,
        )

    def get_service_type(self) -> DatabaseServiceType:
        return DatabaseServiceType[self.service_type]

    def get_service_name(self) -> str:
        return self.service_name


def _get_table_description(schema: str, table: str, inspector: Inspector) -> str:
    description = None
    try:
        table_info: dict = inspector.get_table_comment(table, schema)
    except Exception as err:
        logger.error(f"Table Description Error : {err}")
    else:
        description = table_info["text"]
    return description


class SQLSource(Source[OMetaDatabaseAndTable]):
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
        if self.config.dbt_catalog_file is not None:
            self.dbt_catalog = json.load(open(self.config.dbt_catalog_file, "r"))
        if self.config.dbt_manifest_file is not None:
            self.dbt_manifest = json.load(open(self.config.dbt_manifest_file, "r"))

    def _instantiate_profiler(self):
        try:
            if self.config.data_profiler_enabled:
                if self.data_profiler is None:
                    from metadata.profiler.dataprofiler import DataProfiler

                    self.data_profiler = DataProfiler(
                        status=self.status, connection_str=self.connection_string
                    )
                return True
            return False
        except Exception:
            logger.error(
                "DataProfiler configuration is enabled. Please make sure you ran "
                "pip install 'openmetadata-ingestion[data-profiler]'"
            )

    def prepare(self):
        self._parse_data_model()

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        pass

    def type_of_column_name(self, sa_type, table_name: str, column_name: str):
        return sa_type

    def standardize_schema_table_names(
        self, schema: str, table: str
    ) -> Tuple[str, str]:
        return schema, table

    def fetch_sample_data(self, schema: str, table: str):
        try:
            query = self.config.query.format(schema, table)
            logger.info(query)
            results = self.connection.execute(query)
            cols = []
            for col in results.keys():
                cols.append(col.replace(".", "_DOT_"))
            rows = []
            for r in results:
                row = list(r)
                rows.append(row)
            return TableData(columns=cols, rows=rows)
        except Exception as err:
            logger.error(
                "Failed to generate sample data for {} - {}".format(table, err)
            )

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        inspector = inspect(self.engine)
        for schema in inspector.get_schema_names():
            if not self.sql_config.schema_filter_pattern.included(schema):
                self.status.filter(schema, "Schema pattern not allowed")
                continue
            logger.debug("total tables {}".format(inspector.get_table_names(schema)))
            if self.config.include_tables:
                yield from self.fetch_tables(inspector, schema)
            if self.config.include_views:
                yield from self.fetch_views(inspector, schema)

    def fetch_tables(
        self, inspector: Inspector, schema: str
    ) -> Iterable[OMetaDatabaseAndTable]:
        for table_name in inspector.get_table_names(schema):
            try:
                schema, table_name = self.standardize_schema_table_names(
                    schema, table_name
                )
                if not self.sql_config.table_filter_pattern.included(table_name):
                    self.status.filter(
                        "{}.{}".format(self.config.get_service_name(), table_name),
                        "Table pattern not allowed",
                    )
                    continue
                self.status.scanned(
                    "{}.{}".format(self.config.get_service_name(), table_name)
                )

                description = _get_table_description(schema, table_name, inspector)
                fqn = f"{self.config.service_name}.{self.config.database}.{schema}.{table_name}"
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
                except Exception as err:
                    logger.error(repr(err))
                    logger.error(err)
                    pass

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
            except Exception as err:
                logger.error(err)
                self.status.warnings.append(
                    "{}.{}".format(self.config.service_name, table_name)
                )
                continue

    def fetch_views(
        self, inspector: Inspector, schema: str
    ) -> Iterable[OMetaDatabaseAndTable]:
        for view_name in inspector.get_view_names(schema):
            try:
                if self.config.scheme == "bigquery":
                    schema, view_name = self.standardize_schema_table_names(
                        schema, view_name
                    )
                if not self.sql_config.table_filter_pattern.included(view_name):
                    self.status.filter(
                        "{}.{}".format(self.config.get_service_name(), view_name),
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

                description = _get_table_description(schema, view_name, inspector)
                table_columns = self._get_columns(schema, view_name, inspector)
                view_name = view_name.replace(".", "_DOT_")
                fqn = f"{self.config.service_name}.{self.config.database}.{schema}.{view_name}"
                table = Table(
                    id=uuid.uuid4(),
                    name=view_name,
                    tableType="View",
                    description=description if description is not None else " ",
                    fullyQualifiedName=fqn,
                    columns=table_columns,
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
            except Exception as err:
                logger.error(err)
                self.status.warnings.append(
                    "{}.{}".format(self.config.service_name, view_name)
                )
                continue

    def _parse_data_model(self):

        if self.config.dbt_manifest_file and self.config.dbt_catalog_file:
            logger.info("Parsing Data Models")
            manifest_nodes = self.dbt_manifest["nodes"]
            manifest_sources = self.dbt_manifest["sources"]
            manifest_entities = {**manifest_nodes, **manifest_sources}
            catalog_nodes = self.dbt_catalog["nodes"]
            catalog_sources = self.dbt_catalog["sources"]
            catalog_entities = {**catalog_nodes, **catalog_sources}

            for key, mnode in manifest_entities.items():
                name = mnode["alias"] if "alias" in mnode.keys() else mnode["name"]
                cnode = catalog_entities.get(key)
                if cnode is not None:
                    columns = self._parse_data_model_columns(name, mnode, cnode)
                else:
                    columns = []
                if mnode["resource_type"] == "test":
                    continue
                upstream_nodes = self._parse_data_model_upstream(mnode)
                model_name = (
                    mnode["alias"] if "alias" in mnode.keys() else mnode["name"]
                )
                model_name = model_name.replace(".", "_DOT_")
                description = mnode.get("description", "")
                schema = mnode["schema"]
                path = f"{mnode['root_path']}/{mnode['original_file_path']}"
                raw_sql = mnode.get("raw_sql", "")
                model = DataModel(
                    modelType=ModelType.DBT,
                    description=description,
                    path=path,
                    rawSql=raw_sql,
                    sql=mnode.get("compiled_sql", raw_sql),
                    columns=columns,
                    upstream=upstream_nodes,
                )
                model_fqdn = f"{schema}.{model_name}"
                self.data_models[model_fqdn] = model

    def _parse_data_model_upstream(self, mnode):
        upstream_nodes = []
        if "depends_on" in mnode and "nodes" in mnode["depends_on"]:
            for node in mnode["depends_on"]["nodes"]:
                try:
                    node_type, database, table = node.split(".", 2)
                    table = table.replace(".", "_DOT_")
                    table_fqn = f"{self.config.service_name}.{database}.{table}"
                    upstream_nodes.append(table_fqn)
                except Exception as e:
                    logger.error(f"Failed to parse the node {node} to capture lineage")
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
            except Exception as e:
                logger.error(f"Failed to parse column type due to {e}")

        return columns

    def _get_database(self, schema: str) -> Database:
        return Database(
            name=schema,
            service=EntityReference(id=self.service.id, type=self.config.service_type),
        )

    def parse_raw_data_type(self, raw_data_type):
        return raw_data_type

    def _get_columns(
        self, schema: str, table: str, inspector: Inspector
    ) -> List[Column]:
        pk_constraints = inspector.get_pk_constraint(table, schema)
        pk_columns = (
            pk_constraints["column_constraints"]
            if len(pk_constraints) > 0 and "column_constraints" in pk_constraints.keys()
            else {}
        )
        unique_constraints = []
        try:
            unique_constraints = inspector.get_unique_constraints(table, schema)
        except NotImplementedError:
            pass
        unique_columns = []
        for constraint in unique_constraints:
            if "column_names" in constraint.keys():
                unique_columns = constraint["column_names"]
        dataset_name = f"{schema}.{table}"
        columns = inspector.get_columns(table, schema)
        table_columns = []
        row_order = 1
        try:
            for column in columns:
                if "." in column["name"]:
                    logger.info(f"Found '.' in {column['name']}")
                    column["name"] = column["name"].replace(".", "_DOT_")
                children = None
                data_type_display = None
                col_data_length = None
                arr_data_type = None
                if "raw_data_type" in column and column["raw_data_type"] is not None:
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
                    if col_type == "ARRAY":
                        if re.match(r"(?:\w*)(?:\()(\w*)(?:.*)", str(column["type"])):
                            arr_data_type = re.match(
                                r"(?:\w*)(?:[(]*)(\w*)(?:.*)", str(column["type"])
                            ).groups()
                            data_type_display = column["type"]
                col_constraint = None
                if column["nullable"]:
                    col_constraint = Constraint.NULL
                elif not column["nullable"]:
                    col_constraint = Constraint.NOT_NULL
                if column["name"] in pk_columns:
                    col_constraint = Constraint.PRIMARY_KEY
                elif column["name"] in unique_columns:
                    col_constraint = Constraint.UNIQUE
                if col_type.upper() in ["CHAR", "VARCHAR", "BINARY", "VARBINARY"]:
                    col_data_length = column["type"].length
                if col_data_length is None:
                    col_data_length = 1
                try:
                    if col_type == "NULL":
                        col_type = self.type_of_column_name(
                            col_type,
                            column_name=column["name"],
                            table_name=dataset_name,
                        )
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
                        dataTypeDisplay="{}({})".format(col_type, col_data_length)
                        if data_type_display is None
                        else f"{data_type_display}",
                        dataLength=col_data_length,
                        constraint=col_constraint,
                        ordinalPosition=row_order,
                        children=children if children is not None else None,
                        arrayDataType=arr_data_type,
                    )
                except Exception as err:
                    logger.error(traceback.format_exc())
                    logger.error(traceback.print_exc())
                    logger.error(f"{err} : {column}")
                    continue
                table_columns.append(om_column)
                row_order = row_order + 1
            return table_columns
        except Exception as err:
            logger.error("{}: {} {}".format(repr(err), table, err))

    def run_data_profiler(self, table: str, schema: str) -> TableProfile:
        dataset_name = f"{schema}.{table}"
        self.status.scanned(f"profile of {dataset_name}")
        logger.info(
            f"Running Profiling for {dataset_name}. "
            f"If you haven't configured offset and limit this process can take longer"
        )
        if self.config.scheme == "bigquery":
            table = dataset_name
        profile = self.data_profiler.run_profiler(
            dataset_name=dataset_name,
            profile_date=self.sql_config.data_profiler_date,
            schema=schema,
            table=table,
            limit=self.sql_config.data_profiler_limit,
            offset=self.sql_config.data_profiler_offset,
            project_id=self.config.project_id
            if self.config.scheme == "bigquery"
            else None,
        )
        logger.debug(f"Finished profiling {dataset_name}")
        return profile

    def close(self):
        if self.connection is not None:
            self.connection.close()

    def get_status(self) -> SourceStatus:
        return self.status
