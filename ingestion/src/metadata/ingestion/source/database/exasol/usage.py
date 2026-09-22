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
Exasol usage module
"""

from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.source.database.exasol.queries import EXASOL_SQL_STATEMENT
from metadata.ingestion.source.database.exasol.query_parser import ExasolQueryParserSource
from metadata.ingestion.source.database.usage_source import UsageSource


class ExasolUsageSource(ExasolQueryParserSource, UsageSource):
    """
    Exasol class for Usage
    """

    dialect = Dialect.EXASOL  # pyright: ignore[reportAssignmentType]
    sql_stmt = EXASOL_SQL_STATEMENT
    filters = """
        AND s.command_name = 'SELECT'
    """
