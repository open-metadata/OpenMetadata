#  Copyright 2026 Collate
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
Tests for the catalog configured on a Unity Catalog connection: it is ingested under the
name Unity Catalog stores it with (lowercase), the name the system tables report to
lineage and usage.
"""

from unittest.mock import MagicMock, patch

import pytest
from databricks.sdk.service.catalog import CatalogInfo

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource

CONFIG = {
    "source": {
        "type": "unitycatalog",
        "serviceName": "local_unitycatalog",
        "serviceConnection": {
            "config": {
                "type": "UnityCatalog",
                "catalog": "Demo",
                "authType": {"token": "123sawdtesttoken"},
                "hostPort": "localhost:443",
                "httpPath": "/sql/1.0/warehouses/abcdedfg",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "unity_catalog"},
        }
    },
}


@pytest.fixture
def uc_source():
    connection = MagicMock()
    with (
        patch(
            "metadata.ingestion.source.database.unitycatalog.metadata.create_connection",
            return_value=connection,
        ),
        patch.object(UnitycatalogSource, "test_connection", return_value=False),
    ):
        config = OpenMetadataWorkflowConfig.model_validate(CONFIG)
        source = UnitycatalogSource.create(CONFIG["source"], config.workflowConfig.openMetadataServerConfig)
    source.metadata = MagicMock()
    # The topology context is a class attribute shared by every source in the process:
    # restore it so the next test file does not inherit this one's catalog.
    context = source.context.get().__dict__
    saved = {key: context.get(key) for key in ("database_service", "database")}
    context.update(database_service="local_unitycatalog", database="demo")
    source.client = MagicMock()
    yield source
    context.update(saved)
    source.close()


class TestConfiguredCatalog:
    def test_mixed_case_catalog_is_ingested_under_its_lowercase_name(self, uc_source):
        uc_source.client.catalogs.get.return_value = CatalogInfo(name="demo", comment="sales data")

        assert list(uc_source.get_database_names()) == ["demo"]

        database_request = next(uc_source.yield_database("demo")).right
        assert database_request.name.root == "demo"
        assert database_request.description.root == "sales data"

    def test_progress_totals_and_the_walk_share_one_catalog_lookup(self, uc_source):
        uc_source.client.catalogs.get.return_value = CatalogInfo(name="demo")

        assert uc_source._filtered_database_names_for_totals() == ["demo"]
        assert list(uc_source.get_database_names()) == ["demo"]
        uc_source.client.catalogs.get.assert_called_once_with("Demo")

    def test_unreadable_catalog_falls_back_to_the_lowercase_name(self, uc_source):
        uc_source.client.catalogs.get.side_effect = Exception("PERMISSION_DENIED")

        assert list(uc_source.get_database_names()) == ["demo"]
