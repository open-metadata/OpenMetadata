#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Parse CDATA XMLs from SAP Hana
"""
from enum import Enum
from typing import List
import xml.etree.ElementTree as ET

from pydantic import Field
from typing_extensions import Annotated

from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.utils.dispatch import enum_register


class ViewType(Enum):
    """Supported SAP Hana Views"""
    CALCULATION_VIEW = "calculationview"
    ANALYTIC_VIEW = "analyticview"
    ATTRIBUTE_VIEW = "attributeview"


XSI_NS = {"xsi": "http://www.w3.org/2001/XMLSchema-instance"}

NAMESPACE_DICT = {
    ViewType.ANALYTIC_VIEW.value: {
        "Cube": "http://www.sap.com/ndb/BiModelCube.ecore",
        **XSI_NS,
    },
    ViewType.CALCULATION_VIEW.value: {
        "Calculation": "http://www.sap.com/ndb/BiModelCalculation.ecore",
        **XSI_NS,
    },
    ViewType.ATTRIBUTE_VIEW.value: {
        "Dimension": "http://www.sap.com/ndb/BiModelDimension.ecore",
        **XSI_NS,
    }
}


class ColumnMapping(BaseModel):
    """Column Mapping from CDATA XML"""
    source: Annotated[str, Field(..., description="Source column name")]
    destination: Annotated[str, Field(..., description="Destination column name")]


class ParsedLineage(BaseModel):
    """Parsed Lineage from CDATA XML"""
    source: Annotated[str, Field(..., description="Source table or view name")]
    target: Annotated[str, Field(..., description="Target table or view name")]
    mappings: Annotated[List[ColumnMapping], Field(None, description="Column mappings")]


parse_registry = enum_register()


@parse_registry.add(ViewType.ANALYTIC_VIEW.value)
def _(cdata: str) -> List[ParsedLineage]:
    """Parse the CDATA XML for Analytics View"""
    tree = ET.fromstring(cdata)
    attributes = tree.find("privateMeasureGroup", NAMESPACE_DICT[ViewType.ANALYTIC_VIEW.value])

