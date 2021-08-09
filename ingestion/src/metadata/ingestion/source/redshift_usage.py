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
from metadata.ingestion.models.table_queries import TableQuery
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.source.sql_source_common import SQLAlchemyHelper, SQLSourceStatus
from metadata.ingestion.api.source import Source, SourceStatus
from typing import Iterator, Union, Dict, Any, Iterable
from metadata.utils.helpers import get_start_and_end
from metadata.ingestion.source.redshift import RedshiftConfig

logger = logging.getLogger(__name__)


class RedshiftUsageSource(Source):
    # SELECT statement from mysql information_schema to extract table and column metadata
    SQL_STATEMENT = """
        WITH query_sql AS (
                 SELECT
                    query,
                    LISTAGG(text) WITHIN GROUP (ORDER BY sequence) AS sql
                FROM stl_querytext 
                GROUP BY 1
        )

        SELECT
            q.query,  q.label, userid,  xid,  pid,  starttime,  endtime,
            DATEDIFF(milliseconds, starttime, endtime) AS duration,
            TRIM(database) AS database,
            '{start_date}' as analysis_date,
            (CASE aborted WHEN 1 THEN TRUE ELSE FALSE END) AS aborted,
        sql
        FROM
            stl_query q JOIN query_sql qs ON (q.query = qs.query)
        WHERE
        endtime between '{start_date}' and '{end_date}'
        {where_clause}
        ORDER BY starttime;
        """

    # CONFIG KEYS
    WHERE_CLAUSE_SUFFIX_KEY = 'where_clause'
    CLUSTER_SOURCE = 'cluster_source'
    CLUSTER_KEY = 'cluster_key'
    USE_CATALOG_AS_CLUSTER_NAME = 'use_catalog_as_cluster_name'
    DATABASE_KEY = 'database_key'
    SERVICE_TYPE = 'Redshift'
    DEFAULT_CLUSTER_SOURCE = 'CURRENT_DATABASE()'

    def __init__(self, config, metadata_config, ctx):
        super().__init__(ctx)
        start, end = get_start_and_end(config.duration)
        self.sql_stmt = RedshiftUsageSource.SQL_STATEMENT.format(
            where_clause=config.where_clause,
            start_date=start,
            end_date=end
        )
        self.alchemy_helper = SQLAlchemyHelper(config, metadata_config, ctx, "Redshift", self.sql_stmt)
        self._extract_iter: Union[None, Iterator] = None
        self._database = 'redshift'
        self.status = SQLSourceStatus()

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

    def next_record(self) -> Iterable[TableQuery]:
        """
                Using itertools.groupby and raw level iterator, it groups to table and yields TableMetadata
                :return:
                """
        for row in self._get_raw_extract_iter():
            tq = TableQuery(row['query'], row['label'], row['userid'], row['xid'], row['pid'], str(row['starttime']),
                            str(row['endtime']), str(row['analysis_date']), row['duration'], row['database'], row['aborted'], row['sql'])
            self.status.records_produced(tq)
            yield tq

    def close(self):
        self.alchemy_helper.close()

    def get_status(self) -> SourceStatus:
        return self.status
