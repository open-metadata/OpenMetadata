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
import traceback
import xml.etree.ElementTree as ET
from collections import defaultdict
from enum import Enum
from functools import lru_cache
from typing import Dict, Iterable, List, Optional, Set

from pydantic import Field, computed_field
from typing_extensions import Annotated

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
    Source,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.saphana.models import (
    SYS_BIC_SCHEMA_NAME,
    ViewType,
)
from metadata.utils import fqn
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP
from metadata.utils.dispatch import enum_register
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class CDATAParsingError(Exception):
    """Error parsing CDATA XML"""


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
    },
}

FORMULA_PATTERN = re.compile(r"\"(.*?)\"")


class CalculatedAttrKey(Enum):
    CALCULATED_ATTRIBUTE = "calculatedAttribute"
    CALCULATED_VIEW_ATTRIBUTE = "calculatedViewAttribute"


class DataSource(BaseModel):
    """Data source from CDATA XML"""

    name: Annotated[str, Field(..., description="Data Source name")]
    location: Annotated[
        Optional[str], Field(None, description="Schema or project for the Data Source")
    ]
    source_type: Annotated[
        Optional[ViewType],
        Field(None, description="Data Source type. If not informed, source is a table"),
    ]

    def get_entity(
        self,
        metadata: OpenMetadata,
        service_name: str,
    ) -> Table:
        """Build the Entity Reference for this DataSource"""

        if not self.source_type:  # The source is a table, so the location is the schema
            fqn_ = fqn.build(
                metadata=metadata,
                entity_type=Table,
                service_name=service_name,
                database_name=None,  # TODO: Can we assume HXE?
                schema_name=self.location,
                table_name=self.name,
            )
        else:
            # package from <resourceUri>/SFLIGHT.MODELING/calculationviews/CV_SFLIGHT_SBOOK</resourceUri>
            package = self.location.split("/")[1]
            fqn_ = fqn.build(
                metadata=metadata,
                entity_type=Table,
                service_name=service_name,
                database_name=None,
                schema_name=SYS_BIC_SCHEMA_NAME,
                table_name=f"{package}/{self.name}",
            )

        return metadata.get_by_name(entity=Table, fqn=fqn_)

    def __hash__(self):
        return hash(self.location) + hash(self.name) + hash(self.source_type)


class ColumnMapping(BaseModel):
    """Column Mapping from CDATA XML"""

    data_source: Annotated[DataSource, Field(..., description="Source table name")]
    sources: Annotated[List[str], Field(..., description="Source column names")]
    target: Annotated[str, Field(..., description="Destination column name")]
    formula: Annotated[
        Optional[str], Field(None, description="Formula used to derive the column")
    ]


class ParsedLineage(BaseModel):
    """Parsed Lineage from CDATA XML. For each view, we'll parse the sources"""

    mappings: Annotated[
        Optional[List[ColumnMapping]], Field([], description="Column mappings")
    ]

    @computed_field
    @property
    def sources(self) -> Set[DataSource]:
        """Get all the different source tables we'll need to iterate over"""
        return {mapping.data_source for mapping in self.mappings}

    @lru_cache(maxsize=256)
    def find_target(self, column: str) -> Optional[ColumnMapping]:
        """Find the column mapping based on the target column"""
        return next(
            (mapping for mapping in self.mappings if mapping.target == column), None
        )

    def __add__(self, other: "ParsedLineage") -> "ParsedLineage":
        """Merge two parsed lineages"""
        return ParsedLineage(mappings=self.mappings + other.mappings)

    def __hash__(self):
        """
        Note that the LRU Cache require us to implement the __hash__ method, otherwise
        the BaseModel is not hashable. Since we just want a per-instance cache, we'll use the id
        """
        return id(self)

    def to_request(
        self, metadata: OpenMetadata, service_name: str, to_entity: Table
    ) -> Iterable[Either[AddLineageRequest]]:
        """Given the target entity, build the AddLineageRequest based on the sources in `self`"""
        for source in self.sources:
            try:
                source_table = source.get_entity(
                    metadata=metadata, service_name=service_name
                )
                if not source_table:
                    logger.warning(f"Can't find table for source [{source}]")
                    continue
                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=source_table.id,
                                type=ENTITY_REFERENCE_TYPE_MAP[Table.__name__],
                            ),
                            toEntity=EntityReference(
                                id=to_entity.id,
                                type=ENTITY_REFERENCE_TYPE_MAP[Table.__name__],
                            ),
                            lineageDetails=LineageDetails(
                                source=Source.ViewLineage,
                                columnsLineage=[
                                    ColumnLineage(
                                        fromColumns=[
                                            FullyQualifiedEntityName(
                                                get_column_fqn(
                                                    table_entity=source_table,
                                                    column=source_col,
                                                )
                                            )
                                            for source_col in mapping.sources
                                        ],
                                        toColumn=FullyQualifiedEntityName(
                                            get_column_fqn(
                                                table_entity=to_entity,
                                                column=mapping.target,
                                            )
                                        ),
                                        function=mapping.formula
                                        if mapping.formula
                                        else None,
                                    )
                                    for mapping in self.mappings
                                    if mapping.data_source == source
                                ],
                            ),
                        )
                    )
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=to_entity.fullyQualifiedName.root,
                        error=f"Error trying to get lineage for [{source}] due to [{exc}]",
                        stackTrace=traceback.format_exc(),
                    )
                )


def _read_ds(
    entry: ET.Element, cdata_sources: Optional[Dict[str, DataSource]] = None
) -> DataSource:
    """Read a DataSource from the CDATA XML"""
    if cdata_sources and entry.get("columnObjectName") in cdata_sources:
        return cdata_sources[entry.get("columnObjectName")]

    return DataSource(
        name=entry.get("columnObjectName"),
        location=entry.get("schemaName"),
    )


def _read_attributes(
    tree: ET.Element, ns: dict, cdata_sources: Optional[Dict[str, DataSource]] = None
) -> ParsedLineage:
    """Compute the lineage based from the attributes"""
    lineage = ParsedLineage()
    attribute_list = tree.find("attributes", ns) if tree else None
    if not attribute_list:
        return lineage

    for attribute in attribute_list.findall("attribute", ns):
        key_mapping = attribute.find("keyMapping", ns)
        data_source = _read_ds(entry=key_mapping, cdata_sources=cdata_sources)
        attr_lineage = ParsedLineage(
            mappings=[
                ColumnMapping(
                    data_source=data_source,
                    sources=[key_mapping.get("columnName")],
                    target=attribute.get("id"),
                )
            ]
        )
        lineage += attr_lineage

    return lineage


def _read_calculated_attributes(
    tree: ET.Element,
    ns: dict,
    base_lineage: ParsedLineage,
    key: CalculatedAttrKey = CalculatedAttrKey.CALCULATED_ATTRIBUTE,
) -> ParsedLineage:
    """Compute the lineage based on the calculated attributes"""
    lineage = ParsedLineage()

    calculated_attrs = tree.find("calculatedAttributes", ns)
    if not calculated_attrs:
        return lineage

    for calculated_attr in calculated_attrs.findall(key.value, ns):
        formula = calculated_attr.find("keyCalculation", ns).find("formula", ns).text
        lineage += _explode_formula(
            target=calculated_attr.get("id"), formula=formula, base_lineage=base_lineage
        )

    return lineage


def _read_base_measures(
    tree: ET.Element, ns: dict, cdata_sources: Optional[Dict[str, DataSource]] = None
) -> ParsedLineage:
    """
    Compute the lineage based on the base measures.
    For CalculationViews, we have a dictionary of pre-defined DataSources. For the rest,
    we'll default to Table DataSources with the given information in the measure.

    See examples cdata_calculation_view.xml and cdata_attribute_view.xml in test resources.
    """
    lineage = ParsedLineage()

    base_measures = tree.find("baseMeasures", ns)
    if not base_measures:
        return lineage

    for measure in base_measures.findall("measure", ns):
        measure_mapping = measure.find("measureMapping", ns)
        data_source = _read_ds(entry=measure_mapping, cdata_sources=cdata_sources)
        measure_lineage = ParsedLineage(
            mappings=[
                ColumnMapping(
                    data_source=data_source,
                    sources=[measure_mapping.get("columnName")],
                    target=measure.get("id"),
                )
            ]
        )
        lineage += measure_lineage

    return lineage


def _explode_formula(
    target: str, formula: str, base_lineage: ParsedLineage
) -> ParsedLineage:
    """
    Explode the formula and extract the columns
    Args:
        formula: formula to extract involved columns from
        base_lineage: parsed lineage of the main attributes. We'll use this to pick up the original lineage columns
    Returns:
        Parsed Lineage from the formula
    """
    column_ds = {
        match.group(1): base_lineage.find_target(match.group(1)).data_source
        for match in FORMULA_PATTERN.finditer(formula)
    }

    # Group every datasource (key) with a list of the involved columns (values)
    ds_columns = defaultdict(list)
    for column, ds in column_ds.items():
        ds_columns[ds].append(column)

    return ParsedLineage(
        mappings=[
            ColumnMapping(
                # We get the source once we find the mapping of the target
                data_source=data_source,
                sources=columns,
                target=target,
                formula=formula,
            )
            for data_source, columns in ds_columns.items()
        ]
    )


parse_registry = enum_register()


@parse_registry.add(ViewType.ANALYTIC_VIEW.value)
def _(cdata: str) -> ParsedLineage:
    """Parse the CDATA XML for Analytics View"""
    ns = NAMESPACE_DICT[ViewType.ANALYTIC_VIEW.value]
    tree = ET.fromstring(cdata)
    measure_group = tree.find("privateMeasureGroup", ns)
    # TODO: Handle lineage from calculatedMeasures, restrictedMeasures and sharedDimensions
    return _read_attributes(measure_group, ns)


@parse_registry.add(ViewType.ATTRIBUTE_VIEW.value)
def _(cdata: str) -> ParsedLineage:
    """Parse the CDATA XML for Analytics View"""
    ns = NAMESPACE_DICT[ViewType.ATTRIBUTE_VIEW.value]
    tree = ET.fromstring(cdata)
    attribute_lineage = _read_attributes(tree=tree, ns=ns)
    calculated_attrs_lineage = _read_calculated_attributes(
        tree=tree, ns=ns, base_lineage=attribute_lineage
    )
    base_measure_lineage = _read_base_measures(tree=tree, ns=ns, cdata_sources=None)

    return attribute_lineage + calculated_attrs_lineage + base_measure_lineage


@parse_registry.add(ViewType.CALCULATION_VIEW.value)
def _(cdata: str) -> ParsedLineage:
    """Parse the CDATA XML for Calculation View"""
    # TODO: Handle lineage from calculatedMeasure, restrictedMeasure and sharedDimesions
    ns = NAMESPACE_DICT[ViewType.CALCULATION_VIEW.value]
    tree = ET.fromstring(cdata)

    # Prepare a dictionary of defined data sources
    cdata_sources = {}
    for ds in tree.find("dataSources", ns).findall("DataSource", ns):
        column_object = ds.find("columnObject", ns)
        # this is a table
        if (
            column_object is not None
        ):  # we can't rely on the falsy value of the object even if present in the XML
            ds_value = DataSource(
                name=column_object.get("columnObjectName"),
                location=column_object.get("schemaName"),
            )
        # or a package object
        else:
            ds_value = DataSource(
                name=ds.get("id"),
                location=ds.find("resourceUri").text,
                source_type=ViewType.__members__[ds.get("type")],
            )
        cdata_sources[ds.get("id")] = ds_value

    # Iterate over the Logical Model attributes
    logical_model = tree.find("logicalModel", ns)
    attribute_lineage = _read_attributes(
        tree=logical_model, ns=ns, cdata_sources=cdata_sources
    )
    calculated_attrs_lineage = _read_calculated_attributes(
        tree=tree,
        ns=ns,
        base_lineage=attribute_lineage,
        key=CalculatedAttrKey.CALCULATED_VIEW_ATTRIBUTE,
    )
    base_measure_lineage = _read_base_measures(
        tree=logical_model, ns=ns, cdata_sources=cdata_sources
    )

    return attribute_lineage + calculated_attrs_lineage + base_measure_lineage
