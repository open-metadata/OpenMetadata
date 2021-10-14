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

from typing import Any, Dict, Iterable, Iterator, Union

from metadata.ingestion.api.source import Source, SourceStatus

# This import verifies that the dependencies are available.
from metadata.ingestion.models.table_queries import TableQuery
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.snowflake import SnowflakeConfig
from metadata.ingestion.source.sql_alchemy_helper import (
    SQLAlchemyHelper,
    SQLSourceStatus,
)
from metadata.utils.helpers import get_start_and_end


class SnowflakeUsageSource(Source):
    # SELECT statement from mysql information_schema to extract table and column metadata
    SQL_STATEMENT = """
        select query_id as query,Query_text as sql,query_type as label,
        database_name as database,start_time as starttime,end_time as endtime,schema_name
        from table(information_schema.query_history(
        end_time_range_start=>to_timestamp_ltz('{start_date}'),
        end_time_range_end=>to_timestamp_ltz('{end_date}')));
        """

    # CONFIG KEYS
    WHERE_CLAUSE_SUFFIX_KEY = "where_clause"
    CLUSTER_SOURCE = "cluster_source"
    CLUSTER_KEY = "cluster_key"
    USE_CATALOG_AS_CLUSTER_NAME = "use_catalog_as_cluster_name"
    DATABASE_KEY = "database_key"
    SERVICE_TYPE = "Snowflake"
    DEFAULT_CLUSTER_SOURCE = "CURRENT_DATABASE()"

    def __init__(self, config, metadata_config, ctx):
        super().__init__(ctx)
        start, end = get_start_and_end(config.duration)
        print(start)
        print(end)
        self.sql_stmt = SnowflakeUsageSource.SQL_STATEMENT.format(
            start_date=start, end_date=end
        )
        self.alchemy_helper = SQLAlchemyHelper(
            config, metadata_config, ctx, "Snowflake", self.sql_stmt
        )
        self._extract_iter: Union[None, Iterator] = None
        self._database = "Snowflake"
        self.report = SQLSourceStatus()

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SnowflakeConfig.parse_obj(config_dict)
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
                row["query"],
                row["label"],
                0,
                0,
                0,
                str(row["starttime"]),
                str(row["endtime"]),
                str(row["starttime"])[0:19],
                2,
                row["database"],
                0,
                row["sql"],
            )
            if row["schema_name"] is not None:
                self.report.scanned(f"{row['database']}.{row['schema_name']}")
            else:
                self.report.scanned(f"{row['database']}")
            yield tq

    def get_report(self):
        return self.report

    def close(self):
        self.alchemy_helper.close()

    def get_status(self) -> SourceStatus:
        return self.report
