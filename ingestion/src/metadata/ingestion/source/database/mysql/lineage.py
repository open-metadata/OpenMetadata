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
MYSQL lineage module
"""
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.mysql.queries import MYSQL_SQL_STATEMENT
from metadata.ingestion.source.database.mysql.query_parser import MysqlQueryParserSource


class MysqlLineageSource(MysqlQueryParserSource, LineageSource):

    sql_stmt = MYSQL_SQL_STATEMENT

    filters = """
        AND (
            lower(argument) LIKE '%%create%%table%%select%%'
            OR lower(argument) LIKE '%%insert%%into%%select%%'
            OR lower(argument) LIKE '%%update%%'
            OR lower(argument) LIKE '%%merge%%'
        )
    """
