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
from typing import Any, List, Optional, Union

from pydantic import Field, model_validator
from typing_extensions import Annotated

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.table import (
    ColumnProfilerConfig,
    PartitionProfilerConfig,
    ProfileSampleType,
    SamplingMethodType,
    Table,
    TableData,
)
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    SampleDataStorageConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.pii.types import ClassifiableEntityType


class BaseProfileConfig(ConfigModel):
    """base profile config"""

    fullyQualifiedName: FullyQualifiedEntityName
    profileSample: Optional[Union[float, int]] = None
    profileSampleType: Optional[ProfileSampleType] = None
    samplingMethodType: Optional[SamplingMethodType] = None
    sampleDataCount: Optional[int] = 100
    randomizedSample: Optional[bool] = True


class ColumnConfig(ConfigModel):
    """Column config for profiler"""

    excludeColumns: Optional[List[str]] = None
    includeColumns: Optional[List[ColumnProfilerConfig]] = None


class TableConfig(BaseProfileConfig):
    """table profile config"""

    profileQuery: Optional[str] = None
    partitionConfig: Optional[PartitionProfilerConfig] = None
    columnConfig: Optional[ColumnConfig] = None
    randomizedSample: Optional[bool] = True

    @classmethod
    def from_database_and_schema_config(
        cls, config: "DatabaseAndSchemaConfig", table_fqn: str
    ):
        table_config = TableConfig(
            fullyQualifiedName=table_fqn,
            profileSample=config.profileSample,
            profileSampleType=config.profileSampleType,
            sampleDataCount=config.sampleDataCount,
            samplingMethodType=config.samplingMethodType,
        )
        return table_config


class DatabaseAndSchemaConfig(BaseProfileConfig):
    """schema profile config"""

    sampleDataStorageConfig: Optional[SampleDataStorageConfig] = None


class SampleData(BaseModel):
    """TableData wrapper to handle ephemeral SampleData"""

    data: Annotated[TableData, Field(None, description="Table Sample Data")]
    store: Annotated[
        bool, Field(False, description="Is the sample data should be stored or not")
    ]


class SamplerResponse(ConfigModel):
    """PII & Sampler Workflow Response. For a given entity, return all the tags and sample data"""

    entity: ClassifiableEntityType
    sample_data: Optional[SampleData] = None
    column_tags: Optional[List[ColumnTag]] = None

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
        entity_name = (
            self.entity.name.root if hasattr(self.entity, "name") else "Unknown"
        )
        return f"{entity_type} [{entity_name}]"


class SampleConfig(ConfigModel):
    """Profile Sample Config"""

    profileSample: Optional[Union[float, int]] = None
    profileSampleType: Optional[ProfileSampleType] = ProfileSampleType.PERCENTAGE
    samplingMethodType: Optional[SamplingMethodType] = None
    randomizedSample: Optional[bool] = True
