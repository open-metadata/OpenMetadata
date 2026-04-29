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

from enum import Enum
from typing import Any, List, Optional, Union  # noqa: UP035

from pydantic import Field, field_validator, model_validator
from typing_extensions import Annotated  # noqa: UP035

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
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.pii.types import ClassifiableEntityType


class ProfileSampleConfigType(str, Enum):
    STATIC = "STATIC"
    DYNAMIC = "DYNAMIC"


class DynamicSamplingThreshold(ConfigModel):
    """Single threshold entry for dynamic sampling"""

    rowCountThreshold: int  # noqa: N815
    profileSample: Union[float, int]  # noqa: N815, UP007
    profileSampleType: Optional[ProfileSampleType] = ProfileSampleType.PERCENTAGE  # noqa: N815, UP045
    samplingMethodType: Optional[SamplingMethodType] = None  # noqa: N815, UP045


class DynamicSamplingConfig(ConfigModel):
    """Configuration for dynamic sampling with row-count-based thresholds"""

    thresholds: Optional[List[DynamicSamplingThreshold]] = None  # noqa: UP006, UP045

    @field_validator("thresholds")
    @classmethod
    def sort_thresholds_descending(
        cls,
        v: Optional[List[DynamicSamplingThreshold]],  # noqa: UP006, UP045
    ) -> Optional[List[DynamicSamplingThreshold]]:  # noqa: UP006, UP045
        if v is not None:
            return sorted(v, key=lambda t: t.rowCountThreshold, reverse=True)
        return v


class StaticSamplingConfig(ConfigModel):
    """Configuration for static sampling"""

    profileSample: Optional[Union[float, int]] = None  # noqa: N815, UP007, UP045
    profileSampleType: Optional[ProfileSampleType] = ProfileSampleType.PERCENTAGE  # noqa: N815, UP045
    samplingMethodType: Optional[SamplingMethodType] = None  # noqa: N815, UP045


class ProfileSampleConfig(ConfigModel):
    """Profile sample configuration supporting static and dynamic sampling"""

    sampleConfigType: ProfileSampleConfigType = ProfileSampleConfigType.STATIC  # noqa: N815
    config: Optional[Union[DynamicSamplingConfig, StaticSamplingConfig]] = None  # noqa: UP007, UP045


class BaseProfileConfig(ConfigModel):
    """base profile config"""

    fullyQualifiedName: FullyQualifiedEntityName  # noqa: N815
    profileSample: Optional[Union[float, int]] = None  # noqa: N815, UP007, UP045
    profileSampleType: Optional[ProfileSampleType] = None  # noqa: N815, UP045
    samplingMethodType: Optional[SamplingMethodType] = None  # noqa: N815, UP045
    sampleDataCount: Optional[int] = 100  # noqa: N815, UP045
    randomizedSample: Optional[bool] = True  # noqa: N815, UP045
    profileSampleConfig: Optional[ProfileSampleConfig] = None  # noqa: N815, UP045


class ColumnConfig(ConfigModel):
    """Column config for profiler"""

    excludeColumns: Optional[List[str]] = None  # noqa: N815, UP006, UP045
    includeColumns: Optional[List[ColumnProfilerConfig]] = None  # noqa: N815, UP006, UP045


class TableConfig(BaseProfileConfig):
    """table profile config"""

    profileQuery: Optional[str] = None  # noqa: N815, UP045
    partitionConfig: Optional[PartitionProfilerConfig] = None  # noqa: N815, UP045
    columnConfig: Optional[ColumnConfig] = None  # noqa: N815, UP045
    randomizedSample: Optional[bool] = False  # noqa: N815, UP045

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

    sampleDataStorageConfig: Optional[SampleDataStorageConfig] = None  # noqa: N815, UP045


class SampleData(BaseModel):
    """TableData wrapper to handle ephemeral SampleData"""

    data: Annotated[TableData, Field(None, description="Table Sample Data")]
    store: Annotated[bool, Field(False, description="Is the sample data should be stored or not")]


class SamplerResponse(ConfigModel):
    """PII & Sampler Workflow Response. For a given entity, return all the tags and sample data"""

    entity: ClassifiableEntityType
    sample_data: Optional[SampleData] = None  # noqa: UP045
    column_tags: Optional[List[ColumnTag]] = None  # noqa: UP006, UP045

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

    profileSampleConfig: Optional[ProfileSampleConfig] = None  # noqa: N815, UP045
    randomizedSample: Optional[bool] = True  # noqa: N815, UP045

    def get_static_config(self) -> Optional[StaticSamplingConfig]:  # noqa: UP045
        """Extract the StaticSamplingConfig from profileSampleConfig, or None."""
        if self.profileSampleConfig and self.profileSampleConfig.config:
            cfg = self.profileSampleConfig.config
            if isinstance(cfg, StaticSamplingConfig):
                return cfg
        return None
