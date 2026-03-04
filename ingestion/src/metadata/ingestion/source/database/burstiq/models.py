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
BurstIQ LifeGraph data models for dictionaries and attributes
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class BurstIQAttribute(BaseModel):
    """Model for BurstIQ dictionary attribute"""

    name: str = Field(..., description="Attribute name")
    description: Optional[str] = Field(None, description="Attribute description")
    datatype: str = Field(..., description="Data type (e.g., INTEGER, STRING, etc.)")
    required: bool = Field(default=False, description="Whether attribute is required")
    defaultValue: Optional[str] = Field(None, description="Default value")
    precision: Optional[int] = Field(None, description="Precision for numeric types")
    min: Optional[int] = Field(None, description="Minimum value")
    max: Optional[int] = Field(None, description="Maximum value")
    regex: Optional[str] = Field(None, description="Validation regex pattern")
    enumValues: List[str] = Field(
        default_factory=list, description="List of enum values"
    )
    fingerprintAttributes: List[str] = Field(
        default_factory=list, description="Fingerprint attributes"
    )
    vectorAttributes: List = Field(
        default_factory=list, description="Vector attributes"
    )
    nodeAttributes: List["BurstIQAttribute"] = Field(
        default_factory=list,
        description="Nested attributes for OBJECT_ARRAY and OBJECT types",
    )
    referenceDictionaryName: Optional[str] = Field(
        None, description="Referenced dictionary name for relationships"
    )


class BurstIQIndex(BaseModel):
    """Model for BurstIQ dictionary index"""

    name: str = Field(..., description="Index name")
    attributes: List[str] = Field(
        default_factory=list, description="List of attribute names in the index"
    )
    type: str = Field(..., description="Index type (e.g., PRIMARY, UNIQUE, etc.)")
    numDimensions: Optional[int] = Field(None, description="Number of dimensions")


class BurstIQDictionary(BaseModel):
    """Model for BurstIQ LifeGraph Dictionary (equivalent to a table)"""

    hash: Optional[str] = Field(None, description="Hash of the dictionary")
    timestamp: Optional[str] = Field(None, description="Last modification timestamp")
    author: Optional[str] = Field(None, description="Author UUID")
    name: str = Field(..., description="Dictionary name (table name)")
    description: Optional[str] = Field(None, description="Dictionary description")
    displayName: Optional[str] = Field(None, description="Display name")
    groupName: Optional[str] = Field(None, description="Group name")
    undefinedAttributesAction: str = Field(
        default="REMOVE",
        description="Action for undefined attributes (KEEP, REMOVE, etc.)",
    )
    attributes: List[BurstIQAttribute] = Field(
        default_factory=list, description="List of attributes (columns)"
    )
    indexes: List[BurstIQIndex] = Field(
        default_factory=list, description="List of indexes"
    )

    @property
    def table_name(self) -> str:
        """Get table name from dictionary name"""
        return self.name

    @property
    def has_primary_key(self) -> bool:
        """Check if dictionary has a primary key"""
        return any(idx.type == "PRIMARY" for idx in self.indexes)

    def get_primary_key_columns(self) -> List[str]:
        """Get list of primary key column names"""
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

    id: Optional[str] = Field(None, description="Edge UUID")
    name: str = Field(..., description="Edge name")
    fromDictionary: str = Field(..., description="Source dictionary name")
    toDictionary: str = Field(..., description="Target dictionary name")
    condition: List[BurstIQEdgeColumn] = Field(
        default_factory=list, description="Column-to-column mappings"
    )
