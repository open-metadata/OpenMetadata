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
"""The generic table producer must pass connector-supplied aliases into the create request"""

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService


def test_get_table_aliases_defaults_to_none():
    assert CommonDbSourceService.get_table_aliases(None, table_name="orders", schema_name="dbo") is None


def test_create_table_request_carries_aliases():
    request = CreateTableRequest(
        name="orders",
        databaseSchema="svc.analytics_master.dbo",
        columns=[],
        aliases=["svc.analytics_core.dbo.orders"],
    )

    assert [model_str(alias) for alias in request.aliases] == ["svc.analytics_core.dbo.orders"]
