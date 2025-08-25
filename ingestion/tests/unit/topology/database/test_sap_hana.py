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
Test SAP Hana source
"""
from pathlib import Path

from metadata.ingestion.source.database.saphana.cdata_parser import (
    ColumnMapping,
    DataSource,
    ParsedLineage,
    ViewType,
    parse_registry,
)

RESOURCES_DIR = Path(__file__).parent.parent.parent / "resources" / "saphana"


def test_parse_analytic_view() -> None:
    """Read the resource and parse the file"""

    with open(RESOURCES_DIR / "cdata_analytic_view.xml") as file:
        cdata = file.read()
        parse_fn = parse_registry.registry.get(ViewType.ANALYTIC_VIEW.value)
        parsed_lineage: ParsedLineage = parse_fn(cdata)

    ds = DataSource(
        name="SBOOK", location="SFLIGHT", source_type=ViewType.DATA_BASE_TABLE
    )

    assert parsed_lineage
    assert len(parsed_lineage.mappings) == 8  # 6 attributes + 2 measures
    assert parsed_lineage.sources == {ds}
    assert parsed_lineage.mappings[0] == ColumnMapping(
        data_source=ds,
        sources=["MANDT"],
        target="MANDT",
    )


def test_parse_attribute_view() -> None:
    """Read the resource and parse the file"""

    with open(RESOURCES_DIR / "cdata_attribute_view.xml") as file:
        cdata = file.read()
        parse_fn = parse_registry.registry.get(ViewType.ATTRIBUTE_VIEW.value)
        parsed_lineage: ParsedLineage = parse_fn(cdata)

    ds = DataSource(
        name="SFLIGHT", location="SFLIGHT", source_type=ViewType.DATA_BASE_TABLE
    )

    assert parsed_lineage
    assert len(parsed_lineage.mappings) == 20  # 15 columns + 5 derived from formulas
    assert parsed_lineage.sources == {
        DataSource(
            name="SCARR", location="SFLIGHT", source_type=ViewType.DATA_BASE_TABLE
        ),
        ds,
    }
    assert parsed_lineage.mappings[0] == ColumnMapping(
        data_source=ds,
        sources=["MANDT"],
        target="MANDT",
    )


def test_parse_cv_tab() -> None:
    """Read the resource and parse the file"""

    with open(RESOURCES_DIR / "cdata_calculation_view_tab.xml") as file:
        cdata = file.read()
        parse_fn = parse_registry.registry.get(ViewType.CALCULATION_VIEW.value)
        parsed_lineage: ParsedLineage = parse_fn(cdata)

    ds = DataSource(
        name="SFLIGHT", location="SFLIGHT", source_type=ViewType.DATA_BASE_TABLE
    )

    assert parsed_lineage
    assert len(parsed_lineage.mappings) == 7  # 4 attributes, 3 measures
    assert parsed_lineage.sources == {ds}
    # Attribute
    assert parsed_lineage.mappings[0] == ColumnMapping(
        data_source=ds,
        sources=["MANDT"],
        target="MANDT",
    )
    # Measure
    assert parsed_lineage.mappings[-1] == ColumnMapping(
        data_source=ds,
        sources=["PAYMENTSUM"],
        target="PAYMENTSUM",
    )


def test_parse_cv_view() -> None:
    """Read the resource and parse the file"""
    with open(RESOURCES_DIR / "cdata_calculation_view_cv.xml") as file:
        cdata = file.read()
        parse_fn = parse_registry.registry.get(ViewType.CALCULATION_VIEW.value)
        parsed_lineage: ParsedLineage = parse_fn(cdata)

    ds = DataSource(
        name="CV_SFLIGHT_SBOOK",
        location="/SFLIGHT.MODELING/calculationviews/CV_SFLIGHT_SBOOK",
        source_type=ViewType.CALCULATION_VIEW,
    )

    assert parsed_lineage
    assert len(parsed_lineage.mappings) == 5  # 4 attributes, 1 measure
    assert parsed_lineage.sources == {ds}
    # Attribute
    assert parsed_lineage.mappings[0] == ColumnMapping(
        data_source=ds,
        sources=["MANDT"],
        target="MANDT",
    )
    # Measure
    assert parsed_lineage.mappings[-1] == ColumnMapping(
        data_source=ds,
        sources=["USAGE_PCT"],
        target="USAGE_PCT",
    )


def test_parse_cv() -> None:
    """Read the resource and parse the file"""
    with open(RESOURCES_DIR / "cdata_calculation_view.xml") as file:
        cdata = file.read()
        parse_fn = parse_registry.registry.get(ViewType.CALCULATION_VIEW.value)
        parsed_lineage: ParsedLineage = parse_fn(cdata)

    ds_sbook = DataSource(
        name="AN_SBOOK",
        location="/SFLIGHT.MODELING/analyticviews/AN_SBOOK",
        source_type=ViewType.ANALYTIC_VIEW,
    )
    ds_sflight = DataSource(
        name="AT_SFLIGHT",
        location="/SFLIGHT.MODELING/attributeviews/AT_SFLIGHT",
        source_type=ViewType.ATTRIBUTE_VIEW,
    )

    assert parsed_lineage
    # Even though we have 9 unique columns, some come from 2 tables, so we have two mappings
    # + 2 for the USAGE_PCT formula (SEATSOCC_ALL and SEATSMAX_ALL)
    assert len(parsed_lineage.mappings) == 15
    assert parsed_lineage.sources == {ds_sbook, ds_sflight}

    # We can validate that MANDT comes from 2 sources
    mandt_mappings = [
        mapping for mapping in parsed_lineage.mappings if mapping.target == "MANDT"
    ]
    assert len(mandt_mappings) == 2
    assert {mapping.data_source for mapping in mandt_mappings} == {ds_sbook, ds_sflight}


def test_schema_mapping_in_datasource():
    """Test that DataSource correctly handles schema mapping for DATA_BASE_TABLE type"""
    from unittest.mock import MagicMock, patch

    # Create a mock engine and connection
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_result = MagicMock()

    # Test case 1: Schema has a mapping
    mock_result.scalar.return_value = "PHYSICAL_SCHEMA_1"
    mock_conn.execute.return_value = mock_result
    mock_engine.connect.return_value.__enter__.return_value = mock_conn

    # Create a DataSource with DATA_BASE_TABLE type
    ds = DataSource(
        name="TEST_TABLE",
        location="AUTHORING_SCHEMA",
        source_type=ViewType.DATA_BASE_TABLE,
    )

    # Mock the metadata and service
    mock_metadata = MagicMock()
    mock_metadata.get_by_name.return_value = MagicMock()

    with patch(
        "metadata.ingestion.source.database.saphana.cdata_parser._get_mapped_schema"
    ) as mock_get_mapped:
        mock_get_mapped.return_value = "PHYSICAL_SCHEMA_1"

        # Call get_entity which should use the mapped schema
        ds.get_entity(
            metadata=mock_metadata, engine=mock_engine, service_name="test_service"
        )

        # Verify _get_mapped_schema was called with the correct parameters
        mock_get_mapped.assert_called_once_with(
            engine=mock_engine, schema_name="AUTHORING_SCHEMA"
        )

    # Test case 2: Schema has no mapping (returns original)
    mock_result.scalar.return_value = None

    with patch(
        "metadata.ingestion.source.database.saphana.cdata_parser._get_mapped_schema"
    ) as mock_get_mapped:
        mock_get_mapped.return_value = (
            "AUTHORING_SCHEMA"  # Returns original when no mapping
        )

        ds.get_entity(
            metadata=mock_metadata, engine=mock_engine, service_name="test_service"
        )

        mock_get_mapped.assert_called_once()


def test_parsed_lineage_with_schema_mapping():
    """Test that ParsedLineage.to_request passes engine parameter correctly"""
    from unittest.mock import MagicMock, patch

    # Create a simple parsed lineage
    ds = DataSource(
        name="TEST_TABLE",
        location="TEST_SCHEMA",
        source_type=ViewType.DATA_BASE_TABLE,
    )

    mapping = ColumnMapping(
        data_source=ds,
        sources=["COL1"],
        target="TARGET_COL",
    )

    parsed_lineage = ParsedLineage(mappings=[mapping], sources={ds})

    # Mock dependencies
    mock_metadata = MagicMock()
    mock_engine = MagicMock()
    mock_to_entity = MagicMock()

    # Mock the to_entity to return a table
    mock_table = MagicMock()
    mock_table.fullyQualifiedName.root = "test.schema.table"
    mock_to_entity.return_value = mock_table

    with patch(
        "metadata.ingestion.source.database.saphana.cdata_parser.DataSource.get_entity",
        mock_to_entity,
    ):
        # Call to_request which should pass engine to get_entity
        list(
            parsed_lineage.to_request(
                metadata=mock_metadata,
                engine=mock_engine,
                service_name="test_service",
                to_entity=mock_table,
            )
        )

        # Verify get_entity was called with engine parameter
        mock_to_entity.assert_called_with(
            metadata=mock_metadata, engine=mock_engine, service_name="test_service"
        )


def test_join_view_duplicate_column_mapping() -> None:
    """Test that Join views correctly handle duplicate column mappings by keeping the first occurrence"""
    with open(
        RESOURCES_DIR / "custom" / "cdata_calculation_view_star_join.xml"
    ) as file:
        cdata = file.read()
        parse_fn = parse_registry.registry.get(ViewType.CALCULATION_VIEW.value)
        parsed_lineage: ParsedLineage = parse_fn(cdata)

    ds_orders = DataSource(
        name="CV_ORDERS",
        location="/my-package/calculationviews/CV_ORDERS",
        source_type=ViewType.CALCULATION_VIEW,
    )
    ds_aggregated = DataSource(
        name="CV_AGGREGATED_ORDERS",
        location="/my-package/calculationviews/CV_AGGREGATED_ORDERS",
        source_type=ViewType.CALCULATION_VIEW,
    )

    assert parsed_lineage
    assert parsed_lineage.sources == {ds_orders, ds_aggregated}

    # Verify that when Join views have duplicate mappings (ORDER_ID mapped twice),
    # we keep the first mapping and ignore the duplicate
    # ORDER_ID_1 comes from first input (Projection_2 -> CV_AGGREGATED_ORDERS)
    order_id_1_mappings = [
        mapping for mapping in parsed_lineage.mappings if mapping.target == "ORDER_ID_1"
    ]
    assert len(order_id_1_mappings) == 1
    assert order_id_1_mappings[0].data_source == ds_aggregated
    assert order_id_1_mappings[0].sources == ["ORDER_ID"]

    # ORDER_ID_1_1 comes from second input (Projection_1 -> CV_ORDERS)
    order_id_1_1_mappings = [
        mapping
        for mapping in parsed_lineage.mappings
        if mapping.target == "ORDER_ID_1_1"
    ]
    assert len(order_id_1_1_mappings) == 1
    assert order_id_1_1_mappings[0].data_source == ds_orders
    assert order_id_1_1_mappings[0].sources == ["ORDER_ID"]

    # Verify renamed columns maintain correct source mapping
    quantity_1_mappings = [
        mapping for mapping in parsed_lineage.mappings if mapping.target == "QUANTITY_1"
    ]
    assert len(quantity_1_mappings) == 1
    assert quantity_1_mappings[0].data_source == ds_aggregated
    assert quantity_1_mappings[0].sources == ["QUANTITY"]

    # QUANTITY_1_1 maps to CV_ORDERS.QUANTITY (renamed in Join)
    quantity_1_1_mappings = [
        mapping
        for mapping in parsed_lineage.mappings
        if mapping.target == "QUANTITY_1_1"
    ]
    assert len(quantity_1_1_mappings) == 1
    assert quantity_1_1_mappings[0].data_source == ds_orders
    assert quantity_1_1_mappings[0].sources == ["QUANTITY"]


def test_union_view_with_multiple_projections() -> None:
    """Test parsing of calculation view with Union combining multiple Projection sources"""
    with open(
        RESOURCES_DIR / "custom" / "cdata_calculation_view_star_join_complex.xml"
    ) as file:
        cdata = file.read()
        parse_fn = parse_registry.registry.get(ViewType.CALCULATION_VIEW.value)
        parsed_lineage: ParsedLineage = parse_fn(cdata)

    ds_orders = DataSource(
        name="CV_ORDERS",
        location="/my-package/calculationviews/CV_ORDERS",
        source_type=ViewType.CALCULATION_VIEW,
    )
    ds_aggregated = DataSource(
        name="CV_AGGREGATED_ORDERS",
        location="/my-package/calculationviews/CV_AGGREGATED_ORDERS",
        source_type=ViewType.CALCULATION_VIEW,
    )
    ds_sales = DataSource(
        name="CV_DEV_SALES",
        location="/my-package/calculationviews/CV_DEV_SALES",
        source_type=ViewType.CALCULATION_VIEW,
    )

    assert parsed_lineage
    assert parsed_lineage.sources == {ds_orders, ds_aggregated, ds_sales}

    # Verify Union view correctly combines sources from multiple projections
    # AMOUNT comes from CV_DEV_SALES through Projection_3
    amount_mappings = [
        mapping for mapping in parsed_lineage.mappings if mapping.target == "AMOUNT"
    ]
    assert len(amount_mappings) == 1
    assert amount_mappings[0].data_source == ds_sales
    assert amount_mappings[0].sources == ["AMOUNT"]

    # Test column name resolution through Union and Join layers
    # PRICE_1 maps to Join_1.PRICE which traces back through Union_1 to CV_ORDERS
    price_1_mappings = [
        mapping for mapping in parsed_lineage.mappings if mapping.target == "PRICE_1"
    ]
    assert len(price_1_mappings) == 1
    assert price_1_mappings[0].data_source == ds_orders
    assert price_1_mappings[0].sources == ["PRICE"]

    # PRICE_1_1 maps to Join_1.PRICE_1 which comes from Projection_2 (CV_AGGREGATED_ORDERS)
    price_1_1_mappings = [
        mapping for mapping in parsed_lineage.mappings if mapping.target == "PRICE_1_1"
    ]
    assert len(price_1_1_mappings) == 1
    assert price_1_1_mappings[0].data_source == ds_aggregated
    assert price_1_1_mappings[0].sources == ["PRICE"]


def test_analytic_view_formula_column_source_mapping() -> None:
    """Test that formula columns correctly map to their source table columns"""
    with open(
        RESOURCES_DIR / "custom" / "cdata_analytic_view_formula_column.xml"
    ) as file:
        cdata = file.read()
        parse_fn = parse_registry.registry.get(ViewType.ANALYTIC_VIEW.value)
        parsed_lineage: ParsedLineage = parse_fn(cdata)

    ds_orders = DataSource(
        name="ORDERS",
        location="SOURCE_SCHEMA",
        source_type=ViewType.DATA_BASE_TABLE,
    )
    ds_customer = DataSource(
        name="CUSTOMER_DATA",
        location="SOURCE_SCHEMA",
        source_type=ViewType.DATA_BASE_TABLE,
    )

    assert parsed_lineage
    assert parsed_lineage.sources == {ds_orders, ds_customer}

    # Test that base columns from ORDERS table are mapped correctly
    orders_columns = ["ORDER_ID", "CUSTOMER_ID", "ORDER_DATE", "PRICE", "QUANTITY"]
    for col_name in orders_columns:
        col_mappings = [
            mapping for mapping in parsed_lineage.mappings if mapping.target == col_name
        ]
        assert len(col_mappings) == 1
        assert col_mappings[0].data_source == ds_orders
        assert col_mappings[0].sources == [col_name]

    # Test that columns from CUSTOMER_DATA table are mapped correctly
    customer_columns = ["CUSTOMER_ID_1", "NAME", "EMAIL", "IS_ACTIVE", "SIGNUP_DATE"]
    for col_name in customer_columns:
        col_mappings = [
            mapping for mapping in parsed_lineage.mappings if mapping.target == col_name
        ]
        assert len(col_mappings) == 1
        assert col_mappings[0].data_source == ds_customer
        # CUSTOMER_ID_1 maps from CUSTOMER_ID in CUSTOMER_DATA table
        expected_source = "CUSTOMER_ID" if col_name == "CUSTOMER_ID_1" else col_name
        assert col_mappings[0].sources == [expected_source]


def test_formula_columns_reference_correct_layer():
    """Test that formula columns reference the correct calculation view layer"""
    import xml.etree.ElementTree as ET

    from metadata.ingestion.source.database.saphana.cdata_parser import (
        _parse_cv_data_sources,
    )

    # Load the complex star join view XML
    with open(
        RESOURCES_DIR / "custom" / "cdata_calculation_view_star_join_complex.xml"
    ) as file:
        xml = file.read()

    ns = {
        "Calculation": "http://www.sap.com/ndb/BiModelCalculation.ecore",
        "xsi": "http://www.w3.org/2001/XMLSchema-instance",
    }

    tree = ET.fromstring(xml)
    datasource_map = _parse_cv_data_sources(tree=tree, ns=ns)

    # Test Join_1 calculated attributes
    join_1 = datasource_map.get("Join_1")
    assert join_1 is not None
    assert join_1.mapping is not None

    # TOTAL_JOIN_1 should reference PRICE and QUANTITY from Join_1 itself
    total_join_1 = join_1.mapping.get("TOTAL_JOIN_1")
    assert total_join_1 is not None
    assert len(total_join_1.parents) == 2

    # Check that both source columns come from Join_1
    for parent in total_join_1.parents:
        assert parent.parent == "Join_1"

    # Check the specific columns
    source_columns = {parent.source for parent in total_join_1.parents}
    assert source_columns == {"PRICE", "QUANTITY"}

    # TOTAL2_JOIN_1 should reference AMOUNT and PRODUCT from Join_1
    total2_join_1 = join_1.mapping.get("TOTAL2_JOIN_1")
    assert total2_join_1 is not None
    assert len(total2_join_1.parents) == 2

    for parent in total2_join_1.parents:
        assert parent.parent == "Join_1"

    source_columns = {parent.source for parent in total2_join_1.parents}
    assert source_columns == {"AMOUNT", "PRODUCT"}


def test_projection_formula_columns():
    """Test that projection view formula columns reference the correct layer"""
    import xml.etree.ElementTree as ET

    from metadata.ingestion.source.database.saphana.cdata_parser import (
        _parse_cv_data_sources,
    )

    with open(
        RESOURCES_DIR / "custom" / "cdata_calculation_view_star_join_complex.xml"
    ) as file:
        xml = file.read()

    ns = {
        "Calculation": "http://www.sap.com/ndb/BiModelCalculation.ecore",
        "xsi": "http://www.w3.org/2001/XMLSchema-instance",
    }

    tree = ET.fromstring(xml)
    datasource_map = _parse_cv_data_sources(tree=tree, ns=ns)

    # Test Projection_1 calculated attributes
    proj_1 = datasource_map.get("Projection_1")
    assert proj_1 is not None
    assert proj_1.mapping is not None

    total_proj_1 = proj_1.mapping.get("TOTAL_PROJ_1")
    assert total_proj_1 is not None
    assert len(total_proj_1.parents) == 2

    for parent in total_proj_1.parents:
        assert parent.parent == "Projection_1"

    source_columns = {parent.source for parent in total_proj_1.parents}
    assert source_columns == {"PRICE", "QUANTITY"}

    # Test Projection_3 with string concatenation formula
    proj_3 = datasource_map.get("Projection_3")
    assert proj_3 is not None
    assert proj_3.mapping is not None

    total_proj_3 = proj_3.mapping.get("TOTAL_PROJ_3")
    assert total_proj_3 is not None
    assert len(total_proj_3.parents) == 2

    for parent in total_proj_3.parents:
        assert parent.parent == "Projection_3"

    source_columns = {parent.source for parent in total_proj_3.parents}
    assert source_columns == {"AMOUNT", "PRODUCT"}


def test_formula_columns_in_final_lineage():
    """Test that formula columns are correctly resolved in the final lineage"""
    with open(
        RESOURCES_DIR / "custom" / "cdata_calculation_view_star_join_complex.xml"
    ) as file:
        cdata = file.read()
        parse_fn = parse_registry.registry.get(ViewType.CALCULATION_VIEW.value)
        parsed = parse_fn(cdata)

    # Test that formulas from multiple layers are preserved
    formula_tests = [
        ("TOTAL_JOIN_1", '"PRICE" * "QUANTITY"'),
        ("TOTAL2_JOIN_1", 'string("AMOUNT") + \' , \' + "PRODUCT"'),
        ("TOTAL_PROJ_1", '"PRICE" *  "QUANTITY"'),  # Note: extra space in original
        ("TOTAL_PROJ_2", '"PRICE" * "QUANTITY"'),
        (
            "TOTAL_PROJ_3",
            'string("AMOUNT") + \' , \' +  "PRODUCT"',
        ),  # Note: extra space
    ]

    for col_name, expected_formula in formula_tests:
        mappings = [m for m in parsed.mappings if m.target == col_name]
        assert len(mappings) > 0, f"{col_name} not found in star join mappings"

        # Verify formula is preserved through all layers
        has_formula = any(m.formula == expected_formula for m in mappings)
        assert has_formula, (
            f"Formula for {col_name} not preserved in star join. "
            f"Expected: {expected_formula}, Got: {[m.formula for m in mappings]}"
        )


def test_formula_parsing_comprehensive():
    """Comprehensive test for formula parsing covering all critical scenarios"""

    # Scenario 1: Logical model formulas (the original issue reported)
    logical_model_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Calculation:scenario xmlns:Calculation="http://www.sap.com/ndb/BiModelCalculation.ecore" 
    schemaVersion="2.3" id="CV_BASIC" calculationScenarioType="TREE_BASED">
  <dataSources>
    <DataSource id="CV_BASE" type="CALCULATION_VIEW">
      <resourceUri>/my-package/calculationviews/CV_BASE</resourceUri>
    </DataSource>
  </dataSources>
  <calculationViews/>
  <logicalModel id="CV_BASE">
    <calculatedAttributes>
      <calculatedAttribute id="CALCULATED_PRICE">
        <keyCalculation datatype="DOUBLE">
          <formula>&quot;PRICE&quot;</formula>
        </keyCalculation>
      </calculatedAttribute>
    </calculatedAttributes>
    <baseMeasures>
      <measure id="PRICE" aggregationType="sum">
        <measureMapping columnObjectName="CV_BASE" columnName="PRICE"/>
      </measure>
      <measure id="QUANTITY" aggregationType="sum">
        <measureMapping columnObjectName="CV_BASE" columnName="QUANTITY"/>
      </measure>
    </baseMeasures>
    <calculatedMeasures>
      <measure id="TOTAL" aggregationType="sum">
        <formula>&quot;QUANTITY&quot; * &quot;PRICE&quot;</formula>
      </measure>
    </calculatedMeasures>
  </logicalModel>
</Calculation:scenario>"""

    parse_fn = parse_registry.registry.get(ViewType.CALCULATION_VIEW.value)
    parsed = parse_fn(logical_model_xml)

    # Test logical model calculated attribute
    calc_price = next(
        (m for m in parsed.mappings if m.target == "CALCULATED_PRICE"), None
    )
    assert (
        calc_price and calc_price.formula == '"PRICE"'
    ), "Logical model calculated attribute formula missing"

    # Test logical model calculated measure
    total = next((m for m in parsed.mappings if m.target == "TOTAL"), None)
    assert (
        total and total.formula == '"QUANTITY" * "PRICE"'
    ), "Logical model calculated measure formula missing"

    # Scenario 2: Nested calculation view formulas (the deeper layer issue we found)
    nested_view_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Calculation:scenario xmlns:Calculation="http://www.sap.com/ndb/BiModelCalculation.ecore"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    schemaVersion="2.3" id="TEST_CV" calculationScenarioType="TREE_BASED">
  <dataSources>
    <DataSource id="TEST_TABLE" type="DATA_BASE_TABLE">
      <columnObject columnObjectName="TEST_TABLE" schemaName="TEST_SCHEMA"/>
    </DataSource>
  </dataSources>
  <calculationViews>
    <calculationView xsi:type="Calculation:ProjectionView" id="Projection_1">
      <viewAttributes>
        <viewAttribute id="PRICE"/>
        <viewAttribute id="QUANTITY"/>
      </viewAttributes>
      <calculatedViewAttributes>
        <calculatedViewAttribute id="PROJ_TOTAL" datatype="DECIMAL">
          <formula>&quot;PRICE&quot; * &quot;QUANTITY&quot;</formula>
        </calculatedViewAttribute>
      </calculatedViewAttributes>
      <input node="#TEST_TABLE">
        <mapping xsi:type="Calculation:AttributeMapping" target="PRICE" source="PRICE"/>
        <mapping xsi:type="Calculation:AttributeMapping" target="QUANTITY" source="QUANTITY"/>
      </input>
    </calculationView>
  </calculationViews>
  <logicalModel id="Projection_1">
    <attributes>
      <attribute id="PROJ_TOTAL">
        <keyMapping columnObjectName="Projection_1" columnName="PROJ_TOTAL"/>
      </attribute>
    </attributes>
  </logicalModel>
</Calculation:scenario>"""

    parsed = parse_fn(nested_view_xml)

    # Critical test: Formula from calculation view must propagate through logical model
    proj_total = [m for m in parsed.mappings if m.target == "PROJ_TOTAL"]
    assert len(proj_total) > 0, "PROJ_TOTAL not found in mappings"
    assert any(
        m.formula == '"PRICE" * "QUANTITY"' for m in proj_total
    ), f"Nested calculation view formula not propagated. Got: {[(m.formula, m.sources) for m in proj_total]}"

    # Scenario 3: Multiple formula types and edge cases
    edge_cases_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Calculation:scenario xmlns:Calculation="http://www.sap.com/ndb/BiModelCalculation.ecore"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    schemaVersion="2.3" id="TEST_CV" calculationScenarioType="TREE_BASED">
  <dataSources>
    <DataSource id="TEST_TABLE" type="DATA_BASE_TABLE">
      <columnObject columnObjectName="TEST_TABLE" schemaName="TEST_SCHEMA"/>
    </DataSource>
  </dataSources>
  <calculationViews/>
  <logicalModel id="TEST_TABLE">
    <calculatedAttributes>
      <calculatedAttribute id="CONSTANT_ATTR">
        <keyCalculation datatype="INTEGER">
          <formula>1234</formula>
        </keyCalculation>
      </calculatedAttribute>
      <calculatedAttribute id="STRING_FORMULA">
        <keyCalculation datatype="NVARCHAR">
          <formula>string(&quot;PRICE&quot;) + ' USD'</formula>
        </keyCalculation>
      </calculatedAttribute>
    </calculatedAttributes>
    <baseMeasures>
      <measure id="PRICE" aggregationType="sum">
        <measureMapping columnObjectName="TEST_TABLE" columnName="PRICE"/>
      </measure>
    </baseMeasures>
    <calculatedMeasures>
      <measure id="COMPLEX_CALC" aggregationType="sum">
        <formula>&quot;PRICE&quot; * 1.1 + 10</formula>
      </measure>
    </calculatedMeasures>
  </logicalModel>
</Calculation:scenario>"""

    parsed = parse_fn(edge_cases_xml)

    # Test constant formulas don't create mappings
    targets = {m.target for m in parsed.mappings}
    assert "CONSTANT_ATTR" not in targets, "Constant formula should not create mapping"

    # Test string formulas work
    string_formula = next(
        (m for m in parsed.mappings if m.target == "STRING_FORMULA"), None
    )
    assert (
        string_formula and "string(" in string_formula.formula
    ), "String formula not preserved"

    # Test complex formulas with constants
    complex_calc = next(
        (m for m in parsed.mappings if m.target == "COMPLEX_CALC"), None
    )
    assert (
        complex_calc and complex_calc.formula == '"PRICE" * 1.1 + 10'
    ), "Complex formula not preserved"
