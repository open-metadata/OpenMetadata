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
Handle big query usage extraction
"""
from metadata.ingestion.source.database.bigquery_query_parser import (
    BigqueryQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.sql_queries import BIGQUERY_STATEMENT


class BigqueryUsageSource(BigqueryQueryParserSource, UsageSource):
    """
    Implements the necessary methods to extract
    Database Usage from Bigquery Source
    """

    sql_stmt = BIGQUERY_STATEMENT

    filters = """
        AND statement_type = "SELECT"
    """
