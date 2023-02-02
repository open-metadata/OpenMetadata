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
from metadata.ingestion.source.database.mssql.queries import MSSQL_SQL_STATEMENT
from metadata.ingestion.source.database.mssql.query_parser import MssqlQueryParserSource
from metadata.ingestion.source.database.usage_source import UsageSource


class MssqlUsageSource(MssqlQueryParserSource, UsageSource):

    sql_stmt = MSSQL_SQL_STATEMENT

    filters = ""  # No filtering in the queries

    database_field = "db.NAME"

    schema_field = ""  # schema filtering not available
