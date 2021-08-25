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
from sqlalchemy.engine import create_engine
from sqlalchemy.inspection import inspect
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.api.source import Source, SourceStatus
from typing import Dict, Any, Iterable
from metadata.ingestion.source.sql_alchemy_helper import SQLSourceStatus
from metadata.utils.helpers import get_start_and_end
from metadata.ingestion.source.bigquery import BigQueryConfig

logger = logging.getLogger(__name__)


class BigqueryUsageSource(Source):
    # SELECT statement from mysql information_schema to extract table and column metadata
    SQL_STATEMENT = """
        DECLARE start_date, end_date DATE;
        SET start_date = DATE("{start_date}");
        SET end_date = DATE("{end_date}");

        WITH
        auditlog AS (
          SELECT *
      FROM `{project_id}.{dataset}.cloudaudit_googleapis_com_data*`
      WHERE
        _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', start_date)
                          AND FORMAT_DATE('%Y%m%d', end_date)
        AND resource.type = "bigquery_resource"
    )
    , job_completed AS (
      SELECT *
      FROM auditlog
      WHERE
        protopayload_auditlog.methodName = "jobservice.jobcompleted"
        AND protopayload_auditlog.status.message = "DONE"
    )
    , insert AS (
      SELECT *
      FROM auditlog
      WHERE
        protopayload_auditlog.methodName = "jobservice.insert"
        AND protopayload_auditlog.status.message = "DONE"
    )
    , unioned AS (
      SELECT * FROM job_completed
      UNION ALL
      SELECT * FROM insert
    )

    SELECT * FROM unioned
    ORDER BY timestamp
    LIMIT 1000
            """

    SERVICE_TYPE = 'Bigquery'
    scheme = "bigquery"

    def __init__(self, config, metadata_config, ctx):
        super().__init__(ctx)
        start, end = get_start_and_end(config.duration)
        self.project_id = config.project_id
        self.engine = create_engine(self.get_connection_url(), **config.options).connect()
        inspector = inspect(self.engine)
        for schema in inspector.get_schema_names():
            dataset_name = schema
        self.sql_stmt = BigqueryUsageSource.SQL_STATEMENT.format(
            project_id=self.project_id,
            start_date=start,
            end_date=end,
            dataset=dataset_name
        )
        self.status = SQLSourceStatus()

    def get_connection_url(self):
        if self.project_id:
            print(f"{self.scheme}://{self.project_id}")
            return f"{self.scheme}://{self.project_id}"
        return f"{self.scheme}://"

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = BigQueryConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def _get_raw_extract_iter(self) -> Iterable[Dict[str, Any]]:
        """
        Provides iterator of result row from SQLAlchemy helper
        :return:
        """
        try:
            rows = self.engine.execute(self.sql_stmt).fetchall()
            for row in rows:
                yield row
        except Exception as err:
            logger.error(f"{repr(err)} + {err}")

    def next_record(self) -> Iterable[TableQuery]:
        for row in self._get_raw_extract_iter():
            tq = TableQuery(row['query'], row['label'], row['userid'], row['xid'], row['pid'], str(row['starttime']),
                            str(row['endtime']), str(row['analysis_date']), row['duration'], row['database'],
                            row['aborted'], row['sql'])
            yield tq

    def close(self):
        self.engine.close()

    def get_status(self) -> SourceStatus:
        return self.status
