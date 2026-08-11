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
"""Immutable, connector-neutral records the MetricIngestionFeature accepts.

``related_assets`` carries fully-qualified ``EntityReference``s built by the
connector (typically with just ``type`` + ``fullyQualifiedName``); the server
resolves FQN → id at write time, so the feature never needs to look up the
entity via a REST call.
"""

from __future__ import annotations

from enum import Enum

from pydantic import ConfigDict, Field

from metadata.generated.schema.entity.data.metric import (  # noqa: TC001
    MetricDimension,
    MetricExpression,
    MetricFilter,
    MetricGranularity,
    MetricMeasure,
    MetricType,
    UnitOfMeasurement,
)
from metadata.generated.schema.type.entityReferenceInput import EntityReferenceInput  # noqa: TC001
from metadata.generated.schema.type.tagLabel import TagLabel  # noqa: TC001
from metadata.ingestion.models.custom_pydantic import BaseModel


class MetricSourceType(str, Enum):
    """Stable, source-native origin label used inside MetricKey."""

    DBT = "dbt"
    SNOWFLAKE = "snowflake"
    POWERBI = "powerbi"
    OTHER = "other"


class MetricOrigin(BaseModel):
    """Provenance for a normalized metric definition."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    source_type: MetricSourceType
    service_name: str
    external_id: str
    diagnostic: str | None = Field(default=None)


class MetricKey(BaseModel):
    """Source-scoped identity. Equality is (source_type, service_name, external_id)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    source_type: MetricSourceType
    service_name: str
    external_id: str

    @classmethod
    def from_origin(cls, origin: MetricOrigin) -> MetricKey:
        return cls(
            source_type=origin.source_type,
            service_name=origin.service_name,
            external_id=origin.external_id,
        )


class MetricDefinition(BaseModel):
    """Everything the feature needs to materialize a Metric entity."""

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    key: MetricKey
    origin: MetricOrigin
    name: str
    display_name: str | None = Field(default=None)
    description: str | None = Field(default=None)
    expression: MetricExpression | None = Field(default=None)
    metric_type: MetricType | None = Field(default=None)
    unit: UnitOfMeasurement | None = Field(default=None)
    granularity: MetricGranularity | None = Field(default=None)
    dimensions: tuple[MetricDimension, ...] = Field(default_factory=tuple)
    measures: tuple[MetricMeasure, ...] = Field(default_factory=tuple)
    filters: tuple[MetricFilter, ...] = Field(default_factory=tuple)
    tags: tuple[TagLabel, ...] = Field(default_factory=tuple)
    related_assets: tuple[EntityReferenceInput, ...] = Field(default_factory=tuple)
    depends_on: tuple[MetricKey, ...] = Field(default_factory=tuple)
    source_native: dict | None = Field(default=None)

    def canonical_payload(self) -> tuple:
        """Value tuple used to detect non-identical conflicts on one MetricKey."""
        return (
            self.name,
            self.display_name,
            self.description,
            self.expression,
            self.metric_type,
            self.unit,
            self.granularity,
            self.dimensions,
            self.measures,
            self.filters,
            self.tags,
            tuple(sorted(self.related_assets, key=_asset_ref_sort_key)),
            tuple(sorted(self.depends_on, key=_key_sort_key)),
        )


def _key_sort_key(key: MetricKey) -> tuple[str, str, str]:
    return (key.source_type.value, key.service_name, key.external_id)


def _asset_ref_sort_key(ref: EntityReferenceInput) -> tuple[str, str]:
    fqn = getattr(ref, "fullyQualifiedName", None) or ""
    return (ref.type or "", str(fqn))
