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
Clickhouse lineage module
"""
import re
import traceback
from typing import Iterable, Optional

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityLineage import (
    EntitiesEdge,
    LineageDetails,
    Source,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_SQL_STATEMENT,
)
from metadata.ingestion.source.database.clickhouse.query_parser import (
    ClickhouseQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.models import TableView
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Regex to extract the TO <schema>.<table> clause from a ClickHouse
# MATERIALIZED VIEW DDL. Handles both simple and REFRESH EVERY / DEFINER variants.
_CLICKHOUSE_MV_TO_RE = re.compile(
        r"""
            \\bTO\\s+                         # literal TO keyword
                (?:`?(?P<schema>[^`.\\s]+)`?\\.)?  # optional schema (backtick-quoted or plain)
                    `?(?P<table>[^`\\s(,]+)`?         # table name
                        """,
        re.IGNORECASE | re.VERBOSE,
)


def _extract_mv_to_table(ddl: str) -> Optional[tuple]:
        """
            Given the DDL of a ClickHouse MATERIALIZED VIEW, return (schema, table)
                for the TO clause target, or None if the DDL does not use the TO syntax.
                    """
        if not re.search(r"\\bMATERIALIZED\\s+VIEW\\b", ddl, re.IGNORECASE):
                    return None
                match = _CLICKHOUSE_MV_TO_RE.search(ddl)
    if match:
                return match.group("schema"), match.group("table")
            return None


class ClickhouseLineageSource(ClickhouseQueryParserSource, LineageSource):
        """
            I
