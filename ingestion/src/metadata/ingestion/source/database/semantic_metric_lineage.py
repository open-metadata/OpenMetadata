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
Edge construction shared by the semantic-layer lineage extractors.

Every semantic layer ends at the same place: a set of ``(source column, view column)``
name pairs per source relation, which have to become one ``AddLineageRequest`` carrying
the pairs that actually resolve to columns on both entities. Deciding *which* pairs --
walking a Snowflake logical-table map, or a Databricks metric view's joins -- is the
connector's job and stays there.

``LineageSource.get_column_lineage`` does not fit: it pairs columns by identical name,
and the whole point of a semantic layer is that ``Total Revenue`` is not called
``o_totalprice`` upstream.
"""

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.metric import Metric
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.sql_lineage import get_column_fqn

# A (source column name, view column name) pair proposed by a connector.
ColumnPair = tuple[str, str]


def table_reference(entity: Table) -> EntityReference:
    """A table ``EntityReference`` for one end of a lineage edge."""
    return EntityReference(id=entity.id, type="table")  # pyright: ignore[reportCallIssue]


def column_lineage(from_entity: Table, to_entity: Table, pairs: list[ColumnPair]) -> list[ColumnLineage]:
    """Turn ``(source column, view column)`` name pairs into ``ColumnLineage`` entries.

    Grouped by destination column, because a semantic layer routinely derives one view
    column from several source columns and the API models that as one entry with many
    ``fromColumns``. A pair whose either end does not resolve to a real column is
    dropped: connectors propose candidates parsed out of expressions, and resolution
    against the ingested entity is what separates a column reference from a function
    name or a literal.
    """
    grouped: dict[str, list[str]] = {}
    for source_column, view_column in pairs:
        from_fqn = get_column_fqn(from_entity, source_column)
        to_fqn = get_column_fqn(to_entity, view_column)
        if not from_fqn or not to_fqn:
            continue
        sources = grouped.setdefault(to_fqn, [])
        if from_fqn not in sources:
            sources.append(from_fqn)
    return [
        ColumnLineage(  # pyright: ignore[reportCallIssue]
            fromColumns=[FullyQualifiedEntityName(source) for source in sources],
            toColumn=FullyQualifiedEntityName(to_fqn),
        )
        for to_fqn, sources in grouped.items()
    ]


def view_lineage_request(
    from_entity: Table, to_entity: Table, columns: list[ColumnLineage]
) -> Either[AddLineageRequest]:
    """One ``source relation -> semantic view`` edge.

    ``ViewLineage`` because a semantic view *is* a view: the edge is declared by the
    object's own definition, not observed in a query log.
    """
    return Either(  # pyright: ignore[reportCallIssue]
        right=AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=table_reference(from_entity),
                toEntity=table_reference(to_entity),
                lineageDetails=LineageDetails(  # pyright: ignore[reportCallIssue]
                    source=LineageSource.ViewLineage,
                    columnsLineage=columns or None,
                ),
            )
        )
    )


def metric_lineage_request(from_entity: Table, metric: Metric) -> Either[AddLineageRequest]:
    """One ``semantic view -> Metric`` edge.

    No column lineage: the measure's own expression is already on the Metric, and the
    view column it is computed into is the same name, so a column pair here would
    restate the edge rather than refine it.
    """
    return Either(  # pyright: ignore[reportCallIssue]
        right=AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=table_reference(from_entity),
                toEntity=EntityReference(id=metric.id, type="metric"),  # pyright: ignore[reportCallIssue]
                lineageDetails=LineageDetails(source=LineageSource.ViewLineage),  # pyright: ignore[reportCallIssue]
            )
        )
    )
