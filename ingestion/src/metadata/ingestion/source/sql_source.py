#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import logging
import uuid
from abc import abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple, Type
from urllib.parse import quote_plus

from pydantic import ValidationError
from metadata.config.common import ConfigurationError
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable

from metadata.generated.schema.type.entityReference import EntityReference

from metadata.generated.schema.entity.data.database import Database

from metadata.generated.schema.entity.data.table import Table, Column, ColumnConstraint, TableType, \
    TableData, \
    TableProfile
from sqlalchemy import create_engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.sql import sqltypes as types
from sqlalchemy.inspection import inspect

from metadata.ingestion.api.common import IncludeFilterPattern, ConfigModel, Record
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.table_metadata import DatasetProfile
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
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
        logger.info('Table Scanned: {}'.format(table_name))

    def filter(
            self, table_name: str, err: str, dataset_name: str = None, col_type: str = None
    ) -> None:
        self.filtered.append(table_name)
        logger.warning("Dropped Table {} due to {}".format(table_name, err))


class SQLConnectionConfig(ConfigModel):
    username: Optional[str] = None
    password: Optional[str] = None
    host_port: str
    database: Optional[str] = None
    scheme: str
    service_name: str
    service_type: str
    query: Optional[str] = 'select * from {}.{} limit 50'
    options: dict = {}
    include_views: Optional[bool] = True
    include_tables: Optional[bool] = True
    generate_sample_data: Optional[bool] = True
    data_profiler_enabled: Optional[bool] = True
    data_profiler_offset: Optional[int] = 0
    data_profiler_limit: Optional[int] = 50000
    filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()

    @abstractmethod
    def get_connection_url(self):
        url = f"{self.scheme}://"
        if self.username is not None:
            url += f"{quote_plus(self.username)}"
            if self.password is not None:
                url += f":{quote_plus(self.password)}"
            url += "@"
        url += f"{self.host_port}"
        if self.database:
            url += f"/{self.database}"
        logger.info(url)
        return url

    def get_service_type(self) -> DatabaseServiceType:
        return DatabaseServiceType[self.service_type]

    def get_service_name(self) -> str:
        return self.service_name


_column_type_mapping: Dict[Type[types.TypeEngine], str] = {
    types.Integer: "INT",
    types.Numeric: "INT",
    types.Boolean: "BOOLEAN",
    types.Enum: "ENUM",
    types._Binary: "BYTES",
    types.LargeBinary: "BYTES",
    types.PickleType: "BYTES",
    types.ARRAY: "ARRAY",
    types.VARCHAR: "VARCHAR",
    types.String: "STRING",
    types.Date: "DATE",
    types.DATE: "DATE",
    types.Time: "TIME",
    types.DateTime: "DATETIME",
    types.DATETIME: "DATETIME",
    types.TIMESTAMP: "TIMESTAMP",
    types.NullType: "NULL",
    types.JSON: "JSON"
}

_known_unknown_column_types: Set[Type[types.TypeEngine]] = {
    types.Interval,
    types.CLOB,
}


def register_custom_type(
        tp: Type[types.TypeEngine], output: str = None
) -> None:
    if output:
        _column_type_mapping[tp] = output
    else:
        _known_unknown_column_types.add(tp)


def get_column_type(status: SQLSourceStatus, dataset_name: str, column_type: Any) -> str:
    type_class: Optional[str] = None
    for sql_type in _column_type_mapping.keys():
        if isinstance(column_type, sql_type):
            type_class = _column_type_mapping[sql_type]
            break
    if type_class is None:
        for sql_type in _known_unknown_column_types:
            if isinstance(column_type, sql_type):
                type_class = "NULL"
                break

    if type_class is None:
        status.warning(
            dataset_name, f"unable to map type {column_type!r} to metadata schema"
        )
        type_class = "NULL"

    return type_class


def _get_table_description(schema: str, table: str, inspector: Inspector) -> str:
    description = None
    try:
        table_info: dict = inspector.get_table_comment(table, schema)
    except Exception as err:
        logger.error(f"Table Description Error : {err}")
    else:
        description = table_info["text"]
    return description


class SQLSource(Source):
    def __init__(
            self, config: SQLConnectionConfig, metadata_config: MetadataServerConfig,
            ctx: WorkflowContext
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.service = get_database_service_or_create(config, metadata_config)
        self.status = SQLSourceStatus()
        self.sql_config = self.config
        self.connection_string = self.sql_config.get_connection_url()
        self.engine = create_engine(self.connection_string, **self.sql_config.options)
        self.connection = self.engine.connect()
        self.data_profiler = None

    def _instantiate_profiler(self):
        try:
            if self.config.data_profiler_enabled:
                if self.data_profiler is None:
                    from metadata.profiler.dataprofiler import DataProfiler
                    self.data_profiler = DataProfiler(status=self.status,
                                                    connection_str=self.connection_string)
                return True
            return False
        except Exception:
            raise ConfigurationError(
                "DataProfiler configuration is enabled. Please make sure you ran "
                "pip install 'openmetadata[data-profiler]'"
            )

    def prepare(self):
        pass

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        pass

    def standardize_schema_table_names(
            self, schema: str, table: str
    ) -> Tuple[str, str]:
        return schema, table

    def fetch_sample_data(self, schema: str, table: str):
        try:
            query = self.config.query.format(schema, table)
            logger.info(query)
            results = self.connection.execute(query)
            cols = list(results.keys())
            rows = []
            for r in results:
                row = list(r)
                rows.append(row)
            return TableData(columns=cols, rows=rows)
        except Exception as err:
            logger.error("Failed to generate sample data for {} - {}".format(table, err))

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        inspector = inspect(self.engine)
        for schema in inspector.get_schema_names():
            if not self.sql_config.filter_pattern.included(schema):
                self.status.filter(schema, "Schema pattern not allowed")
                continue
            logger.debug("total tables {}".format(inspector.get_table_names(schema)))
            if self.config.include_tables:
                yield from self.fetch_tables(inspector, schema)
            if self.config.include_views:
                yield from self.fetch_views(inspector, schema)

    def fetch_tables(
            self,
            inspector: Inspector,
            schema: str
    ) -> Iterable[OMetaDatabaseAndTable]:
        for table_name in inspector.get_table_names(schema):
            try:
                schema, table_name = self.standardize_schema_table_names(schema, table_name)
                if not self.sql_config.filter_pattern.included(table_name):
                    self.status.filter(
                        '{}.{}'.format(self.config.get_service_name(), table_name),
                        "Table pattern not allowed"
                    )
                    continue
                self.status.scanned('{}.{}'.format(self.config.get_service_name(), table_name))

                description = _get_table_description(schema, table_name, inspector)

                table_columns = self._get_columns(schema, table_name, inspector)
                table_entity = Table(
                    id=uuid.uuid4(),
                    name=table_name,
                    tableType='Regular',
                    description=description if description is not None else ' ',
                    columns=table_columns
                )
                if self.sql_config.generate_sample_data:
                    table_data = self.fetch_sample_data(schema, table_name)
                    table_entity.sampleData = table_data

                if self._instantiate_profiler():
                    profile = self.run_data_profiler(table_name, schema)
                    table_entity.tableProfile = profile

                table_and_db = OMetaDatabaseAndTable(
                    table=table_entity, database=self._get_database(schema)
                )
                yield table_and_db
            except ValidationError as err:
                logger.error(err)
                self.status.failures.append('{}.{}'.format(self.config.service_name, table_name))
                continue

    def fetch_views(
            self,
            inspector: Inspector,
            schema: str
    ) -> Iterable[OMetaDatabaseAndTable]:
        for view_name in inspector.get_view_names(schema):
            try:
                if self.config.scheme == "bigquery":
                    schema, view_name = self.standardize_schema_table_names(schema, view_name)
                if not self.sql_config.filter_pattern.included(view_name):
                    self.status.filter(
                        '{}.{}'.format(self.config.get_service_name(), view_name),
                        "View pattern not allowed"
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
                    view_definition = "" if view_definition is None else str(view_definition)
                except NotImplementedError:
                    view_definition = ""

                description = _get_table_description(schema, view_name, inspector)
                table_columns = self._get_columns(schema, view_name, inspector)
                table = Table(
                    id=uuid.uuid4(),
                    name=view_name,
                    tableType='View',
                    description=description if description is not None else ' ',
                    columns=table_columns,
                    viewDefinition=view_definition
                )
                if self.sql_config.generate_sample_data:
                    table_data = self.fetch_sample_data(schema, view_name)
                    table.sampleData = table_data

                table_and_db = OMetaDatabaseAndTable(
                    table=table, database=self._get_database(schema)
                )
                yield table_and_db
            except ValidationError as err:
                logger.error(err)
                self.status.failures.append('{}.{}'.format(self.config.service_name, view_name))
                continue

    def _get_database(self, schema: str) -> Database:
        return Database(
            name=schema,
            service=EntityReference(id=self.service.id, type=self.config.service_type)
        )

    def _get_columns(self, schema: str, table: str, inspector: Inspector) -> List[Column]:
        pk_constraints = inspector.get_pk_constraint(table, schema)
        pk_columns = pk_constraints['column_constraints'] if len(
            pk_constraints
        ) > 0 and "column_constraints" in pk_constraints.keys() else {}
        unique_constraints = []
        try:
            unique_constraints = inspector.get_unique_constraints(table, schema)
        except NotImplementedError:
            pass
        unique_columns = []
        for constraint in unique_constraints:
            if 'column_names' in constraint.keys():
                unique_columns = constraint['column_names']
        dataset_name = f"{schema}.{table}"
        columns = inspector.get_columns(table, schema)
        table_columns = []
        row_order = 1
        for column in columns:
            col_type = None
            try:
                col_type = get_column_type(self.status, dataset_name, column['type'])
            except Exception as err:
                logger.error(err)
            col_constraint = None
            if column['nullable']:
                col_constraint = ColumnConstraint.NULL
            elif not column['nullable']:
                col_constraint = ColumnConstraint.NOT_NULL

            if column['name'] in pk_columns:
                col_constraint = ColumnConstraint.PRIMARY_KEY
            elif column['name'] in unique_columns:
                col_constraint = ColumnConstraint.UNIQUE
            table_columns.append(
                Column(
                    name=column['name'],
                    description=column.get("comment", None),
                    columnDataType=col_type,
                    columnConstraint=col_constraint,
                    ordinalPosition=row_order
                )
            )
            row_order = row_order + 1

        return table_columns

    def run_data_profiler(
            self,
            table: str,
            schema: str
    ) -> TableProfile:
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
            schema=schema,
            table=table,
            limit=self.sql_config.data_profiler_limit,
            offset=self.sql_config.data_profiler_offset,
            project_id=self.config.project_id if self.config.scheme == "bigquery" else None
        )
        logger.debug(f"Finished profiling {dataset_name}")
        return profile

    def close(self):
        if self.connection is not None:
            self.connection.close()

    def get_status(self) -> SourceStatus:
        return self.status
