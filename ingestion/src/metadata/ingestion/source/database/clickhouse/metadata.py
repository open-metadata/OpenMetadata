#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Clickhouse source module"""

from typing import Iterable, Optional

from clickhouse_sqlalchemy.drivers.base import ClickHouseDialect
from clickhouse_sqlalchemy.drivers.http.transport import RequestsTransport, _get_type
from clickhouse_sqlalchemy.drivers.http.utils import parse_tsv
from sqlalchemy.engine import Inspector

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.clickhouse.utils import (
    _get_column_info,
    _get_column_type,
    get_mview_names,
    get_mview_names_dialect,
    get_pk_constraint,
    get_table_comment,
    get_unique_constraints,
    get_view_definition,
    get_view_names,
)
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_table_ddls,
    get_all_view_definitions,
    get_table_ddl,
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
Inspector.get_mview_names = get_mview_names
ClickHouseDialect.get_mview_names = get_mview_names_dialect
Inspector.get_all_table_ddls = get_all_table_ddls
Inspector.get_table_ddl = get_table_ddl


class ClickhouseSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Clickhouse Source
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: ClickhouseConnection = config.serviceConnection.root.config
        if not isinstance(connection, ClickhouseConnection):
            raise InvalidSourceException(
                f"Expected ClickhouseConnection, but got {connection}"
            )
        return cls(config, metadata)

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
            for table_name in self.inspector.get_table_names(schema_name) or []
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
