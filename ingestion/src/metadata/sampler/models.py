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
Sampling Models
"""

from typing import Annotated, Any, TypeVar

from pydantic import Field, model_validator

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.table import (
    ColumnProfilerConfig,
    PartitionProfilerConfig,
    Table,
    TableData,
)
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    SampleDataStorageConfig,
)
from metadata.generated.schema.type.basic import (
    FullyQualifiedEntityName,
    ProfileSampleType,
    SamplingMethodType,
)
from metadata.generated.schema.type.samplingConfig import ProfileSampleConfig
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.pii.types import ClassifiableEntityType

T = TypeVar("T", bound=BaseModel)


class BaseProfileConfig(ConfigModel):
    """base profile config"""

    fullyQualifiedName: FullyQualifiedEntityName  # noqa: N815
    profileSample: float | int | None = None  # noqa: N815
    profileSampleType: ProfileSampleType | None = None  # noqa: N815
    samplingMethodType: SamplingMethodType | None = None  # noqa: N815
    sampleDataCount: int | None = 100  # noqa: N815
    randomizedSample: bool | None = True  # noqa: N815
    profileSampleConfig: ProfileSampleConfig | None = None  # noqa: N815


class ColumnConfig(ConfigModel):
    """Column config for profiler"""

    excludeColumns: list[str] | None = None  # noqa: N815
    includeColumns: list[ColumnProfilerConfig] | None = None  # noqa: N815


class TableConfig(BaseProfileConfig):
    """table profile config"""

    profileQuery: str | None = None  # noqa: N815
    partitionConfig: PartitionProfilerConfig | None = None  # noqa: N815
    columnConfig: ColumnConfig | None = None  # noqa: N815
    randomizedSample: bool | None = False  # noqa: N815

    @classmethod
    def from_database_and_schema_config(cls, config: "DatabaseAndSchemaConfig", table_fqn: str):
        table_config = TableConfig(
            fullyQualifiedName=table_fqn,
            profileSample=config.profileSample,
            profileSampleType=config.profileSampleType,
            sampleDataCount=config.sampleDataCount,
            samplingMethodType=config.samplingMethodType,
            profileSampleConfig=config.profileSampleConfig,
        )
        return table_config  # noqa: RET504


class DatabaseAndSchemaConfig(BaseProfileConfig):
    """schema profile config"""

    sampleDataStorageConfig: SampleDataStorageConfig | None = None  # noqa: N815


class SampleData(BaseModel):
    """TableData wrapper to handle ephemeral SampleData"""

    data: Annotated[TableData, Field(None, description="Table Sample Data")]
    store: Annotated[bool, Field(False, description="Is the sample data should be stored or not")]


class SamplerResponse(ConfigModel):
    """PII & Sampler Workflow Response. For a given entity, return all the tags and sample data"""

    entity: ClassifiableEntityType
    sample_data: SampleData | None = None
    column_tags: list[ColumnTag] | None = None

    @model_validator(mode="before")
    @classmethod
    def handle_backward_compatibility(cls, data: Any) -> Any:
        """Handle backward compatibility for table -> entity field rename"""
        if isinstance(data, dict) and "table" in data and "entity" not in data:
            data["entity"] = data.pop("table")
        return data

    @property
    def table(self) -> Table:
        """Backward compatibility property. Returns entity as Table.

        Deprecated: Use .entity instead. Will be removed when all entity types are supported.
        """
        return self.entity  # type: ignore

    def __str__(self):
        """Return the entity name being processed"""
        entity_type = type(self.entity).__name__
        entity_name = self.entity.name.root if hasattr(self.entity, "name") else "Unknown"
        return f"{entity_type} [{entity_name}]"


class SampleConfig(ConfigModel):
    """Profile Sample Config"""

    profileSampleConfig: ProfileSampleConfig | None = None  # noqa: N815
    randomizedSample: bool | None = True  # noqa: N815

    def get_config(self, config_class: type[T]) -> T | None:
        """Extract the config of the specified type from profileSampleConfig, or None."""
        if self.profileSampleConfig and self.profileSampleConfig.config:
            cfg = self.profileSampleConfig.config
            if isinstance(cfg, config_class):
                return config_class.model_validate(cfg.model_dump())
        return None
