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
BurstIQ LifeGraph data models for dictionaries, attributes, and API responses
"""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class TokenResponse(BaseModel):
    access_token: str
    expires_in: int = 3600


class ChainMetric(BaseModel):
    assets: int = 0


class SdzMetricsResponse(BaseModel):
    chainMetrics: Dict[str, ChainMetric] = {}


class TQLRecord(BaseModel):
    model_config = ConfigDict(extra="allow")
    data: Optional[Any] = None

    def to_record(self) -> Dict[str, Any]:
        if isinstance(self.data, dict):
            return self.data
        record = dict(self.model_extra or {})
        if self.data is not None:
            record["data"] = self.data
        return record


class BurstIQAttribute(BaseModel):
    """Model for BurstIQ dictionary attribute"""

    name: str = Field(..., description="Attribute name")
    description: Optional[str] = Field(None, description="Attribute description")
    datatype: str = Field(..., description="Data type (e.g., INTEGER, STRING, etc.)")
    required: bool = Field(default=False, description="Whether attribute is required")
    precision: Optional[int] = Field(None, description="Precision for numeric types")
    nodeAttributes: List["BurstIQAttribute"] = Field(
        default_factory=list,
        description="Nested attributes for OBJECT_ARRAY and OBJECT types",
    )
    referenceDictionaryName: Optional[str] = Field(
        None, description="Referenced dictionary name for relationships"
    )


class BurstIQIndex(BaseModel):
    """Model for BurstIQ dictionary index"""

    attributes: List[str] = Field(
        default_factory=list, description="List of attribute names in the index"
    )
    type: str = Field(..., description="Index type (e.g., PRIMARY, UNIQUE, etc.)")


class BurstIQDictionary(BaseModel):
    """Model for BurstIQ LifeGraph Dictionary (equivalent to a table)"""

    name: str = Field(..., description="Dictionary name (table name)")
    description: Optional[str] = Field(None, description="Dictionary description")
    attributes: List[BurstIQAttribute] = Field(
        default_factory=list, description="List of attributes (columns)"
    )
    indexes: List[BurstIQIndex] = Field(
        default_factory=list, description="List of indexes"
    )

    @property
    def table_name(self) -> str:
        return self.name

    @property
    def has_primary_key(self) -> bool:
        return any(idx.type == "PRIMARY" for idx in self.indexes)

    def get_primary_key_columns(self) -> List[str]:
        for idx in self.indexes:
            if idx.type == "PRIMARY":
                return idx.attributes
        return []


class BurstIQEdgeColumn(BaseModel):
    """Model for BurstIQ edge column mapping"""

    fromCol: str = Field(..., description="Source column name")
    toCol: str = Field(..., description="Target column name")


class BurstIQEdge(BaseModel):
    """Model for BurstIQ edge definition (lineage relationship)"""

    name: str = Field(..., description="Edge name")
    fromDictionary: str = Field(..., description="Source dictionary name")
    toDictionary: str = Field(..., description="Target dictionary name")
    condition: List[BurstIQEdgeColumn] = Field(
        default_factory=list, description="Column-to-column mappings"
    )
