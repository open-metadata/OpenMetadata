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
"""Pure mappers: normalized MetricDefinition → CreateMetricRequest."""

from __future__ import annotations

from typing import TYPE_CHECKING

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.type.entityReferenceInputList import EntityReferenceInputList

if TYPE_CHECKING:
    from metadata.domain.metrics.records import MetricDefinition, MetricKey


def to_create_request(
    definition: MetricDefinition,
    related_metric_fqns: list[str] | None = None,
) -> CreateMetricRequest:
    """Build a CreateMetricRequest with ``assets`` attached as fqn-only
    EntityReferenceInput items — server resolves fqn → id in MetricMapper."""
    assets = EntityReferenceInputList(root=list(definition.related_assets)) if definition.related_assets else None
    return CreateMetricRequest(  # pyright: ignore[reportCallIssue]
        name=definition.name,
        displayName=definition.display_name,
        description=definition.description,
        metricExpression=definition.expression,
        metricType=definition.metric_type,
        unitOfMeasurement=definition.unit,
        granularity=definition.granularity,
        dimensions=list(definition.dimensions) or None,
        measures=list(definition.measures) or None,
        filters=list(definition.filters) or None,
        tags=list(definition.tags) or None,
        relatedMetrics=related_metric_fqns or None,
        assets=assets,
    )


def resolve_related_metric_fqns(
    definition: MetricDefinition,
    resolved_metric_fqns: dict[MetricKey, str],
) -> list[str]:
    """Return the subset of upstream metric FQNs that resolved successfully."""
    return [resolved_metric_fqns[dep_key] for dep_key in definition.depends_on if dep_key in resolved_metric_fqns]
