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
    assert len(parsed_lineage.mappings) == 6
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
    assert len(parsed_lineage.mappings) == 13
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
