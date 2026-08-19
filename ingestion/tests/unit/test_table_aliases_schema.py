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
"""Validate that the generated Table models expose the aliases field"""

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.utils import model_str


def test_create_table_request_accepts_aliases():
    request = CreateTableRequest(
        name="orders",
        databaseSchema="mssql_service.analytics_master.dbo",
        columns=[],
        aliases=["mssql_service.analytics_core.dbo.orders"],
    )

    assert [model_str(alias) for alias in request.aliases] == ["mssql_service.analytics_core.dbo.orders"]


def test_aliases_defaults_to_none():
    request = CreateTableRequest(
        name="orders",
        databaseSchema="mssql_service.analytics_master.dbo",
        columns=[],
    )

    assert request.aliases is None


def test_table_entity_exposes_aliases():
    assert "aliases" in Table.model_fields
