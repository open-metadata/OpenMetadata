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
import re
from enum import Enum
from functools import lru_cache
from typing import List, Set, Optional
import xml.etree.ElementTree as ET

from pydantic import Field, computed_field
from typing_extensions import Annotated

from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.utils.dispatch import enum_register


class CDATAParsingError(Exception):
    """Error parsing CDATA XML"""


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

FORMULA_PATTERN = re.compile(r"\"(.*?)\"")


class ColumnMapping(BaseModel):
    """Column Mapping from CDATA XML"""
    source_table: Annotated[str, Field(..., description="Source table name")]
    source: Annotated[str, Field(..., description="Source column name")]
    target: Annotated[str, Field(..., description="Destination column name")]
    formula: Annotated[Optional[str], Field(None, description="Formula used to derive the column")]


class ParsedLineage(BaseModel):
    """Parsed Lineage from CDATA XML. For each view, we'll parse the sources"""
    mappings: Annotated[Optional[List[ColumnMapping]], Field([], description="Column mappings")]

    @computed_field
    @property
    def sources(self) -> Set[str]:
        """Get all the different source tables we'll need to iterate over"""
        return {mapping.source_table for mapping in self.mappings}

    @lru_cache(maxsize=256)
    def find_target(self, column: str) -> Optional[ColumnMapping]:
        """Find the column mapping based on the target column"""
        return next(
            (mapping for mapping in self.mappings if mapping.target == column), None
        )

    def __add__(self, other: "ParsedLineage") -> "ParsedLineage":
        """Merge two parsed lineages"""
        return ParsedLineage(mappings=self.mappings + other.mappings)


def _read_attributes(tree: ET.Element, ns: dict) -> ParsedLineage:
    """Compute the lineage based from the attributes"""
    attribute_list = tree.find("attributes", ns) if tree else None
    if not attribute_list:
        raise CDATAParsingError(f"Error extracting attributes from tree {tree}")

    attributes = attribute_list.findall("attribute", ns)
    return ParsedLineage(
        mappings=[
            ColumnMapping(
                source_table=attribute.find("keyMapping", ns).get("columnObjectName"),
                source=attribute.find("keyMapping", ns).get("columnName"),
                target=attribute.get("id")
            ) for attribute in attributes
        ]
    )


def _read_calculated_attributes(tree: ET.Element, ns: dict, base_lineage: ParsedLineage) -> ParsedLineage:
    """Compute the lineage based on the calculated attributes"""
    lineage = ParsedLineage()

    calculated_attrs = tree.find("calculatedAttributes", ns)
    if not calculated_attrs:
        return lineage

    for calculated_attr in calculated_attrs.findall("calculatedAttribute", ns):
        formula = calculated_attr.find("keyCalculation", ns).find("formula", ns).text
        lineage += _explode_formula(formula, base_lineage)

    return lineage


def _explode_formula(formula: str, base_lineage: ParsedLineage) -> ParsedLineage:
    """
    Explode the formula and extract the columns
    Args:
        formula: formula to extract involved columns from
        base_lineage: parsed lineage of the main attributes. We'll use this to pick up the original lineage columns
    Returns:
        Parsed Lineage from the formula
    """
    return ParsedLineage(
        mappings=[
            ColumnMapping(
                # We get the source once we find the mapping of the target
                source_table=base_lineage.find_target(match.group(1)).source_table,
                source=base_lineage.find_target(match.group(1)).source,
                target=match.group(1),
                formula=formula,
            ) for match in FORMULA_PATTERN.finditer(formula)
        ]
    )


parse_registry = enum_register()


@parse_registry.add(ViewType.ANALYTIC_VIEW.value)
def _(cdata: str) -> ParsedLineage:
    """Parse the CDATA XML for Analytics View"""
    ns = NAMESPACE_DICT[ViewType.ANALYTIC_VIEW.value]
    tree = ET.fromstring(cdata)
    measure_group = tree.find("privateMeasureGroup", ns)
    # TODO: Handle lineage from baseMeasures, calculatedMeasures, restrictedMeasures and sharedDimensions
    return _read_attributes(measure_group, ns)


@parse_registry.add(ViewType.ATTRIBUTE_VIEW.value)
def _(cdata: str) -> ParsedLineage:
    """Parse the CDATA XML for Analytics View"""
    ns = NAMESPACE_DICT[ViewType.ATTRIBUTE_VIEW.value]
    tree = ET.fromstring(cdata)
    attribute_lineage = _read_attributes(tree=tree, ns=ns)
    calculated_attrs_lineage = _read_calculated_attributes(tree=tree, ns=ns, base_lineage=attribute_lineage)

    return attribute_lineage + calculated_attrs_lineage
