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

import logging
import re
from collections import defaultdict
from typing import Optional

import sqlalchemy as sa
from packaging.version import Version

from metadata.ingestion.source.sql_source_common import SQLConnectionConfig

sa_version = Version(sa.__version__)

from sqlalchemy import inspect
from sqlalchemy.engine import reflection
from sqlalchemy.types import CHAR, VARCHAR, NullType
from sqlalchemy_redshift.dialect import RedshiftDialectMixin, RelationKey

from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLSource
from metadata.utils.sql_queries import (
    REDSHIFT_GET_ALL_RELATION_INFO,
    REDSHIFT_GET_SCHEMA_COLUMN_INFO,
)

logger = logging.getLogger(__name__)


@reflection.cache
def get_table_names(self, connection, schema=None, **kw):
    return self._get_table_or_view_names(["r", "e"], connection, schema, **kw)


@reflection.cache
def get_view_names(self, connection, schema=None, **kw):
    return self._get_table_or_view_names(["v"], connection, schema, **kw)


@reflection.cache
def _get_table_or_view_names(self, relkinds, connection, schema=None, **kw):
    default_schema = inspect(connection).default_schema_name
    if not schema:
        schema = default_schema
    info_cache = kw.get("info_cache")
    all_relations = self._get_all_relation_info(connection, info_cache=info_cache)
    relation_names = []
    for key, relation in all_relations.items():
        if key.schema == schema and relation.relkind in relkinds:
            relation_names.append(key.name)
    return relation_names


def _get_column_info(self, *args, **kwargs):
    kw = kwargs.copy()
    encode = kw.pop("encode", None)
    if sa_version >= Version("1.3.16"):
        kw["generated"] = ""
    if sa_version < Version("1.4.0") and "identity" in kw:
        del kw["identity"]
    elif sa_version >= Version("1.4.0") and "identity" not in kw:
        kw["identity"] = None
    column_info = super(RedshiftDialectMixin, self)._get_column_info(*args, **kw)
    column_info["raw_data_type"] = kw["format_type"]

    if isinstance(column_info["type"], VARCHAR):
        if column_info["type"].length is None:
            column_info["type"] = NullType()
    if re.match("char", column_info["raw_data_type"]):
        column_info["type"] = CHAR

    if "info" not in column_info:
        column_info["info"] = {}
    if encode and encode != "none":
        column_info["info"]["encode"] = encode
    return column_info


@reflection.cache
def _get_all_relation_info(self, connection, **kw):
    result = connection.execute(REDSHIFT_GET_ALL_RELATION_INFO)
    relations = {}
    for rel in result:
        key = RelationKey(rel.relname, rel.schema, connection)
        relations[key] = rel

    result = connection.execute(
        """
            SELECT
                schemaname as "schema",
                tablename as "relname",
                'e' as relkind
            FROM svv_external_tables;
            """
    )
    for rel in result:
        key = RelationKey(rel.relname, rel.schema, connection)
        relations[key] = rel
    return relations


@reflection.cache
def _get_schema_column_info(self, connection, schema=None, **kw):
    schema_clause = "AND schema = '{schema}'".format(schema=schema) if schema else ""
    all_columns = defaultdict(list)
    with connection.connect() as cc:
        result = cc.execute(
            REDSHIFT_GET_SCHEMA_COLUMN_INFO.format(schema_clause=schema_clause)
        )
        for col in result:
            key = RelationKey(col.table_name, col.schema, connection)
            all_columns[key].append(col)
    return dict(all_columns)


RedshiftDialectMixin._get_table_or_view_names = _get_table_or_view_names
RedshiftDialectMixin.get_view_names = get_view_names
RedshiftDialectMixin.get_table_names = get_table_names
RedshiftDialectMixin._get_column_info = _get_column_info
RedshiftDialectMixin._get_all_relation_info = _get_all_relation_info
RedshiftDialectMixin._get_schema_column_info = _get_schema_column_info


class RedshiftConfig(SQLConnectionConfig):
    scheme = "redshift+psycopg2"
    where_clause: Optional[str] = None
    duration: int = 1
    service_type = "Redshift"

    def get_identifier(self, schema: str, table: str) -> str:
        regular = f"{schema}.{table}"
        if self.database:
            return f"{self.database}.{regular}"
        return regular

    def get_connection_url(self):
        return super().get_connection_url()


class RedshiftSource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = RedshiftConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def get_status(self) -> SourceStatus:
        return self.status
