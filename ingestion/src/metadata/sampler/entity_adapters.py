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
Strategy adapters for classifiable entity types (Table, Container, …).

Each adapter encodes the per-type knowledge that would otherwise be scattered
across isinstance checks:
  - how to access/set columns
  - which fields to PATCH
  - which pipeline config class maps to this entity
  - which ServiceType to use
  - how to build the kwargs for SamplerInterface.create()

Adding a new classifiable entity type (e.g. DashboardDataModel) means:
  1. Add a new adapter subclass here, decorated with @register_adapter(entity=..., pipeline=...)
  2. Extend ClassifiableEntityType in pii/types.py
  3. Extend the isinstance tuple in workflow/classification.py
No other files need to change.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from copy import deepcopy
from typing import TYPE_CHECKING, Any, ClassVar, Generic, TypeVar

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.storageServiceAutoClassificationPipeline import (
    StorageServiceAutoClassificationPipeline,
)
from metadata.sampler.config import (
    get_config_for_table,
    get_exclude_columns,
    get_include_columns,
    get_profile_sample_config,
    get_sample_data_count_config,
    get_sample_query,
)
from metadata.sampler.config_utils import build_database_service_conn_config
from metadata.sampler.models import SampleConfig
from metadata.sampler.partition import get_partition_details
from metadata.sampler.sampler_config import DatabaseSamplerConfig, StorageSamplerConfig

if TYPE_CHECKING:
    from collections.abc import Callable

    from metadata.generated.schema.metadataIngestion.workflow import (
        OpenMetadataWorkflowConfig,
    )
    from metadata.ingestion.ometa.ometa_api import OpenMetadata


_A = TypeVar("_A", bound="EntityAdapter[Any]")
E = TypeVar("E")

_BY_ENTITY: dict[type, EntityAdapter[Any]] = {}
_BY_PIPELINE: dict[type, EntityAdapter[Any]] = {}


def register_adapter(*, entity: type, pipeline: type) -> Callable[[type[_A]], type[_A]]:
    """Class decorator that registers an EntityAdapter subclass in both lookup dicts."""

    def decorator(cls: type[_A]) -> type[_A]:
        instance = cls()
        _BY_ENTITY[entity] = instance
        _BY_PIPELINE[pipeline] = instance
        return cls

    return decorator


class EntityAdapter(ABC, Generic[E]):
    """Strategy for entity-type-specific behaviour in the classification pipeline.

    Adapters are stateless — all inputs are passed as arguments.
    They describe entity *structure* only; they do not call external APIs.
    """

    pipeline_config_class: type
    service_type: ServiceType
    patch_fields: ClassVar[list[str]]

    @abstractmethod
    def get_columns(self, entity: E) -> list[Column] | None:
        """Return the entity's columns, or None if unavailable."""

    @abstractmethod
    def set_columns(self, entity: E, columns: list[Column]) -> None:
        """Set the entity's column list in-place."""

    @abstractmethod
    def build_sampler_kwargs(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
        entity: E,
        profiler_config: Any,
        source_config: Any,
    ) -> dict | None:
        """Return kwargs for SamplerInterface.create(), or None on unrecoverable error."""


@register_adapter(entity=Table, pipeline=DatabaseServiceAutoClassificationPipeline)
class TableAdapter(EntityAdapter[Table]):
    pipeline_config_class = DatabaseServiceAutoClassificationPipeline
    service_type = ServiceType.Database
    patch_fields: ClassVar[list[str]] = ["tags", "columns"]

    def get_columns(self, entity: Table) -> list[Column] | None:
        return entity.columns

    def set_columns(self, entity: Table, columns: list[Column]) -> None:
        entity.columns = columns

    def build_sampler_kwargs(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
        entity: Table,
        profiler_config: Any,
        source_config: Any,
    ) -> dict | None:
        from metadata.utils.profiler_utils import get_context_entities  # noqa: PLC0415

        schema_entity, database_entity, _ = get_context_entities(entity=entity, metadata=metadata)
        if database_entity is None:
            return None
        table_config = get_config_for_table(entity, profiler_config)
        return {
            "service_connection_config": build_database_service_conn_config(config, database_entity),
            "ometa_client": metadata,
            "entity": entity,
            "config": DatabaseSamplerConfig(
                sample_config=get_profile_sample_config(
                    entity=entity,
                    schema_entity=schema_entity,
                    database_entity=database_entity,
                    entity_config=table_config,
                    default_sample_config=SampleConfig(),
                ),
                sample_data_count=get_sample_data_count_config(
                    entity=entity,
                    schema_entity=schema_entity,
                    database_entity=database_entity,
                    entity_config=table_config,
                    default_sample_data_count=source_config.sampleDataCount,
                ),
                include_columns=get_include_columns(entity, entity_config=table_config) or [],
                exclude_columns=get_exclude_columns(entity, entity_config=table_config) or [],
                partition_details=get_partition_details(entity=entity, entity_config=table_config),
                sample_query=get_sample_query(entity=entity, entity_config=table_config),
            ),
        }


@register_adapter(entity=Container, pipeline=StorageServiceAutoClassificationPipeline)
class ContainerAdapter(EntityAdapter[Container]):
    pipeline_config_class = StorageServiceAutoClassificationPipeline
    service_type = ServiceType.Storage
    patch_fields: ClassVar[list[str]] = ["tags", "dataModel"]

    def get_columns(self, entity: Container) -> list[Column] | None:
        return entity.dataModel.columns if entity.dataModel else None

    def set_columns(self, entity: Container, columns: list[Column]) -> None:
        if entity.dataModel:
            entity.dataModel.columns = columns

    def build_sampler_kwargs(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
        entity: Container,
        profiler_config: Any,
        source_config: Any,
    ) -> dict | None:
        if config.source.serviceConnection is None or config.source.serviceConnection.root is None:
            return None
        return {
            "service_connection_config": deepcopy(config.source.serviceConnection.root.config),
            "ometa_client": metadata,
            "entity": entity,
            "config": StorageSamplerConfig(
                sample_data_count=source_config.sampleDataCount,
            ),
        }


def adapter_for(entity: object) -> EntityAdapter | None:
    """Look up the adapter for a classifiable entity instance."""
    return _BY_ENTITY.get(type(entity))


def adapter_for_pipeline(pipeline_config: object) -> EntityAdapter | None:
    """Look up the adapter for a pipeline config instance."""
    return _BY_PIPELINE.get(type(pipeline_config))
