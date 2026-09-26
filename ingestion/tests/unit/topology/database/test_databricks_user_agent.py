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
Databricks partner telemetry attribution is threaded through every connection
mechanism: the SQLAlchemy engine, the Databricks SDK client and the REST client.
The open source and Collate distributions report under different product names.
https://databrickslabs.github.io/partner-architecture/isv-partners/telemetry-attribution
"""

import re
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.ingestion.source.database.databricks import user_agent as user_agent_module
from metadata.ingestion.source.database.databricks.client import DatabricksClient
from metadata.ingestion.source.database.databricks.user_agent import (
    COLLATE_PARTNER_PRODUCT,
    OSS_PARTNER_PRODUCT,
    get_databricks_partner_product,
    get_databricks_product,
    get_databricks_user_agent,
)

USER_AGENT_PATTERN = re.compile(r"^[A-Za-z0-9]+_[A-Za-z0-9]+/.+")


@contextmanager
def installed_distributions(**versions: str):
    """Pretend only the given distributions are installed, bypassing the cache."""
    user_agent_module._partner_product_and_version.cache_clear()
    with patch.object(
        user_agent_module,
        "_distribution_version",
        versions.get,
    ):
        yield
    user_agent_module._partner_product_and_version.cache_clear()


@pytest.fixture(autouse=True)
def _clear_partner_cache():
    user_agent_module._partner_product_and_version.cache_clear()
    yield
    user_agent_module._partner_product_and_version.cache_clear()


def test_user_agent_follows_isv_partner_format():
    user_agent = get_databricks_user_agent()
    product = get_databricks_partner_product()

    assert USER_AGENT_PATTERN.match(user_agent)
    assert "_" in product
    assert user_agent.startswith(f"{product}/")


def test_isv_name_is_shared_by_both_products():
    """Databricks requires the ISV half of the name to be the company name, kept
    consistent across every partner product, so only the product half may differ."""
    assert OSS_PARTNER_PRODUCT.split("_")[0] == COLLATE_PARTNER_PRODUCT.split("_")[0]
    assert OSS_PARTNER_PRODUCT != COLLATE_PARTNER_PRODUCT


def test_sdk_product_pair_matches_user_agent():
    product, product_version = get_databricks_product()

    assert product == get_databricks_partner_product()
    assert get_databricks_user_agent() == f"{product}/{product_version}"


def test_open_source_install_reports_openmetadata_product():
    with installed_distributions(**{"openmetadata-ingestion": "1.10.0"}):
        assert get_databricks_user_agent() == f"{OSS_PARTNER_PRODUCT}/1.10.0"
        assert get_databricks_product() == (OSS_PARTNER_PRODUCT, "1.10.0")


def test_collate_install_reports_collate_product_and_version():
    with installed_distributions(**{"openmetadata-ingestion": "1.10.0", "collate-ingestion": "1.10.1"}):
        assert get_databricks_user_agent() == f"{COLLATE_PARTNER_PRODUCT}/1.10.1"
        assert get_databricks_product() == (COLLATE_PARTNER_PRODUCT, "1.10.1")


def test_missing_distribution_metadata_falls_back_to_open_source():
    with installed_distributions():
        assert get_databricks_user_agent() == f"{OSS_PARTNER_PRODUCT}/unknown"


def test_databricks_engine_sets_user_agent_entry():
    connection = DatabricksConnection(
        hostPort="test-host:443",
        authType=PersonalAccessToken(token="test-token"),
        httpPath="/sql/1.0/warehouses/abc",
        catalog="main",
    )

    from metadata.ingestion.source.database.databricks import connection as db_connection

    captured = {}

    def _capture(connection, **_kwargs):
        captured["user_agent_entry"] = connection.connectionArguments.root.get("user_agent_entry")
        return MagicMock()

    with patch.object(db_connection, "create_generic_db_connection", _capture):
        db_connection.get_connection(connection)

    assert captured["user_agent_entry"] == get_databricks_user_agent()


def test_unitycatalog_engine_sets_user_agent_entry():
    connection = UnityCatalogConnection(
        hostPort="test-host:443",
        authType=PersonalAccessToken(token="test-token"),
        httpPath="/sql/1.0/warehouses/abc",
    )

    from metadata.ingestion.source.database.unitycatalog import connection as uc_connection

    captured = {}

    def _capture(connection, **_kwargs):
        captured["user_agent_entry"] = connection.connectionArguments.root.get("user_agent_entry")
        return MagicMock()

    with patch.object(uc_connection, "create_generic_db_connection", _capture):
        uc_connection.get_sqlalchemy_connection(connection)

    assert captured["user_agent_entry"] == get_databricks_user_agent()


def test_unitycatalog_workspace_client_receives_product():
    connection = UnityCatalogConnection(
        hostPort="test-host:443",
        authType=PersonalAccessToken(token="test-token"),
    )

    from metadata.ingestion.source.database.unitycatalog import connection as uc_connection

    with patch.object(uc_connection, "WorkspaceClient") as workspace_client:
        uc_connection.get_connection(connection)

    _, kwargs = workspace_client.call_args
    product, product_version = get_databricks_product()
    assert kwargs["product"] == product
    assert kwargs["product_version"] == product_version


def test_rest_client_sends_user_agent_header():
    config = DatabricksConnection(
        hostPort="test-host:443",
        authType=PersonalAccessToken(token="test-token"),
        httpPath="/sql/1.0/warehouses/abc",
        catalog="main",
    )
    client = DatabricksClient(config)

    assert client.headers["User-Agent"] == get_databricks_user_agent()
