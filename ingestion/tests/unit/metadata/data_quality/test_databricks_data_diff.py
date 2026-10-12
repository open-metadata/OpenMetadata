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
"""Data diff connection parameters for Databricks and Unity Catalog"""

import pytest

from metadata.generated.schema.entity.services.connections.database.databricks.azureAdSetup import (
    AzureAdSetup,
)
from metadata.generated.schema.entity.services.connections.database.databricks.databricksOAuth import (
    DatabricksOauth,
)
from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection as DatabricksConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection as UnityCatalogConnectionConfig,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.ingestion.source.database.databricks.auth import (
    DataDiffConnectionError,
    get_data_diff_connection_dict,
)
from metadata.ingestion.source.database.unitycatalog.data_diff.data_diff import (
    UnityCatalogTableParameter,
)

HOST_PORT = "my-workspace.cloud.databricks.com:443"
HTTP_PATH = "/sql/1.0/warehouses/abc123"

PERSONAL_ACCESS_TOKEN = PersonalAccessToken(token="dapi-token")
DATABRICKS_OAUTH = DatabricksOauth(clientId="client-id", clientSecret="client-secret")
AZURE_AD = AzureAdSetup(
    azureClientId="azure-client-id",
    azureClientSecret="azure-client-secret",
    azureTenantId="azure-tenant-id",
)


def unity_catalog_config(auth_type=PERSONAL_ACCESS_TOKEN, **kwargs) -> UnityCatalogConnectionConfig:
    return UnityCatalogConnectionConfig(
        **{"hostPort": HOST_PORT, "httpPath": HTTP_PATH, "authType": auth_type, **kwargs}
    )


def databricks_config(auth_type=PERSONAL_ACCESS_TOKEN, **kwargs) -> DatabricksConnectionConfig:
    return DatabricksConnectionConfig(**{"hostPort": HOST_PORT, "httpPath": HTTP_PATH, "authType": auth_type, **kwargs})


def unity_catalog_service(config: UnityCatalogConnectionConfig) -> DatabaseService:
    return DatabaseService.model_construct(
        name="my_service",
        serviceType=DatabaseServiceType.UnityCatalog,
        connection=DatabaseConnection(config=config),
    )


@pytest.mark.parametrize("builder", [unity_catalog_config, databricks_config])
class TestDataDiffConnectionDict:
    """Both connectors share the connection dict builder."""

    def test_personal_access_token(self, builder):
        connection_dict = get_data_diff_connection_dict(builder(PERSONAL_ACCESS_TOKEN))

        assert connection_dict == {
            "driver": "databricks",
            "server_hostname": "my-workspace.cloud.databricks.com",
            "http_path": HTTP_PATH,
            "auth_method": "pat",
            "access_token": "dapi-token",
        }

    def test_databricks_oauth(self, builder):
        connection_dict = get_data_diff_connection_dict(builder(DATABRICKS_OAUTH))

        assert connection_dict["auth_method"] == "oauth-m2m"
        assert connection_dict["databricks_client_id"] == "client-id"
        assert connection_dict["databricks_client_secret"] == "client-secret"
        assert "access_token" not in connection_dict

    def test_azure_ad(self, builder):
        connection_dict = get_data_diff_connection_dict(builder(AZURE_AD))

        assert connection_dict["auth_method"] == "azure-sp-m2m"
        assert connection_dict["azure_client_id"] == "azure-client-id"
        assert connection_dict["azure_client_secret"] == "azure-client-secret"
        assert connection_dict["azure_tenant_id"] == "azure-tenant-id"
        assert "access_token" not in connection_dict

    def test_every_value_is_json_serializable(self, builder):
        """data_diff caches connections on json.dumps of the dict."""
        for auth_type in (PERSONAL_ACCESS_TOKEN, DATABRICKS_OAUTH, AZURE_AD):
            connection_dict = get_data_diff_connection_dict(builder(auth_type))
            assert all(isinstance(value, str) for value in connection_dict.values())

    def test_pasted_workspace_url_is_normalized(self, builder):
        connection_dict = get_data_diff_connection_dict(builder(hostPort="https://my-workspace.cloud.databricks.com"))

        assert connection_dict["server_hostname"] == "my-workspace.cloud.databricks.com"


def test_missing_http_path_is_rejected():
    """Only Unity Catalog can reach this: the Databricks schema requires httpPath."""
    with pytest.raises(DataDiffConnectionError, match="HTTP Path"):
        get_data_diff_connection_dict(unity_catalog_config(httpPath=None))


class TestDataDiffTableScope:
    """data_diff resolves a two-part schema.table path against the connection's catalog."""

    def test_catalog_and_schema_come_from_the_table(self):
        service = unity_catalog_service(unity_catalog_config())

        connection_dict = UnityCatalogTableParameter().get_data_diff_url(service, "my_service.my_catalog.my_schema.t")

        assert connection_dict["catalog"] == "my_catalog"
        assert connection_dict["schema"] == "my_schema"
        assert connection_dict["access_token"] == "dapi-token"

    def test_service_level_catalog_does_not_win(self):
        service = unity_catalog_service(unity_catalog_config(catalog="configured_catalog"))

        connection_dict = UnityCatalogTableParameter().get_data_diff_url(service, "my_service.my_catalog.my_schema.t")

        assert connection_dict["catalog"] == "my_catalog"

    def test_both_sides_of_a_same_service_diff_keep_their_own_catalog(self):
        service = unity_catalog_service(unity_catalog_config())
        setter = UnityCatalogTableParameter()

        table1 = setter.get_data_diff_url(service, "my_service.catalog_one.schema_one.t")
        table2 = setter.get_data_diff_url(service, "my_service.catalog_two.schema_two.t", override_url=table1)

        assert table1["catalog"] == "catalog_one"
        assert table1["schema"] == "schema_one"
        assert table2["catalog"] == "catalog_two"
        assert table2["schema"] == "schema_two"
