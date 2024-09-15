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
Oracle lineage module

Execute with

source:
  type: oracle-usage
  serviceName: oracle
  sourceConfig:
    config:
      queryLogDuration: 1
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "token"
"""

from metadata.ingestion.source.database.oracle.queries import (
    ORACLE_QUERY_HISTORY_STATEMENT,
)
from metadata.ingestion.source.database.oracle.query_parser import (
    OracleQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource


class OracleUsageSource(OracleQueryParserSource, UsageSource):
    filters = ""  # No further filtering in the queries

    sql_stmt = ORACLE_QUERY_HISTORY_STATEMENT
