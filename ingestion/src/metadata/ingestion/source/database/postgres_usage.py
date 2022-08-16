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
"""
MSSQL usage module
"""
import csv
import traceback
import pandas as pd
from datetime import datetime
from typing import Iterable, Optional
from metadata.ingestion.source.database.usage_source import UsageSource

from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PostgresUsageSource(UsageSource):


    filters = ""
    
    def get_table_query(self) -> Optional[Iterable[TableQuery]]:
        """
        If queryLogFilePath available in config iterate through log file
        otherwise execute the sql query to fetch TableQuery data
        """
        try:
            if self.config.sourceConfig.config.queryLogFilePath:
                df = pd.read_csv(self.config.sourceConfig.config.queryLogFilePath, header=None)
                d = df.copy()
                pd.set_option('display.max_columns', None)
                pd.set_option('display.max_rows', None)
                pd.set_option('display.max_colwidth', None)
                d.columns = ["log_time", "user_name", "database_name", "process_id", "connection_from", "session_id", "session_line_num", "command_tag", "session_start_time", "virtual_transaction_id", "transaction_id", "error_severity", "sql_state_code", "message", "detail", "hint", "internal_query", "internal_query_pos", "context", "query", "query_pos", "location", "application_name", "backend_type", "leader_pid", "query_id"]
                d.sql_state_code = (d.sql_state_code != 0).astype(bool)
                d = d[(~d.user_name.isnull()) & (d.command_tag == 'SELECT')].drop(['query'], axis=1).rename(columns={'message':'query', 'log_time':'end_time', 'sql_state_code':'aborted'})
                d['query'] = d['query'].str.replace('execute <unnamed>: ', '')


                dcl = d[['query',#'command_tag', 
                    'database_name', #'schema_name',  # missing must be engineered later
                    'user_name', 'end_time', 'aborted',#'start_time', 'end_time', 'aborted'
                    ]].copy()
                dcl['duration'] = dcl['query'].shift(-1)
                dcl = dcl[~dcl['query'].str.contains('duration')]

                dcl['end_time'] = pd.to_datetime(dcl['end_time'])

                dcl['duration'] =  pd.to_timedelta(dcl['duration'].str[10:])#.extract(r'(\d+.\d+)').astype('float')
                dcl['start_time'] = dcl['end_time'] - dcl['duration']
                dcl['schema_name'] = 'dummy'

                fmt = '%Y-%m-%d %H:%M:%S.%f'
                dcl['start_time'] = dcl['start_time'].dt.strftime(fmt)
                dcl['end_time'] = dcl['end_time'].dt.strftime(fmt)

                dcl = dcl[['query', 'database_name', 'schema_name',
                        'user_name', 'start_time',
                    'end_time', 'aborted']].rename(columns={'query':'query_text'}).copy()
                
                
                query_list = []
                with open(self.config.sourceConfig.config.queryLogFilePath, "r") as fin:
                    for i in csv.DictReader(fin):
                        query_dict = dict(i)
                        analysis_date = (
                            datetime.utcnow()
                            if not query_dict.get("session_start_time")
                            else datetime.strptime(
                                query_dict.get("session_start_time"), "%Y-%m-%d %H:%M:%S.%f"
                            )
                        )
                        query_list.append(
                            TableQuery(
                                query=query_dict["query"],
                                userName=query_dict.get("user_name", ""),
                                startTime=query_dict.get("session_start_time", ""),
                                endTime=query_dict.get("log_time", ""),
                                analysisDate=analysis_date,
                                aborted=self.get_aborted_status(query_dict),
                                databaseName=self.get_database_name(query_dict),
                                serviceName=self.config.serviceName,
                                databaseSchema=self.get_schema_name(query_dict),
                            )
                        )
                yield TableQueries(queries=query_list)
        except Exception as err:
                logger.error(f"Source usage processing error - {err}")
                logger.debug(traceback.format_exc())

        
    def next_record(self) -> Iterable[TableQuery]:
        for table_queries in self.get_table_query():
            if table_queries:
                yield table_queries

