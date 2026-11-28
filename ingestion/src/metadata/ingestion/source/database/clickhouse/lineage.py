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

from collections.abc import Iterable
from typing import Any

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.clickhouse.kafka_lineage import (
    yield_kafka_engine_lineage,
)
from metadata.ingestion.source.database.clickhouse.lineage_utils import (
    get_mv_target_lineage,
    get_view_lineage_parser,
)
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_SQL_STATEMENT,
)
from metadata.ingestion.source.database.clickhouse.query_parser import (
    ClickhouseQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.utils.db_utils import ViewLineageExtension, ViewLineageParserFactory


class ClickhouseLineageSource(ClickhouseQueryParserSource, LineageSource):
    """
    Implements the necessary methods to extract
    Database lineage from Clickhouse Source
    """

    sql_stmt = CLICKHOUSE_SQL_STATEMENT

    filters = """
        and (
            query_kind='Create' 
            or (query_kind='Insert' and query ilike '%%insert%%into%%select%%')
        )
    """  # noqa: W291

    database_field = ""

    schema_field = "databases"

    def get_view_lineage_extension(self) -> ViewLineageExtension | None:
        """
        Materialized views created with a `TO` clause write into their target table
        """
        return get_mv_target_lineage

    def get_view_lineage_parser_factory(self) -> ViewLineageParserFactory | None:
        """Keep explicit materialized-view outputs outside the input lineage graph."""
        return get_view_lineage_parser

    def _iter(self, *args: Any, **kwargs: Any) -> Iterable[Either[AddLineageRequest | CreateQueryRequest]]:
        yield from super()._iter(*args, **kwargs)
        yield from yield_kafka_engine_lineage(self)  # pyright: ignore[reportReturnType]
