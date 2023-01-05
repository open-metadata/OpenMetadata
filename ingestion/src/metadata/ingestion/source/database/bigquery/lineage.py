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
Handle big query lineage extraction
"""
from metadata.ingestion.source.database.bigquery.queries import BIGQUERY_STATEMENT
from metadata.ingestion.source.database.bigquery.query_parser import (
    BigqueryQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import LineageSource


class BigqueryLineageSource(BigqueryQueryParserSource, LineageSource):
    """
    Implements the necessary methods to extract
    Database lineage from Bigquery Source
    """

    sql_stmt = BIGQUERY_STATEMENT

    filters = """
        AND statement_type IN ("INSERT", "MERGE", "CREATE_TABLE_AS_SELECT", "UPDATE")
    """

    database_field = "project_id"

    schema_field = ""  # schema filtering not available
