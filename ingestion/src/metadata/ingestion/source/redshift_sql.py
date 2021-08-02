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

# This import verifies that the dependencies are available.
import logging
import uuid
from abc import ABC

import pymysql  # noqa: F401
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest

from metadata.generated.schema.entity.services.databaseService import DatabaseServiceEntity
from pydantic import ValidationError

from metadata.generated.schema.entity.data.table import Column, TableEntity
from metadata.generated.schema.entity.data.database import DatabaseEntity
from metadata.generated.schema.type.common import EntityReference
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.source.sql_source_common import BasicSQLQueryConfig, SQLAlchemyHelper, SQLSourceStatus
from metadata.ingestion.api.source import Source, SourceStatus
from itertools import groupby
from typing import Iterator, Union, Dict, Any, Iterable, Optional
from collections import namedtuple

from metadata.utils.helpers import get_service_or_create

TableKey = namedtuple('TableKey', ['schema', 'table_name'])


class RedshiftConfig(BasicSQLQueryConfig):
    scheme = "redshift"
    where_clause: str = None
    cluster_source: str = "CURRENT_DATABASE()"
    api_endpoint: str = None
    service_type: str = "REDSHIFT"
    service_name: str = "aws_redshift"


def get_table_key(row: Dict[str, Any]) -> Union[TableKey, None]:
    """
    Table key consists of schema and table name
    :param row:
    :return:
    """
    if row:
        return TableKey(schema=row['schema'], table_name=row['name'])

    return None


logger = logging.getLogger(__name__)


class RedshiftSQLSource(Source):
    # SELECT statement from mysql information_schema to extract table and column metadata
    SQL_STATEMENT = """
       SELECT
            *
        FROM (
            SELECT
              {cluster_source} as cluster,
              c.table_schema as schema,
              c.table_name as name,
              pgtd.description as description,
              c.column_name as col_name,
              c.data_type as col_type,
              pgcd.description as col_description,
              ordinal_position as col_sort_order
            FROM INFORMATION_SCHEMA.COLUMNS c
            INNER JOIN
              pg_catalog.pg_statio_all_tables as st on c.table_schema=st.schemaname and c.table_name=st.relname
            LEFT JOIN
              pg_catalog.pg_description pgcd on pgcd.objoid=st.relid and pgcd.objsubid=c.ordinal_position
            LEFT JOIN
              pg_catalog.pg_description pgtd on pgtd.objoid=st.relid and pgtd.objsubid=0

            UNION

            SELECT
              {cluster_source} as cluster,
              view_schema as schema,
              view_name as name,
              NULL as description,
              column_name as col_name,
              data_type as col_type,
              NULL as col_description,
              ordinal_position as col_sort_order
            FROM
                PG_GET_LATE_BINDING_VIEW_COLS()
                    COLS(view_schema NAME, view_name NAME, column_name NAME, data_type VARCHAR, ordinal_position INT)
        )

        {where_clause_suffix}
        ORDER by cluster, schema, name, col_sort_order ;
        """

    # CONFIG KEYS
    WHERE_CLAUSE_SUFFIX_KEY = 'where_clause'
    CLUSTER_SOURCE = 'cluster_source'
    CLUSTER_KEY = 'cluster_key'
    USE_CATALOG_AS_CLUSTER_NAME = 'use_catalog_as_cluster_name'
    DATABASE_KEY = 'database_key'
    SERVICE_TYPE = 'REDSHIFT'
    DEFAULT_CLUSTER_SOURCE = 'CURRENT_DATABASE()'

    def __init__(self, config, metadata_config, ctx):
        super().__init__(ctx)
        self.sql_stmt = RedshiftSQLSource.SQL_STATEMENT.format(
            where_clause_suffix=config.where_clause,
            cluster_source=config.cluster_source,
            database=config.database
        )
        self.alchemy_helper = SQLAlchemyHelper(config, metadata_config, ctx, "Redshift", self.sql_stmt)
        self.config = config
        self.metadata_config = metadata_config
        self._extract_iter: Union[None, Iterator] = None
        self._database = 'redshift'
        self.report = SQLSourceStatus()
        self.service = get_service_or_create(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = RedshiftConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def _get_raw_extract_iter(self) -> Iterable[Dict[str, Any]]:
        """
        Provides iterator of result row from SQLAlchemy helper
        :return:
        """
        rows = self.alchemy_helper.execute_query()
        for row in rows:
            yield row

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        """
                Using itertools.groupby and raw level iterator, it groups to table and yields TableMetadata
                :return:
                """
        for key, group in groupby(self._get_raw_extract_iter(), get_table_key):
            try:
                columns = []
                for row in group:
                    last_row = row
                    col_type = ''
                    if row['col_type'].upper() == 'CHARACTER VARYING':
                        col_type = 'VARCHAR'
                    elif row['col_type'].upper() == 'CHARACTER':
                        col_type = 'CHAR'
                    elif row['col_type'].upper() == 'INTEGER':
                        col_type = 'INT'
                    elif row['col_type'].upper() == 'TIMESTAMP WITHOUT TIME ZONE':
                        col_type = 'TIMESTAMP'
                    elif row['col_type'].upper() == 'DOUBLE PRECISION':
                        col_type = 'DOUBLE'
                    elif row['col_type'].upper() == 'OID':
                        col_type = 'NUMBER'
                    elif row['col_type'].upper() == 'NAME':
                        col_type = 'CHAR'
                    else:
                        col_type = row['col_type'].upper()
                    columns.append(Column(name=row['col_name'], description=row['col_description'],
                                          columnDataType=col_type,
                                          ordinalPosition=int(row['col_sort_order'])))
                db = DatabaseEntity(id=uuid.uuid4(),
                                    name=last_row['schema'],
                                    description=last_row['description'] if last_row['description'] is not None else ' ',
                                    service=EntityReference(id=self.service.id, type=self.config.service_type))
                table = TableEntity(name=last_row['name'],
                                    columns=columns)
                table_and_db = OMetaDatabaseAndTable(table=table, database=db)
                self.report.report_table_scanned(table.name)
                self.report.records_produced(table.name)
                yield table_and_db
            except ValidationError as err:
                logger.info("Dropped Table {} due to {}".format(row['name'], err))
                self.report.report_dropped(row['name'], err)
                continue

    def get_report(self):
        return self.report

    def close(self):
        self.alchemy_helper.close()

    def get_status(self) -> SourceStatus:
        return self.report
