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
import enum

from clickhouse_sqlalchemy.drivers.base import ClickHouseDialect, ischema_names
from clickhouse_sqlalchemy.drivers.http.transport import RequestsTransport, _get_type
from clickhouse_sqlalchemy.drivers.http.utils import parse_tsv
from sqlalchemy import types as sqltypes
from sqlalchemy.engine import reflection
from sqlalchemy.sql.sqltypes import String
from sqlalchemy.util import warn

from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_TABLE_COMMENTS,
    CLICKHOUSE_VIEW_DEFINITIONS,
)
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_view_definitions,
    get_table_comment_wrapper,
    get_view_definition_wrapper,
)

logger = ingestion_logger()


class AggregateFunction(String):

    __visit_name__ = "AggregateFunction"


@reflection.cache
def _get_column_type(
    self, name, spec
):  # pylint: disable=protected-access,too-many-branches,too-many-return-statements
    ischema_names.update({"AggregateFunction": AggregateFunction})
    ClickHouseDialect.ischema_names = ischema_names
    if spec.startswith("Array"):
        inner = spec[6:-1]
        coltype = self.ischema_names["_array"]
        return coltype(self._get_column_type(name, inner))

    if spec.startswith("FixedString"):
        return self.ischema_names["FixedString"]

    if spec.startswith("Nullable"):
        inner = spec[9:-1]
        coltype = self.ischema_names["_nullable"]
        return self._get_column_type(name, inner)

    if spec.startswith("LowCardinality"):
        inner = spec[15:-1]
        coltype = self.ischema_names["_lowcardinality"]
        return coltype(self._get_column_type(name, inner))

    if spec.startswith("Tuple"):
        inner = spec[6:-1]
        coltype = self.ischema_names["_tuple"]
        inner_types = [self._get_column_type(name, t.strip()) for t in inner.split(",")]
        return coltype(*inner_types)

    if spec.startswith("Map"):
        inner = spec[4:-1]
        coltype = self.ischema_names["_map"]
        inner_types = [self._get_column_type(name, t.strip()) for t in inner.split(",")]
        return coltype(*inner_types)

    if spec.startswith("Enum"):
        pos = spec.find("(")
        coltype = self.ischema_names[spec[:pos]]

        options = {}
        if pos >= 0:
            options = self._parse_options(spec[pos + 1 : spec.rfind(")")])
        if not options:
            return sqltypes.NullType

        type_enum = enum.Enum(f"{name}_enum", options)
        return lambda: coltype(type_enum)

    if spec.startswith("DateTime64"):
        return self.ischema_names["DateTime64"]

    if spec.startswith("DateTime"):
        return self.ischema_names["DateTime"]

    if spec.startswith("IP"):
        return self.ischema_names["String"]

    if spec.lower().startswith("decimal"):
        coltype = self.ischema_names["Decimal"]
        return coltype(*self._parse_decimal_params(spec))

    if spec.lower().startswith("aggregatefunction"):
        return self.ischema_names["AggregateFunction"]
    try:
        return self.ischema_names[spec]
    except KeyError:
        warn(f"Did not recognize type '{spec}' of column '{name}'")
        return sqltypes.NullType


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


@reflection.cache
def get_unique_constraints(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    return []


@reflection.cache
def get_pk_constraint(
    self, bind, table_name, schema=None, **kw  # pylint: disable=unused-argument
):
    return {"constrained_columns": [], "name": "undefined"}


@reflection.cache
def get_view_definition(
    self, connection, table_name, schema=None, **kw  # pylint: disable=unused-argument
):
    return get_view_definition_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=CLICKHOUSE_VIEW_DEFINITIONS,
    )


@reflection.cache
def get_table_comment(
    self, connection, table_name, schema=None, **kw  # pylint: disable=unused-argument
):
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=CLICKHOUSE_TABLE_COMMENTS,
    )


ClickHouseDialect.get_unique_constraints = get_unique_constraints
ClickHouseDialect.get_pk_constraint = get_pk_constraint
ClickHouseDialect._get_column_type = (  # pylint: disable=protected-access
    _get_column_type
)
RequestsTransport.execute = execute
ClickHouseDialect.get_view_definition = get_view_definition
ClickHouseDialect.get_table_comment = get_table_comment
ClickHouseDialect.get_all_view_definitions = get_all_view_definitions
ClickHouseDialect.get_all_table_comments = get_all_table_comments


class ClickhouseSource(CommonDbSourceService):
    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: ClickhouseConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, ClickhouseConnection):
            raise InvalidSourceException(
                f"Expected ClickhouseConnection, but got {connection}"
            )
        return cls(config, metadata_config)
