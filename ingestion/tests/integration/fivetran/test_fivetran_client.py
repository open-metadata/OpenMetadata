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
Fivetran integration tests using a mock HTTP server
"""

import pytest

from metadata.generated.schema.entity.services.connections.pipeline.fivetranConnection import (
    FivetranConnection,
)
from metadata.ingestion.source.pipeline.fivetran.client import FivetranClient

from .conftest import FivetranMockHandler


@pytest.mark.integration
class TestFivetranClient:
    def test_list_groups(self, fivetran_client):
        groups = list(fivetran_client.list_groups())
        assert len(groups) == 3
        ids = {g["id"] for g in groups}
        assert "group_postgres_rds" in ids
        assert "group_hva_sqlserver" in ids
        assert "group_snowflake" in ids

    def test_list_group_connectors(self, fivetran_client):
        connectors = list(fivetran_client.list_group_connectors("group_postgres_rds"))
        assert len(connectors) == 1
        assert connectors[0]["service"] == "postgres_rds"

    def test_get_connector_details(self, fivetran_client):
        details = fivetran_client.get_connector_details("conn_pg_rds")
        assert details["service"] == "postgres_rds"
        assert details["config"]["database"] == "source_db"
        assert details["group_id"] == "group_postgres_rds"

    def test_get_destination_details(self, fivetran_client):
        dest = fivetran_client.get_destination_details("group_postgres_rds")
        assert dest["service"] == "redshift"
        assert dest["config"]["database"] == "dest_db"

    def test_get_connector_schema_details(self, fivetran_client):
        schemas = fivetran_client.get_connector_schema_details("conn_pg_rds")
        assert "public" in schemas
        assert "internal" in schemas
        assert schemas["public"]["enabled"] is True
        assert schemas["internal"]["enabled"] is False

        tables = schemas["public"]["tables"]
        assert "users" in tables
        assert "audit_log" in tables
        assert tables["users"]["enabled"] is True
        assert tables["audit_log"]["enabled"] is False

    def test_get_connector_column_lineage(self, fivetran_client):
        columns = fivetran_client.get_connector_column_lineage("conn_pg_rds", "public", "users")
        assert "id" in columns
        assert columns["id"]["name_in_destination"] == "user_id"
        assert columns["id"]["enabled"] is True

        assert "email" in columns
        assert columns["email"]["name_in_destination"] == "email_address"
        assert columns["email"]["enabled"] is True

        assert "internal_flag" in columns
        assert columns["internal_flag"]["enabled"] is False

    def test_pagination(self, fivetran_mock_server):
        FivetranMockHandler.paginate_groups = True
        try:
            connection = FivetranConnection(
                apiKey="test_key",
                apiSecret="test_secret",
                hostPort=fivetran_mock_server,
                limit=1,
            )
            client = FivetranClient(connection)
            groups = list(client.list_groups())
            assert len(groups) == 3
            ids = [g["id"] for g in groups]
            assert ids[0] == "group_postgres_rds"
            assert ids[1] == "group_hva_sqlserver"
            assert ids[2] == "group_snowflake"
        finally:
            FivetranMockHandler.paginate_groups = False

    def test_hva_connector_listed(self, fivetran_client):
        connectors = list(fivetran_client.list_group_connectors("group_hva_sqlserver"))
        assert len(connectors) == 1
        assert connectors[0]["id"] == "conn_hva_sqlserver"
        assert connectors[0]["service"] == "sql_server_hva"

    def test_hva_schema_details(self, fivetran_client):
        schemas = fivetran_client.get_connector_schema_details("conn_hva_sqlserver")
        assert "dbo" in schemas
        assert schemas["dbo"]["enabled"] is True
        assert schemas["dbo"]["name_in_destination"] == "DBO_DEST"

        tables = schemas["dbo"]["tables"]
        assert tables["orders"]["name_in_destination"] == "ORDERS_DEST"
        assert tables["customers"]["name_in_destination"] == "CUSTOMERS_DEST"

    def test_hva_column_lineage(self, fivetran_client):
        columns = fivetran_client.get_connector_column_lineage("conn_hva_sqlserver", "dbo", "orders")
        assert columns["order_id"]["name_in_destination"] == "ORDER_ID"
        assert columns["customer_id"]["name_in_destination"] == "CUSTOMER_ID"
        assert columns["order_date"]["name_in_destination"] == "ORDER_DATE"
        assert all(columns[col]["enabled"] for col in columns)

    def test_hva_destination_snowflake(self, fivetran_client):
        dest = fivetran_client.get_destination_details("group_hva_sqlserver")
        assert dest["service"] == "snowflake"
        assert dest["config"]["database"] == "ANALYTICS_DB"
