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
Test Salesforce Data 360 database source using the topology
"""

from unittest.mock import patch

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.entity.data.table import DataType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.data360.constant import (
    Constant,
    MetadataTypesConstant,
    ResponseConstant,
)
from metadata.ingestion.source.database.data360.metadata import Data360Source

MOCK_DATA360_CONFIG = {
    "source": {
        "type": "data360",
        "serviceName": "local_data360",
        "serviceConnection": {
            "config": {
                "type": "Data360",
                "consumerKey": "consumer_key",
                "consumerSecret": "consumer_secret",
                "salesforceDomain": "login",
                "salesforceApiVersion": "63.0",
                "paginationLimit": 50,
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "data360"},
        }
    },
}

MOCK_DATASPACES = [
    {
        ResponseConstant.NAME: "customer_360",
        ResponseConstant.LABEL: "Customer 360",
        ResponseConstant.DESCRIPTION: "Customer dataspace",
        ResponseConstant.STATUS: "Active",
    },
    {
        ResponseConstant.NAME: "marketing",
        ResponseConstant.LABEL: "Marketing",
        ResponseConstant.DESCRIPTION: "Marketing dataspace",
        ResponseConstant.STATUS: "Active",
    },
]

MOCK_DLO_TABLE = {
    ResponseConstant.NAME: "account_dll",
    ResponseConstant.DISPLAY_NAME: "Account DLO",
    ResponseConstant.PRIMARY_KEYS: [{ResponseConstant.NAME: "id"}],
    ResponseConstant.CATEGORY: "Profile",
    ResponseConstant.FIELDS: [
        {
            ResponseConstant.NAME: "id",
            ResponseConstant.DISPLAY_NAME: "Id",
            ResponseConstant.TYPE: "TEXT",
            ResponseConstant.BUSINESS_TYPE: "text",
        },
        {
            ResponseConstant.NAME: "amount",
            ResponseConstant.DISPLAY_NAME: "Amount",
            ResponseConstant.TYPE: "NUMBER",
            ResponseConstant.BUSINESS_TYPE: "number",
        },
    ],
}

MOCK_CI_TABLE = {
    ResponseConstant.NAME: "revenue_cio",
    ResponseConstant.DISPLAY_NAME: "Revenue CI",
    ResponseConstant.DIMENSIONS: [
        {
            ResponseConstant.NAME: "region",
            ResponseConstant.DISPLAY_NAME: "Region",
            ResponseConstant.TYPE: "TEXT",
            ResponseConstant.BUSINESS_TYPE: "text",
        }
    ],
    ResponseConstant.MEASURES: [
        {
            ResponseConstant.NAME: "total",
            ResponseConstant.DISPLAY_NAME: "Total",
            ResponseConstant.TYPE: "NUMBER",
            ResponseConstant.BUSINESS_TYPE: "number",
        }
    ],
}

MOCK_CI_DETAILS = {
    ResponseConstant.EXPRESSION: "SUM(Amount)",
    ResponseConstant.DESCRIPTION: "Total revenue",
}


def _build_source() -> Data360Source:
    with (
        patch("metadata.ingestion.source.database.data360.metadata.Data360Source.test_connection"),
        patch("metadata.ingestion.source.database.data360.connection.Salesforce"),
    ):
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_DATA360_CONFIG)
        source = Data360Source.create(
            MOCK_DATA360_CONFIG["source"],
            OpenMetadata(config=config.workflowConfig.openMetadataServerConfig),
        )
    source.context.get().__dict__["database_service"] = "local_data360"
    source.context.get().__dict__["database"] = "customer_360"
    source.context.get().__dict__["database_schema"] = Constant.DATA_LAKE_OBJECTS
    return source


class TestData360Source:
    def test_get_database_names(self):
        source = _build_source()
        with patch(
            "metadata.ingestion.source.database.data360.metadata.get_dataspaces",
            return_value=MOCK_DATASPACES,
        ):
            names = list(source.get_database_names())
        assert names == ["customer_360", "marketing"]
        assert source.dataspace_map["customer_360"] == MOCK_DATASPACES[0]

    def test_get_database_names_applies_filter_pattern(self):
        source = _build_source()
        source.source_config.databaseFilterPattern = FilterPattern(includes=["customer.*"])
        with patch(
            "metadata.ingestion.source.database.data360.metadata.get_dataspaces",
            return_value=MOCK_DATASPACES,
        ):
            names = list(source.get_database_names())
        assert names == ["customer_360"]

    def test_yield_database(self):
        source = _build_source()
        source.dataspace_map["customer_360"] = MOCK_DATASPACES[0]
        results = list(source.yield_database("customer_360"))
        assert len(results) == 1
        assert results[0].left is None
        request = results[0].right
        assert isinstance(request, CreateDatabaseRequest)
        assert str(request.name.root) == "customer_360"
        assert request.displayName == "Customer 360"

    def test_get_database_schema_names_returns_fixed_schemas(self):
        source = _build_source()
        schema_names = list(source.get_database_schema_names())
        assert schema_names == [
            Constant.DATA_LAKE_OBJECTS,
            Constant.DATA_MODEL_OBJECTS,
            Constant.CALCULATED_INSIGHTS,
        ]

    def test_get_tables_name_and_type(self):
        source = _build_source()
        with patch(
            "metadata.ingestion.source.database.data360.metadata.get_metadata_by_type",
            return_value=[MOCK_DLO_TABLE],
        ):
            tables = list(source.get_tables_name_and_type() or [])
        assert tables == [("account_dll", MetadataTypesConstant.DATA_LAKE_OBJECT)]

    def test_get_tables_name_and_type_returns_nothing_on_empty_response(self):
        source = _build_source()
        with patch(
            "metadata.ingestion.source.database.data360.metadata.get_metadata_by_type",
            return_value=[],
        ):
            tables = list(source.get_tables_name_and_type() or [])
        assert tables == []

    def test_get_tables_name_and_type_applies_filter_pattern(self):
        source = _build_source()
        source.source_config.tableFilterPattern = FilterPattern(excludes=["account.*"])
        with patch(
            "metadata.ingestion.source.database.data360.metadata.get_metadata_by_type",
            return_value=[MOCK_DLO_TABLE],
        ):
            tables = list(source.get_tables_name_and_type() or [])
        assert tables == []

    def test_get_tables_name_and_type_records_failed_schema_instead_of_raising(self):
        source = _build_source()
        with (
            patch(
                "metadata.ingestion.source.database.data360.metadata.get_metadata_by_type",
                side_effect=RuntimeError("No response from Data 360 API"),
            ),
            patch("metadata.utils.fqn.build", return_value="local_data360.customer_360.Data Lake Objects"),
        ):
            tables = list(source.get_tables_name_and_type() or [])
        assert tables == []
        assert "local_data360.customer_360.Data Lake Objects" in source.failed_schema_fqns
        assert len(source.status.failures) == 1

    def test_should_skip_schema_deletion_for_failed_schemas_only(self):
        source = _build_source()
        source.failed_schema_fqns = {"local_data360.customer_360.Data Lake Objects"}
        assert source._should_skip_schema_deletion("local_data360.customer_360.Data Lake Objects")
        assert not source._should_skip_schema_deletion("local_data360.customer_360.Data Model Objects")

    def test_mark_tables_as_deleted_skips_schemas_with_failed_discovery(self):
        source = _build_source()
        source.failed_schema_fqns = {"local_data360.customer_360.Data Lake Objects"}
        with (
            patch.object(
                source,
                "_get_filtered_schema_names",
                return_value=[
                    "local_data360.customer_360.Data Lake Objects",
                    "local_data360.customer_360.Data Model Objects",
                ],
            ),
            patch("metadata.ingestion.source.database.database_service.delete_entity_from_source") as mock_delete,
        ):
            mock_delete.return_value = []
            list(source.mark_tables_as_deleted())
        assert mock_delete.call_count == 1
        assert (
            mock_delete.call_args.kwargs["params"]["databaseSchema"] == "local_data360.customer_360.Data Model Objects"
        )

    def test_get_columns(self):
        source = _build_source()
        columns = source.get_columns(MOCK_DLO_TABLE[ResponseConstant.FIELDS])
        assert [str(c.name.root) for c in columns] == ["id", "amount"]
        assert columns[0].dataType == DataType.TEXT
        assert columns[0].ordinalPosition == 1
        assert columns[1].ordinalPosition == 2

    def test_yield_table_data_lake_object(self):
        source = _build_source()
        table_fqn = "local_data360.customer_360.Data Lake Objects.account_dll"
        source.table_map[table_fqn] = dict(MOCK_DLO_TABLE)
        with patch("metadata.utils.fqn.build", return_value=table_fqn):
            results = list(source.yield_table(("account_dll", MetadataTypesConstant.DATA_LAKE_OBJECT)))
        assert len(results) == 1
        assert results[0].left is None
        request = results[0].right
        assert request is not None
        assert str(request.name.root) == "account_dll"
        assert len(request.columns) == 2

    def test_yield_table_calculated_insight_fetches_expression(self):
        source = _build_source()
        table_fqn = "local_data360.customer_360.Calculated Insights.revenue_cio"
        source.table_map[table_fqn] = dict(MOCK_CI_TABLE)
        with (
            patch("metadata.utils.fqn.build", return_value=table_fqn),
            patch(
                "metadata.ingestion.source.database.data360.metadata.get_calculated_insight_by_name",
                return_value=MOCK_CI_DETAILS,
            ),
        ):
            results = list(source.yield_table(("revenue_cio", MetadataTypesConstant.CALCULATED_INSIGHT)))
        assert len(results) == 1
        request = results[0].right
        assert request is not None
        assert request.description is not None
        assert request.schemaDefinition is not None
        assert request.description.root == "Total revenue"
        assert str(request.schemaDefinition.root) == "SUM(Amount)"
        # Dimensions + measures were combined into a single fields list.
        assert len(request.columns) == 2

    def test_yield_table_reports_error_as_either_left(self):
        source = _build_source()
        # No entry registered in table_map -> AttributeError on `.get` against None.
        with patch("metadata.utils.fqn.build", return_value="missing.fqn"):
            results = list(source.yield_table(("does_not_exist", MetadataTypesConstant.DATA_LAKE_OBJECT)))
        assert len(results) == 1
        assert results[0].right is None
        error = results[0].left
        assert error is not None
        assert "does_not_exist" in error.name

    def test_log_warning_records_status(self):
        source = _build_source()
        source.log_warning("something went wrong")
        assert len(source.status.warnings) == 1
