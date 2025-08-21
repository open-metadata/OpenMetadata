#  Copyright 2022 Collate
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
Test Tableau connector with CLI - Enhanced with comprehensive lineage and metadata testing
"""
from pathlib import Path
from typing import List

import pytest

from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.ingestion.api.status import Status

from .base.test_cli import PATH_TO_RESOURCES
from .common.test_cli_dashboard import CliCommonDashboard


class TableauExpectedValues:
    """
    Centralized expected values for Tableau testing based on actual test data
    """

    # Basic counts - Updated based on actual test knowledge base
    DASHBOARDS_AND_CHARTS = 5  # 1 dashboard + 4 charts = 5
    LINEAGE_EDGES = 9
    TAGS = 2
    DATAMODEL_LINEAGE = 0
    DATAMODELS = 2
    FILTERED_MIX = 2
    FILTERED_SINK_MIX = 2
    DASHBOARDS_AND_CHARTS_AFTER_PATCH = 5
    SERVICE_NAME = "local_tableau"

    # Expected entity names
    EXPECTED_DASHBOARD_NAMES = ["Analytics Workbook"]

    EXPECTED_CHART_NAMES = [
        "Product Measure Sheet",
        "Sales Story",
        "Product vs Category Dashboard",
        "Category Measure Sheet",
    ]

    EXPECTED_DATAMODEL_NAMES = [
        "Sales Summary"  # Appears in both TableauEmbeddedDatasource and TableauPublishedDatasource
    ]

    # Expected data model columns/fields
    EXPECTED_DATAMODEL_FIELDS = [
        "state",
        "category_name",
        "order_date",
        "product_id",
        "customer_id",
        "line_total",
        "region",
        "product_name",
        "customer_name",
        "Sales Summary (Custom SQL)",
        "price_at_purchase",
        "order_id",
        "quantity",
    ]

    # Expected tags
    EXPECTED_TAGS = ["Analytics", "workbook"]

    # Expected chart type
    EXPECTED_CHART_TYPE = "ChartType.Other"

    # Expected field type
    EXPECTED_FIELD_TYPE = "tableau field"

    # Expected data model types
    EXPECTED_DATAMODEL_TYPES = [
        "DataModelType.TableauEmbeddedDatasource",
        "DataModelType.TableauPublishedDatasource",
    ]

    # Expected SQL for data models
    EXPECTED_DATAMODEL_SQL = """SELECT
        o.order_id,
        o.order_date,
        c.customer_id,
        c.first_name || ' ' || c.last_name AS customer_name,
        c.state,
        c.region,
        p.product_id,
        p.product_name,
        cat.category_name,
        oi.quantity,
        oi.price_at_purchase,
        (oi.quantity * oi.price_at_purchase) AS line_total
    FROM
        sales.orders AS o
    JOIN
        sales.customers AS c ON o.customer_id = c.customer_id
    JOIN
        sales.order_items AS oi ON o.order_id = oi.order_id
    JOIN
        inventory.products AS p ON oi.product_id = p.product_id
    JOIN
        inventory.categories AS cat ON p.category_id = cat.category_id"""

    # Lineage expectations: Tables -> TableauPublishedDatasource -> TableauEmbeddedDatasource -> Dashboard
    EXPECTED_SOURCE_TABLES = [
        "categories",
        "customers",
        "order_items",
        "orders",
        "products",
    ]

    # Filter patterns
    INCLUDE_DASHBOARDS = [".*Analytics.*"]
    EXCLUDE_DASHBOARDS = ["Sample.*"]
    INCLUDE_CHARTS = [".*Sheet.*", ".*Product.*", ".*Sales.*"]
    EXCLUDE_CHARTS = ["Obesity"]
    INCLUDE_DATAMODELS = [".*Sales.*", ".*Summary.*"]
    EXCLUDE_DATAMODELS = ["Random.*"]


class TableauCliTest(CliCommonDashboard.TestSuite):
    """
    Enhanced Tableau CLI Test Suite with comprehensive lineage and metadata validation
    """

    def prepare(self) -> None:
        """Prepare test environment by setting up required database service"""
        redshift_file_path = str(
            Path(
                PATH_TO_RESOURCES
                + f"/dashboard/{self.get_connector_name()}/redshift.yaml"
            )
        )
        self.run_command(test_file_path=redshift_file_path)

    @staticmethod
    def get_connector_name() -> str:
        return "tableau"

    # ================================
    # FILTER CONFIGURATION METHODS
    # ================================

    def get_includes_dashboards(self) -> List[str]:
        return TableauExpectedValues.INCLUDE_DASHBOARDS

    def get_excludes_dashboards(self) -> List[str]:
        return TableauExpectedValues.EXCLUDE_DASHBOARDS

    def get_includes_charts(self) -> List[str]:
        return TableauExpectedValues.INCLUDE_CHARTS

    def get_excludes_charts(self) -> List[str]:
        return TableauExpectedValues.EXCLUDE_CHARTS

    def get_includes_datamodels(self) -> List[str]:
        return TableauExpectedValues.INCLUDE_DATAMODELS

    def get_excludes_datamodels(self) -> List[str]:
        return TableauExpectedValues.EXCLUDE_DATAMODELS

    # ================================
    # EXPECTED COUNT METHODS
    # ================================

    def expected_dashboards_and_charts(self) -> int:
        return TableauExpectedValues.DASHBOARDS_AND_CHARTS

    def expected_lineage(self) -> int:
        return TableauExpectedValues.LINEAGE_EDGES

    def expected_tags(self) -> int:
        return TableauExpectedValues.TAGS

    def expected_datamodel_lineage(self) -> int:
        return TableauExpectedValues.DATAMODEL_LINEAGE

    def expected_datamodels(self) -> int:
        return TableauExpectedValues.DATAMODELS

    def expected_filtered_mix(self) -> int:
        return TableauExpectedValues.FILTERED_MIX

    def expected_filtered_sink_mix(self) -> int:
        return TableauExpectedValues.FILTERED_SINK_MIX

    def expected_dashboards_and_charts_after_patch(self) -> int:
        return TableauExpectedValues.DASHBOARDS_AND_CHARTS_AFTER_PATCH

    # ================================
    # ENHANCED TEST METHODS
    # ================================

    @pytest.mark.order(10)
    def test_metadata_ingestion_validation(self) -> None:
        """Test comprehensive metadata ingestion validation - runs after base ingestion"""
        # Validate dashboards
        self._validate_dashboard_metadata()

        # Validate charts
        self._validate_chart_metadata()

        # Validate data models
        self._validate_datamodel_metadata()

        # Validate tags
        self._validate_tags_metadata()

    @pytest.mark.order(12)
    def test_lineage_validation(self) -> None:
        """Test comprehensive lineage validation - Enable actual lineage testing"""
        # Remove the pytest.skip and implement actual lineage validation
        self._validate_dashboard_lineage()
        self._validate_datamodel_lineage_chain()

    @pytest.mark.order(13)
    def test_datamodel_content_validation(self) -> None:
        """Test data model content and structure validation"""
        self._validate_datamodel_fields()
        self._validate_datamodel_sql()
        self._validate_datamodel_types()

    @pytest.mark.order(14)
    def test_tags_and_metadata_quality(self) -> None:
        """Test tags and metadata quality"""
        self._validate_tag_assignment()
        self._validate_chart_types()
        self._validate_field_types()

    def _validate_dashboard_metadata(self) -> None:
        """Validate dashboard metadata completeness"""
        dashboards = self.openmetadata.list_entities(
            entity=Dashboard, params={"service": TableauExpectedValues.SERVICE_NAME}
        ).entities

        self.assertGreaterEqual(
            len(dashboards), len(TableauExpectedValues.EXPECTED_DASHBOARD_NAMES)
        )

        dashboard_names = [dashboard.displayName for dashboard in dashboards]
        for expected_name in TableauExpectedValues.EXPECTED_DASHBOARD_NAMES:
            self.assertIn(
                expected_name,
                dashboard_names,
                f"Expected dashboard '{expected_name}' not found in ingested dashboards",
            )

        # Validate specific dashboard metadata
        analytics_dashboard = self.get_entity_by_name(Dashboard, "Analytics Workbook")
        if analytics_dashboard:
            self.assertIsNotNone(analytics_dashboard.fullyQualifiedName)
            self.assertIsNotNone(analytics_dashboard.service)
            # Validate that charts are properly linked
            if hasattr(analytics_dashboard, "charts") and analytics_dashboard.charts:
                self.assertEqual(
                    len(analytics_dashboard.charts.root),
                    4,
                    "Analytics Workbook should have 4 charts",
                )

    def _validate_chart_metadata(self) -> None:
        """Validate chart metadata completeness"""
        charts = self.openmetadata.list_entities(
            entity=Chart, params={"service": TableauExpectedValues.SERVICE_NAME}
        ).entities

        self.assertGreaterEqual(
            len(charts), len(TableauExpectedValues.EXPECTED_CHART_NAMES)
        )

        chart_names = [chart.displayName for chart in charts]
        for expected_name in TableauExpectedValues.EXPECTED_CHART_NAMES:
            self.assertIn(
                expected_name,
                chart_names,
                f"Expected chart '{expected_name}' not found in ingested charts",
            )

    def _validate_datamodel_metadata(self) -> None:
        """Validate data model metadata completeness"""
        datamodels = self.openmetadata.list_entities(
            entity=DashboardDataModel,
            params={"service": TableauExpectedValues.SERVICE_NAME},
        ).entities

        # Should have at least one "Sales Summary" data model
        datamodel_names = [dm.displayName for dm in datamodels]
        self.assertIn(
            "Sales Summary", datamodel_names, "Sales Summary data model not found"
        )

        # Validate data model types
        datamodel_types = []
        for dm in datamodels:
            if hasattr(dm, "dataModelType") and dm.dataModelType:
                datamodel_types.append(str(dm.dataModelType))

        for expected_type in TableauExpectedValues.EXPECTED_DATAMODEL_TYPES:
            self.assertIn(
                expected_type,
                datamodel_types,
                f"Expected data model type '{expected_type}' not found",
            )

    def _validate_tags_metadata(self) -> None:
        """Validate tags metadata"""
        # Get all entities and check for expected tags
        all_entities = []
        all_entities.extend(
            self.openmetadata.list_entities(
                entity=Dashboard,
                params={"service": TableauExpectedValues.SERVICE_NAME},
                fields=["tags"],
            ).entities
        )
        all_entities.extend(
            self.openmetadata.list_entities(
                entity=Chart,
                params={"service": TableauExpectedValues.SERVICE_NAME},
                fields=["tags"],
            ).entities
        )

        found_tags = set()
        for entity in all_entities:
            if hasattr(entity, "tags") and entity.tags:
                for tag in entity.tags:
                    if hasattr(tag, "name"):
                        # Extract tag name from FQN
                        found_tags.add(str(tag.name))

        for expected_tag in TableauExpectedValues.EXPECTED_TAGS:
            self.assertIn(
                expected_tag,
                found_tags,
                f"Expected tag '{expected_tag}' not found in any entity",
            )

    def _validate_dashboard_lineage(self) -> None:
        """Validate dashboard lineage according to the knowledge base"""
        # Lineage chain: Tables -> TableauPublishedDatasource -> TableauEmbeddedDatasource -> Dashboard
        analytics_dashboard = self.get_entity_by_name(Dashboard, "Analytics Workbook")
        if analytics_dashboard:
            lineage = self.openmetadata.get_lineage_by_name(
                entity=Dashboard,
                fqn=analytics_dashboard.fullyQualifiedName.root,
                up_depth=5,  # Increased depth to capture full lineage chain
                down_depth=1,
            )

            if lineage and lineage.get("upstreamEdges"):
                self.assertGreater(
                    len(lineage["upstreamEdges"]),
                    6,
                    "Analytics Workbook should have upstream lineage",
                )

    def _validate_datamodel_lineage_chain(self) -> None:
        """Validate the complete lineage chain"""
        # Get Sales Summary data models
        datamodels = self.openmetadata.list_entities(
            entity=DashboardDataModel,
            params={"service": TableauExpectedValues.SERVICE_NAME},
        ).entities

        sales_summary_models = [
            dm for dm in datamodels if dm.displayName == "Sales Summary"
        ]
        for datamodel in sales_summary_models:
            lineage = self.openmetadata.get_lineage_by_name(
                entity=DashboardDataModel,
                fqn=datamodel.fullyQualifiedName.root,
                up_depth=3,
                down_depth=3,
            )

            if lineage and lineage.get("upstreamEdges"):
                # Check for upstream connections (should connect to tables)
                for edge in lineage["upstreamEdges"]:
                    if lineage_query := edge["lineageDetails"].get("sqlQuery"):
                        self.assertEqual(
                            " ".join(lineage_query.split()),
                            " ".join(
                                TableauExpectedValues.EXPECTED_DATAMODEL_SQL.split()
                            ),
                            "Lineage SQL query does't match expected SQL query",
                        )

    def _validate_datamodel_fields(self) -> None:
        """Validate data model fields/columns"""
        datamodels = self.openmetadata.list_entities(
            entity=DashboardDataModel,
            params={"service": TableauExpectedValues.SERVICE_NAME},
        ).entities

        sales_summary_models = [
            dm for dm in datamodels if dm.name.root == "Sales Summary"
        ]

        for datamodel in sales_summary_models:
            if hasattr(datamodel, "columns") and datamodel.columns:
                column_names = [col.name.root for col in datamodel.columns]

                # Check for expected fields
                found_fields = 0
                for expected_field in TableauExpectedValues.EXPECTED_DATAMODEL_FIELDS:
                    if expected_field in column_names:
                        found_fields += 1

                self.assertGreater(
                    found_fields,
                    5,  # Should find at least 5 expected fields
                    f"Data model {datamodel.name.root} should contain expected fields",
                )

    def _validate_datamodel_sql(self) -> None:
        """Validate data model SQL content"""
        datamodels = self.openmetadata.list_entities(
            entity=DashboardDataModel,
            params={"service": TableauExpectedValues.SERVICE_NAME},
        ).entities

        sales_summary_models = [
            dm for dm in datamodels if dm.name.root == "Sales Summary"
        ]

        for datamodel in sales_summary_models:
            if hasattr(datamodel, "sql") and datamodel.sql:
                sql_content = (
                    datamodel.sql.root
                    if hasattr(datamodel.sql, "root")
                    else str(datamodel.sql)
                )

                # Check for key SQL elements
                self.assertIn(
                    "SELECT", sql_content.upper(), "SQL should contain SELECT statement"
                )
                self.assertIn(
                    "JOIN", sql_content.upper(), "SQL should contain JOIN statements"
                )

                # Check for expected table references
                for table in TableauExpectedValues.EXPECTED_SOURCE_TABLES:
                    self.assertIn(
                        table,
                        sql_content.lower(),
                        f"SQL should reference table '{table}'",
                    )

    def _validate_datamodel_types(self) -> None:
        """Validate data model types"""
        datamodels = self.openmetadata.list_entities(
            entity=DashboardDataModel,
            params={"service": TableauExpectedValues.SERVICE_NAME},
        ).entities

        found_types = set()
        for datamodel in datamodels:
            if hasattr(datamodel, "dataModelType") and datamodel.dataModelType:
                found_types.add(str(datamodel.dataModelType))

        for expected_type in TableauExpectedValues.EXPECTED_DATAMODEL_TYPES:
            self.assertIn(
                expected_type,
                found_types,
                f"Expected data model type '{expected_type}' not found",
            )

    def _validate_tag_assignment(self) -> None:
        """Validate tag assignment to entities"""
        # Check Analytics Workbook dashboard
        analytics_dashboard = self.get_entity_by_name(Dashboard, "Analytics Workbook")
        if (
            analytics_dashboard
            and hasattr(analytics_dashboard, "tags")
            and analytics_dashboard.tags
        ):
            dashboard_tags = {str(tag.name) for tag in analytics_dashboard.tags}
            for expected_tag in TableauExpectedValues.EXPECTED_TAGS:
                self.assertIn(
                    expected_tag,
                    dashboard_tags,
                    f"Dashboard should have tag '{expected_tag}'",
                )

        # Check charts
        for chart_name in TableauExpectedValues.EXPECTED_CHART_NAMES:
            chart = self.get_entity_by_name(Chart, chart_name, fields=None)
            if chart and hasattr(chart, "tags") and chart.tags:
                chart_tags = {str(tag.name) for tag in chart.tags}
                for expected_tag in TableauExpectedValues.EXPECTED_TAGS:
                    self.assertIn(
                        expected_tag,
                        chart_tags,
                        f"Chart '{chart_name}' should have tag '{expected_tag}'",
                    )

    def _validate_chart_types(self) -> None:
        """Validate chart types"""
        charts = self.openmetadata.list_entities(
            entity=Chart, params={"service": TableauExpectedValues.SERVICE_NAME}
        ).entities

        for chart in charts:
            if hasattr(chart, "chartType") and chart.chartType:
                self.assertEqual(
                    str(chart.chartType),
                    TableauExpectedValues.EXPECTED_CHART_TYPE,
                    f"Chart '{chart.name.root}' should have type '{TableauExpectedValues.EXPECTED_CHART_TYPE}'",
                )

    def _validate_field_types(self) -> None:
        """Validate field types in data models"""
        datamodels = self.openmetadata.list_entities(
            entity=DashboardDataModel,
            params={"service": TableauExpectedValues.SERVICE_NAME},
        ).entities

        for datamodel in datamodels:
            if hasattr(datamodel, "columns") and datamodel.columns:
                for column in datamodel.columns:
                    if hasattr(column, "dataType") and column.dataType:
                        # Check if field type matches expected
                        field_type = str(column.dataType)
                        self.assertIn(
                            "DataType.RECORD",
                            field_type,
                            f"Field '{column.name.root}' should have tableau-related type",
                        )

    @pytest.mark.order(11)
    def test_lineage(self) -> None:
        """Enable lineage testing - Remove the skip"""
        self._validate_dashboard_lineage()
        self._validate_datamodel_lineage_chain()

    def assert_not_including(self, source_status: Status, sink_status: Status):
        """
        Override base method for Tableau-specific behavior.
        """
        self.assertTrue(len(source_status.failures) == 0)
        self.assertTrue(len(source_status.warnings) == 0)
        self.assertTrue(len(source_status.filtered) >= 5)

        # We can have a diff of 1 element if we are counting the service, which is only marked as ingested in the
        # first go
        self.assertTrue(
            self.expected_dashboards_and_charts()
            <= (len(source_status.records) + len(source_status.updated_records))
        )
        self.assertTrue(len(sink_status.failures) == 0)
        self.assertTrue(len(sink_status.warnings) == 0)
        self.assertTrue(
            self.expected_dashboards_and_charts()
            <= (len(sink_status.records) + len(sink_status.updated_records))
        )

    def assert_for_vanilla_ingestion(
        self, source_status: Status, sink_status: Status
    ) -> None:
        self.assertTrue(len(source_status.failures) == 0)
        self.assertTrue(len(source_status.warnings) == 0)
        self.assertTrue(len(source_status.filtered) >= 5)
        self.assertGreaterEqual(
            (len(source_status.records) + len(source_status.updated_records)),  # 20-22
            self.expected_dashboards_and_charts_after_patch()
            + self.expected_tags()
            + self.expected_lineage()
            + self.expected_datamodel_lineage(),
        )
        self.assertTrue(len(sink_status.failures) == 0)
        self.assertTrue(len(sink_status.warnings) == 0)
        self.assertGreaterEqual(
            (len(sink_status.records) + len(sink_status.updated_records)),
            self.expected_dashboards_and_charts_after_patch()
            + self.expected_tags()
            + self.expected_datamodels(),
        )

    def get_entity_by_name(
        self,
        entity_type,
        name: str,
        service: str = TableauExpectedValues.SERVICE_NAME,
        fields: List = ["tags", "charts"],
    ):
        """Helper to get entity by name or displayName"""
        entities = self.openmetadata.list_entities(
            entity=entity_type, params={"service": service}, fields=fields
        ).entities

        for entity in entities:
            # Check both name and displayName for matches
            entity_name = (
                entity.name.root if hasattr(entity.name, "root") else str(entity.name)
            )
            entity_display_name = (
                entity.displayName.root
                if hasattr(entity, "displayName")
                and entity.displayName
                and hasattr(entity.displayName, "root")
                else (
                    str(entity.displayName)
                    if hasattr(entity, "displayName") and entity.displayName
                    else None
                )
            )

            if entity_name == name or entity_display_name == name:
                return entity
        return None

    def validate_entity_exists(
        self, entity_type, name: str, service: str = TableauExpectedValues.SERVICE_NAME
    ):
        """Helper to validate entity exists"""
        entity = self.get_entity_by_name(entity_type, name, service)
        self.assertIsNotNone(
            entity, f"{entity_type.__name__} '{name}' not found in service '{service}'"
        )
        return entity
