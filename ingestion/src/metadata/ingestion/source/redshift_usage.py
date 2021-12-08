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

# This import verifies that the dependencies are available.
import logging
from typing import Any, Dict, Iterable, Iterator, Union

from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.table_queries import TableQuery
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.redshift import RedshiftConfig
from metadata.ingestion.source.sql_alchemy_helper import (
    SQLAlchemyHelper,
    SQLSourceStatus,
)
from metadata.utils.helpers import get_start_and_end

logger = logging.getLogger(__name__)


class RedshiftUsageSource(Source[TableQuery]):
    # SELECT statement from mysql information_schema to extract table and column metadata
    SQL_STATEMENT = """
        SELECT DISTINCT ss.userid,
            ss.query,
            sui.usename,
            ss.tbl,
            sq.querytxt,
            sti.database,
            sti.schema,
            sti.table,
            sq.starttime,
            sq.endtime,
            sq.aborted
        FROM stl_scan ss
            JOIN svv_table_info sti ON ss.tbl = sti.table_id
            JOIN stl_query sq ON ss.query = sq.query
            JOIN svl_user_info sui ON sq.userid = sui.usesysid
        WHERE ss.starttime >= '{start_time}'
            AND ss.starttime < '{end_time}'
            AND sq.aborted = 0
        ORDER BY ss.endtime DESC;
    """
    # CONFIG KEYS
    WHERE_CLAUSE_SUFFIX_KEY = "where_clause"
    CLUSTER_SOURCE = "cluster_source"
    CLUSTER_KEY = "cluster_key"
    USE_CATALOG_AS_CLUSTER_NAME = "use_catalog_as_cluster_name"
    DATABASE_KEY = "database_key"
    SERVICE_TYPE = "Redshift"
    DEFAULT_CLUSTER_SOURCE = "CURRENT_DATABASE()"

    def __init__(self, config, metadata_config, ctx):
        super().__init__(ctx)
        start, end = get_start_and_end(config.duration)
        self.sql_stmt = RedshiftUsageSource.SQL_STATEMENT.format(
            start_time=start, end_time=end
        )
        self.analysis_date = start
        self.alchemy_helper = SQLAlchemyHelper(
            config, metadata_config, ctx, "Redshift", self.sql_stmt
        )
        self._extract_iter: Union[None, Iterator] = None
        self._database = "redshift"
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
            tq = TableQuery(
                query=row["query"],
                user_name=row["usename"],
                starttime=str(row["starttime"]),
                endtime=str(row["endtime"]),
                analysis_date=str(self.analysis_date),
                database=row["database"],
                aborted=row["aborted"],
                sql=row["querytxt"],
            )
            yield tq

    def close(self):
        self.alchemy_helper.close()

    def get_status(self) -> SourceStatus:
        return self.status
