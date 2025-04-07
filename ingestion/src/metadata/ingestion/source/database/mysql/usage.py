#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
MYSQL usage module
"""
from metadata.ingestion.source.database.mysql.queries import MYSQL_SQL_STATEMENT
from metadata.ingestion.source.database.mysql.query_parser import MysqlQueryParserSource
from metadata.ingestion.source.database.usage_source import UsageSource


class MysqlUsageSource(MysqlQueryParserSource, UsageSource):
    sql_stmt = MYSQL_SQL_STATEMENT
    filters = ""

    def format_query(self, query: bytes) -> str:
        return query.decode(errors="ignore").replace("\\n", "\n")
