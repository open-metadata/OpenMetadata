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
from typing import Dict, Iterable, List, NewType, Optional, Set

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


class DataSourceMapping(BaseModel):
    """Column Mapping of DataSources and Logical Calculated Views"""

    source: Annotated[
        str, Field(..., description="Column name in the parent Data Source")
    ]
    target: Annotated[
        str, Field(..., description="Column name in the provided Data Source")
    ]
    parent: Annotated[str, Field(..., description="Parent Data Source ID")]


class DataSource(BaseModel):
    """Data source from CDATA XML"""

    name: Annotated[str, Field(..., description="Data Source name")]
    location: Annotated[
        Optional[str], Field(None, description="Schema or project for the Data Source")
    ]
    source_type: Annotated[
        Optional[ViewType],
        Field(..., description="Data Source type"),
    ]
    mapping: Annotated[
        Optional[Dict[str, DataSourceMapping]],
        Field(
            None,
            description="Logical source column mapping. Key: source column; value: mapping",
        ),
    ]

    def get_entity(
        self,
        metadata: OpenMetadata,
        service_name: str,
    ) -> Table:
        """Build the Entity Reference for this DataSource"""

        if self.source_type == ViewType.LOGICAL:
            raise CDATAParsingError(
                f"We could not find the logical DataSource origin for {self.name}"
            )

        if self.source_type == ViewType.DATA_BASE_TABLE:
            # The source is a table, so the location is the schema
            fqn_ = fqn.build(
                metadata=metadata,
                entity_type=Table,
                service_name=service_name,
                database_name=None,  # TODO: Can we assume HXE?
                schema_name=self.location,
                table_name=self.name,
            )
        else:
            # The source is a CalculationView, AttributeView or AnalyticView
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


# Given the DataSource ID, get the DataSource from the CDATA XML
DataSourceMap = NewType("DataSourceMap", Dict[str, DataSource])


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
    entry: ET.Element, datasource_map: Optional[DataSourceMap] = None
) -> DataSource:
    """Read a DataSource from the CDATA XML"""
    if datasource_map and entry.get("columnObjectName") in datasource_map:
        return _traverse_ds(
            current_column=entry.get("columnName"),
            current_ds=datasource_map[entry.get("columnObjectName")],
            datasource_map=datasource_map,
        )

    return DataSource(
        name=entry.get("columnObjectName"),
        location=entry.get("schemaName"),
        source_type=ViewType.DATA_BASE_TABLE,
    )


def _traverse_ds(
    current_column: str, current_ds: DataSource, datasource_map: Optional[DataSourceMap]
) -> DataSource:
    """Traverse the ds dict jumping from target -> source columns and getting the right parent"""
    # If we reach a non-logical source, return it
    if current_ds.source_type != ViewType.LOGICAL:
        return current_ds

    # Based on our current column, find the parent from the mappings in the current_ds
    current_ds_mapping = current_ds.mapping.get(current_column)
    if not current_ds_mapping:
        raise CDATAParsingError(
            f"Can't find column [{current_column}] in DataSource [{current_ds}]"
        )

    parent_ds = datasource_map.get(current_ds_mapping.parent)
    if not parent_ds:
        raise CDATAParsingError(
            f"Can't find parent DataSource for parent [{current_ds_mapping.parent}]"
        )

    # Traverse from the source column in the parent mapping
    return _traverse_ds(
        current_column=current_ds_mapping.source,
        current_ds=parent_ds,
        datasource_map=datasource_map,
    )


def _read_attributes(
    tree: ET.Element, ns: dict, datasource_map: Optional[DataSourceMap] = None
) -> ParsedLineage:
    """Compute the lineage based from the attributes"""
    lineage = ParsedLineage()
    attribute_list = tree.find("attributes", ns) if tree else None
    if not attribute_list:
        return lineage

    for attribute in attribute_list.findall("attribute", ns):
        key_mapping = attribute.find("keyMapping", ns)
        data_source = _read_ds(entry=key_mapping, datasource_map=datasource_map)
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
    tree: ET.Element, ns: dict, datasource_map: Optional[DataSourceMap] = None
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
        data_source = _read_ds(entry=measure_mapping, datasource_map=datasource_map)
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
    base_measure_lineage = _read_base_measures(tree=tree, ns=ns, datasource_map=None)

    return attribute_lineage + calculated_attrs_lineage + base_measure_lineage


@parse_registry.add(ViewType.CALCULATION_VIEW.value)
def _(cdata: str) -> ParsedLineage:
    """
    Parse the CDATA XML for Calculation View

    We can think of the DataSources in a CV as:
    - "real" sources: they are tables or other views that are used in the calculation
    - "logical" sources: as internal projections, aggregations, etc.

    The behavior is:
    - The LogicalModel attributes can be linked - transitively - to either a "real" or a "logical" source.
    - The "logical" sources are defined inside each `calculationView`
    - Each `calculationView` can have an `input` node that can either be "real" or "logical"
    - We can identify "real" inputs as their `<input node="#<ID>">` will match the <DataSource id="ID" type="...">

    When building the dataSources here we need to ensure we iterate over the calculationViews, and during
    the _read_ds we'll iteratively traverse the dataSources to find the actual table.

    Internally, we'll identify "logical" dataSources by giving them a list of column mappings, which we'll
    use to identify the actual source.

    TODO: We'll need to figure out how to manage the formula lineage within calculatedViewAttributes
      most likely improving the ParsedLineage.find_target method to take into account the DataSource hierarchy
    """
    # TODO: Handle lineage from calculatedMeasure, restrictedMeasure and sharedDimesions
    ns = NAMESPACE_DICT[ViewType.CALCULATION_VIEW.value]
    tree = ET.fromstring(cdata)

    # Prepare a dictionary of defined data sources
    datasource_map = _parse_cv_data_sources(tree=tree, ns=ns)

    # Iterate over the Logical Model attributes
    logical_model = tree.find("logicalModel", ns)
    attribute_lineage = _read_attributes(
        tree=logical_model, ns=ns, datasource_map=datasource_map
    )
    calculated_attrs_lineage = _read_calculated_attributes(
        tree=tree,
        ns=ns,
        base_lineage=attribute_lineage,
        key=CalculatedAttrKey.CALCULATED_VIEW_ATTRIBUTE,
    )
    base_measure_lineage = _read_base_measures(
        tree=logical_model, ns=ns, datasource_map=datasource_map
    )

    return attribute_lineage + calculated_attrs_lineage + base_measure_lineage


def _parse_cv_data_sources(tree: ET.Element, ns: dict) -> DataSourceMap:
    """
    Parse the real and logical data sources of a CV

    The logical (`calculationViews`) have the following shape:
    ```
    <calculationViews>
    <calculationView xsi:type="Calculation:AggregationView" id="Aggregation_1">
      <descriptions/>
      <viewAttributes>
        <viewAttribute id="MANDT"/>
        ...
      </viewAttributes>
      <calculatedViewAttributes>
        <calculatedViewAttribute datatype="INTEGER" id="USAGE_PCT" expressionLanguage="COLUMN_ENGINE">
          <formula>&quot;SEATSOCC_ALL&quot;/&quot;SEATSMAX_ALL&quot;</formula>
        </calculatedViewAttribute>
        ...
      </calculatedViewAttributes>
      <input node="#AT_SFLIGHT">
        <mapping xsi:type="Calculation:AttributeMapping" target="MANDT" source="MANDT"/>
        ...
      </input>
      <input emptyUnionBehavior="NO_ROW" node="#Projection_1">
        <mapping xsi:type="Calculation:ConstantAttributeMapping" target="CARRNAME" null="true" value=""/>
        ...
      </input>
      ...
    </calculationView>
    ...
    </calculationViews>
    ```
    """
    datasource_map = DataSourceMap({})
    for ds in tree.find("dataSources", ns).findall("DataSource", ns):
        column_object = ds.find("columnObject", ns)
        # we can't rely on the falsy value of the object even if present in the XML
        # If columnObject is informed, we're talking about a table
        if column_object is not None:
            ds_value = DataSource(
                name=column_object.get("columnObjectName"),
                location=column_object.get("schemaName"),
                source_type=ViewType.DATA_BASE_TABLE,
            )
        # or a package object
        else:
            ds_value = DataSource(
                name=ds.get("id"),
                location=ds.find("resourceUri").text,
                source_type=ViewType.__members__[ds.get("type")],
            )
        datasource_map[ds.get("id")] = ds_value

    calculation_views = tree.find("calculationViews", ns)
    if calculation_views is None:
        return datasource_map

    for cv in calculation_views.findall("calculationView", ns):
        mappings = []
        for input_node in cv.findall("input", ns):
            for mapping in input_node.findall("mapping", ns):
                if mapping.get("source"):
                    mappings.append(
                        DataSourceMapping(
                            source=mapping.get("source"),
                            target=mapping.get("target"),
                            parent=input_node.get("node").replace("#", ""),
                        )
                    )
        datasource_map[cv.get("id")] = DataSource(
            name=cv.get("id"),
            location=None,
            mapping={mapping.source: mapping for mapping in mappings},
            source_type=ViewType.LOGICAL,
        )

    return datasource_map
