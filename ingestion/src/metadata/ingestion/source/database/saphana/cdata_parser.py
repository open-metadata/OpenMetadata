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
Parse CDATA XMLs from SAP Hana
"""
import itertools
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


class CDATAKeys(Enum):
    """Keys to access data in CDATA XML files"""

    COLUMN_OBJECT_NAME = "columnObjectName"
    COLUMN_OBJECT = "columnObject"
    COLUMN_NAME = "columnName"
    SCHEMA_NAME = "schemaName"
    ATTRIBUTES = "attributes"
    ATTRIBUTE = "attribute"
    KEY_MAPPING = "keyMapping"
    MAPPING = "mapping"
    SOURCE = "source"
    TARGET = "target"
    NODE = "node"
    TYPE = "type"
    INPUT = "input"
    CALCULATION_VIEWS = "calculationViews"
    CALCULATION_VIEW = "calculationView"
    CALCULATION_VIEW_ATTRIBUTES = "calculatedViewAttributes"
    CALCULATION_VIEW_ATTRIBUTE = "calculatedViewAttribute"
    RESOURCE_URI = "resourceUri"
    CALCULATED_ATTRS = "calculatedAttributes"
    KEY_CALCULATION = "keyCalculation"
    FORMULA = "formula"
    BASE_MEASURES = "baseMeasures"
    MEASURE = "measure"
    MEASURE_MAPPING = "measureMapping"
    PRIVATE_MEASURE_GROUP = "privateMeasureGroup"
    LOGICAL_MODEL = "logicalModel"
    DATA_SOURCES = "dataSources"
    DATA_SOURCE = "DataSource"  # yes, with capital D
    ID = "id"


class CalculatedAttrKey(Enum):
    CALCULATED_ATTRIBUTE = "calculatedAttribute"
    CALCULATED_VIEW_ATTRIBUTE = "calculatedViewAttribute"


class ParentSource(BaseModel):
    """Parent Source of a given column"""

    # TODO: Multiple sources from the same parent should be possible
    source: Annotated[
        str, Field(..., description="Column name in the parent Data Source")
    ]
    parent: Annotated[str, Field(..., description="Parent ID")]


class DataSourceMapping(BaseModel):
    """Column Mapping of DataSources and Logical Calculated Views"""

    target: Annotated[
        str, Field(..., description="Column name in the provided Data Source")
    ]
    parents: Annotated[
        List[ParentSource], Field(..., description="Parent Sources for a target col")
    ]


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


def _get_column_datasources(
    entry: ET.Element, datasource_map: Optional[DataSourceMap] = None
) -> Set[DataSource]:
    """Read a DataSource from the CDATA XML"""
    if (
        datasource_map
        and entry.get(CDATAKeys.COLUMN_OBJECT_NAME.value) in datasource_map
    ):
        # If the datasource is in the map, we'll traverse all intermediate logical
        # datasources until we arrive to a table or view.
        # Note that we can have multiple sources for a single column, e.g., columns
        # coming from a JOIN
        return set(
            _traverse_ds(
                current_column=entry.get(CDATAKeys.COLUMN_NAME.value),
                ds_origin_list=[],
                current_ds=datasource_map[
                    entry.get(CDATAKeys.COLUMN_OBJECT_NAME.value)
                ],
                datasource_map=datasource_map,
            )
        )

    # If we don't have any logical sources (projections, aggregations, etc.) We'll stick to
    # a single table origin
    return {
        DataSource(
            name=entry.get(CDATAKeys.COLUMN_OBJECT_NAME.value),
            location=entry.get(CDATAKeys.SCHEMA_NAME.value),
            source_type=ViewType.DATA_BASE_TABLE,
        )
    }


def _traverse_ds(
    current_column: str,
    ds_origin_list: List[DataSource],
    current_ds: DataSource,
    datasource_map: Optional[DataSourceMap],
) -> List[DataSource]:
    """
    Traverse the ds dict jumping from target -> source columns and getting the right parent.
    We keep inspecting current datasources and will append to the origin list the ones
    that are not LOGICAL
    """
    if current_ds.source_type != ViewType.LOGICAL:
        ds_origin_list.append(current_ds)

    else:
        # Based on our current column, find the parents from the mappings in the current_ds
        current_ds_mapping: DataSourceMapping = current_ds.mapping.get(current_column)

        if current_ds_mapping:
            for parent in current_ds_mapping.parents:
                parent_ds = datasource_map.get(parent.parent)
                if not parent_ds:
                    raise CDATAParsingError(
                        f"Can't find parent [{parent.parent}] for column [{current_column}]"
                    )

                # Traverse from the source column in the parent mapping
                _traverse_ds(
                    current_column=parent.source,
                    ds_origin_list=ds_origin_list,
                    current_ds=parent_ds,
                    datasource_map=datasource_map,
                )
        else:
            logger.info(
                f"Can't find mapping for column [{current_column}] in [{current_ds}]. "
                f"We still have to implement `calculatedViewAttributes`."
            )

    return ds_origin_list


def _read_attributes(
    tree: ET.Element, ns: dict, datasource_map: Optional[DataSourceMap] = None
) -> ParsedLineage:
    """Compute the lineage based from the attributes"""
    lineage = ParsedLineage()
    attribute_list = tree.find(CDATAKeys.ATTRIBUTES.value, ns) if tree else None
    if not attribute_list:
        return lineage

    for attribute in attribute_list.findall(CDATAKeys.ATTRIBUTE.value, ns):
        key_mapping = attribute.find(CDATAKeys.KEY_MAPPING.value, ns)
        data_sources = _get_column_datasources(
            entry=key_mapping, datasource_map=datasource_map
        )
        attr_lineage = ParsedLineage(
            mappings=[
                ColumnMapping(
                    data_source=ds,
                    sources=[key_mapping.get(CDATAKeys.COLUMN_NAME.value)],
                    target=attribute.get(CDATAKeys.ID.value),
                )
                for ds in data_sources
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

    calculated_attrs = tree.find(CDATAKeys.CALCULATED_ATTRS.value, ns)
    if not calculated_attrs:
        return lineage

    for calculated_attr in calculated_attrs.findall(key.value, ns):
        formula = (
            calculated_attr.find(CDATAKeys.KEY_CALCULATION.value, ns)
            .find(CDATAKeys.FORMULA.value, ns)
            .text
        )
        lineage += _explode_formula(
            target=calculated_attr.get(CDATAKeys.ID.value),
            formula=formula,
            base_lineage=base_lineage,
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

    base_measures = tree.find(CDATAKeys.BASE_MEASURES.value, ns)
    if not base_measures:
        return lineage

    for measure in base_measures.findall(CDATAKeys.MEASURE.value, ns):
        measure_mapping = measure.find(CDATAKeys.MEASURE_MAPPING.value, ns)
        data_sources = _get_column_datasources(
            entry=measure_mapping, datasource_map=datasource_map
        )
        measure_lineage = ParsedLineage(
            mappings=[
                ColumnMapping(
                    data_source=ds,
                    sources=[measure_mapping.get(CDATAKeys.COLUMN_NAME.value)],
                    target=measure.get(CDATAKeys.ID.value),
                )
                for ds in data_sources
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
    measure_group = tree.find(CDATAKeys.PRIVATE_MEASURE_GROUP.value, ns)
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
    """
    # TODO: Handle lineage from calculatedMeasure, restrictedMeasure and sharedDimesions
    ns = NAMESPACE_DICT[ViewType.CALCULATION_VIEW.value]
    tree = ET.fromstring(cdata)

    # Prepare a dictionary of defined data sources
    datasource_map = _parse_cv_data_sources(tree=tree, ns=ns)

    # Iterate over the Logical Model attributes
    logical_model = tree.find(CDATAKeys.LOGICAL_MODEL.value, ns)
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
    for ds in tree.find(CDATAKeys.DATA_SOURCES.value, ns).findall(
        CDATAKeys.DATA_SOURCE.value, ns
    ):
        column_object = ds.find(CDATAKeys.COLUMN_OBJECT.value, ns)
        # we can't rely on the falsy value of the object even if present in the XML
        # If columnObject is informed, we're talking about a table
        if column_object is not None:
            ds_value = DataSource(
                name=column_object.get(CDATAKeys.COLUMN_OBJECT_NAME.value),
                location=column_object.get(CDATAKeys.SCHEMA_NAME.value),
                source_type=ViewType.DATA_BASE_TABLE,
            )
        # or a package object
        else:
            ds_value = DataSource(
                name=ds.get(CDATAKeys.ID.value),
                location=ds.find(CDATAKeys.RESOURCE_URI.value).text,
                source_type=ViewType.__members__[ds.get(CDATAKeys.TYPE.value)],
            )
        datasource_map[ds.get(CDATAKeys.ID.value)] = ds_value

    calculation_views = tree.find(CDATAKeys.CALCULATION_VIEWS.value, ns)
    if calculation_views is None:
        return datasource_map

    for cv in calculation_views.findall(CDATAKeys.CALCULATION_VIEW.value, ns):
        mappings = _build_mappings(calculation_view=cv, ns=ns)
        datasource_map[cv.get(CDATAKeys.ID.value)] = DataSource(
            name=cv.get(CDATAKeys.ID.value),
            location=None,
            mapping={mapping.target: mapping for mapping in mappings},
            source_type=ViewType.LOGICAL,
        )

    return datasource_map


def _build_mappings(calculation_view: ET.Element, ns: dict) -> List[DataSourceMapping]:
    """
    Build the DataSourceMappings from each `input` inside a Calculation View tree.

    Note how we can have:
    ```
    <input emptyUnionBehavior="NO_ROW" node="#Aggregation_1">
        <mapping xsi:type="Calculation:AttributeMapping" target="MANDT" source="MANDT"/>
        ...
    </input>
    <input emptyUnionBehavior="NO_ROW" node="#Projection_1">
        <mapping xsi:type="Calculation:AttributeMapping" target="MANDT" source="MANDT"/>
        ...
    </input>
    ```
    Where a single target column `MANDT` comes from multiple sources. We need to consider
    this when building the `parent` field in DataSourceMapping.

    1. First, create a single list of all the mappings from all the inputs independently
    2. Then, group by `target` and listagg the `parent`s

    TODO: We still need to take care of mappings without source, since those come from
      `calculatedViewAttributes` where we should handle the formula. Check `cdata_calculation_view.xml`
      and take the `USAGE_PCT` as an example.
    """

    input_mappings = _build_input_mappings(calculation_view=calculation_view, ns=ns)
    # calculated_view_attrs = _build_cv_attributes(
    #     calculation_view=calculation_view, ns=ns, input_mappings=input_mappings
    # )

    return input_mappings


def _build_input_mappings(
    calculation_view: ET.Element, ns: dict
) -> List[DataSourceMapping]:
    """Map input nodes"""
    mappings = []
    for input_node in calculation_view.findall(CDATAKeys.INPUT.value, ns):
        for mapping in input_node.findall(CDATAKeys.MAPPING.value, ns):
            if mapping.get(CDATAKeys.SOURCE.value) and mapping.get(
                CDATAKeys.TARGET.value
            ):
                mappings.append(
                    DataSourceMapping(
                        target=mapping.get(CDATAKeys.TARGET.value),
                        parents=[
                            ParentSource(
                                source=mapping.get(CDATAKeys.SOURCE.value),
                                parent=input_node.get(CDATAKeys.NODE.value).replace(
                                    "#", ""
                                ),
                            )
                        ],
                    )
                )

    return _group_mappings(mappings)


def _build_cv_attributes(
    calculation_view: ET.Element, ns: dict, input_mappings: List[DataSourceMapping]
) -> List[DataSourceMapping]:
    """Extract mapping from `calculatedViewAttribute` formulas"""
    mappings = []
    view_attrs = calculation_view.find(CDATAKeys.CALCULATION_VIEW_ATTRIBUTES.value, ns)
    if view_attrs is None:
        return mappings

    for view_attr in view_attrs.findall(CDATAKeys.CALCULATION_VIEW_ATTRIBUTE.value, ns):
        formula = (
            view_attr.find(CDATAKeys.FORMULA.value, ns).text
            if view_attr.find(CDATAKeys.FORMULA.value, ns) is not None
            else None
        )
        if not formula:
            logger.debug(f"Skipping formula without expression at {view_attr}")
            continue

        involved_columns = FORMULA_PATTERN.findall(formula)
        for col in involved_columns:
            # Find the mapping for the involved column
            mapping = next(
                (mapping for mapping in input_mappings if mapping.target == col), None
            )
            if not mapping:
                logger.debug(
                    f"Can't find mapping for column [{col}] in [{input_mappings}]"
                )
                continue

            mappings.append(
                DataSourceMapping(
                    target=view_attr.get(CDATAKeys.ID.value),
                    parents=mapping.parents,
                )
            )

    return _group_mappings(mappings)


def _group_mappings(mappings: List[DataSourceMapping]) -> List[DataSourceMapping]:
    """Group the mappings by target column and listagg the parents"""
    # Sort the data by the target field
    mappings.sort(key=lambda x: x.target)

    # Use groupby to group by the target field
    grouped_data = [
        DataSourceMapping(
            target=target,
            parents=list(itertools.chain.from_iterable(item.parents for item in group)),
        )
        for target, group in itertools.groupby(mappings, key=lambda x: x.target)
    ]

    return grouped_data
