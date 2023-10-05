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
"""Clickhouse source module"""

import traceback
from typing import Iterable, Optional, Tuple

from clickhouse_sqlalchemy.drivers.base import ClickHouseDialect
from clickhouse_sqlalchemy.drivers.http.transport import RequestsTransport, _get_type
from clickhouse_sqlalchemy.drivers.http.utils import parse_tsv
from sqlalchemy.engine import Inspector

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.source.database.clickhouse.utils import (
    _get_column_info,
    _get_column_type,
    get_mview_names,
    get_mview_names_dialect,
    get_pk_constraint,
    get_schema_names,
    get_schema_names_reflection,
    get_table_comment,
    get_table_names,
    get_unique_constraints,
    get_view_definition,
    get_view_names,
)
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_view_definitions,
)

logger = ingestion_logger()


def execute(self, query, params=None):
    """
    Query is returning rows and these rows should be parsed or
    there is nothing to return.
    """
    req = self._send(  # pylint: disable=protected-access
        query, params=params, stream=True
    )
    lines = req.iter_lines()
    try:
        names = parse_tsv(next(lines), self.unicode_errors)
        types = parse_tsv(next(lines), self.unicode_errors)
    except StopIteration:
        # Empty result; e.g. a DDL request.
        return

    convs = [_get_type(type_) for type_ in types if type_]

    yield names
    yield types

    for line in lines:
        yield [
            (conv(x) if conv else x)
            for x, conv in zip(parse_tsv(line, self.unicode_errors), convs)
        ]


ClickHouseDialect.get_unique_constraints = get_unique_constraints
ClickHouseDialect.get_pk_constraint = get_pk_constraint
ClickHouseDialect._get_column_type = (  # pylint: disable=protected-access
    _get_column_type
)
RequestsTransport.execute = execute
ClickHouseDialect.get_view_definition = get_view_definition
ClickHouseDialect.get_view_names = get_view_names
ClickHouseDialect.get_table_comment = get_table_comment
ClickHouseDialect.get_all_view_definitions = get_all_view_definitions
ClickHouseDialect.get_all_table_comments = get_all_table_comments
ClickHouseDialect._get_column_info = (  # pylint: disable=protected-access
    _get_column_info
)
ClickHouseDialect.get_table_names = get_table_names
ClickHouseDialect.get_schema_names = get_schema_names
Inspector.get_mview_names = get_mview_names
Inspector.get_table_names = get_table_names
ClickHouseDialect.get_mview_names = get_mview_names_dialect
Inspector.get_schema_names = get_schema_names_reflection


class ClickhouseSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Clickhouse Source
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: ClickhouseConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, ClickhouseConnection):
            raise InvalidSourceException(
                f"Expected ClickhouseConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Connect to the source database to get the table
        name and type. By default, use the inspector method
        to get the names and pass the Regular type.

        This is useful for sources where we need fine-grained
        logic on how to handle table types, e.g., external, foreign,...
        """

        regular_tables = [
            TableNameAndType(name=table_name)
            for table_name in self.inspector.get_table_names(
                connection=self.connection,
                schema=schema_name,
                pushFilterDown=self.source_config.pushFilterDown,
                filter_include_table_name=self.source_config.tableFilterPattern.includes
                if self.source_config.tableFilterPattern
                and self.source_config.tableFilterPattern.includes
                else [],
                filter_exclude_table_name=self.source_config.tableFilterPattern.excludes
                if self.source_config.tableFilterPattern
                and self.source_config.tableFilterPattern.excludes
                else [],
            )
            or []
        ]
        material_tables = [
            TableNameAndType(name=table_name, type_=TableType.MaterializedView)
            for table_name in self.inspector.get_mview_names(schema_name) or []
        ]
        view_tables = [
            TableNameAndType(name=table_name, type_=TableType.View)
            for table_name in self.inspector.get_view_names(schema_name) or []
        ]

        return regular_tables + material_tables + view_tables

    def get_view_definition(
        self, table_type: str, table_name: str, schema_name: str, inspector: Inspector
    ) -> Optional[str]:
        if table_type in {TableType.View, TableType.MaterializedView}:
            definition_fn = inspector.get_view_definition
            try:
                view_definition = definition_fn(table_name, schema_name)
                view_definition = (
                    "" if view_definition is None else str(view_definition)
                )
                return view_definition

            except NotImplementedError:
                logger.warning("View definition not implemented")

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Failed to fetch view definition for {table_name}: {exc}"
                )
            return None
        return None

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema
        else:
            for schema_name in self.inspector.get_schema_names(
                pushFilterDown=self.source_config.pushFilterDown,
                filter_include_schema_name=self.source_config.schemaFilterPattern.includes
                if self.source_config.schemaFilterPattern
                and self.source_config.schemaFilterPattern.includes
                else [],
                filter_exclude_schema_name=self.source_config.schemaFilterPattern.excludes
                if self.source_config.schemaFilterPattern
                and self.source_config.schemaFilterPattern.excludes
                else [],
            ):
                yield schema_name

    def _get_filtered_schema_names(
        self, return_fqn: bool = False, add_to_status: bool = True
    ) -> Iterable[str]:
        for schema_name in self.get_raw_database_schema_names():
            schema_fqn = fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=self.context.database_service.name.__root__,
                database_name=self.context.database.name.__root__,
                schema_name=schema_name,
            )
            if not self.source_config.pushFilterDown:
                if filter_by_schema(
                    self.source_config.schemaFilterPattern,
                    schema_fqn
                    if self.source_config.useFqnForFiltering
                    else schema_name,
                ):
                    if add_to_status:
                        self.status.filter(schema_fqn, "Schema Filtered Out")
                    continue
            yield schema_fqn if return_fqn else schema_name

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.
        Fetches them up using the context information and
        the inspector set when preparing the db.
        :return: tables or views, depending on config
        """
        try:
            schema_name = self.context.database_schema.name.__root__
            if self.source_config.includeTables:
                for table_and_type in self.query_table_names_and_types(schema_name):
                    table_name = self.standardize_table_name(
                        schema_name, table_and_type.name
                    )
                    table_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.database_service.name.__root__,
                        database_name=self.context.database.name.__root__,
                        schema_name=self.context.database_schema.name.__root__,
                        table_name=table_name,
                        skip_es_search=True,
                    )
                    if not self.source_config.pushFilterDown:
                        if filter_by_table(
                            self.source_config.tableFilterPattern,
                            table_fqn
                            if self.source_config.useFqnForFiltering
                            else table_name,
                        ):
                            self.status.filter(
                                table_fqn,
                                "Table Filtered Out",
                            )
                            continue
                    yield table_name, table_and_type.type_

            if self.source_config.includeViews:
                for view_name in self.inspector.get_view_names(schema_name):
                    view_name = self.standardize_table_name(schema_name, view_name)
                    view_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.database_service.name.__root__,
                        database_name=self.context.database.name.__root__,
                        schema_name=self.context.database_schema.name.__root__,
                        table_name=view_name,
                    )

                    if filter_by_table(
                        self.source_config.tableFilterPattern,
                        view_fqn
                        if self.source_config.useFqnForFiltering
                        else view_name,
                    ):
                        self.status.filter(
                            view_fqn,
                            "Table Filtered Out",
                        )
                        continue
                    yield view_name, TableType.View
        except Exception as err:
            logger.warning(
                f"Fetching tables names failed for schema {schema_name} due to - {err}"
            )
            logger.debug(traceback.format_exc())
