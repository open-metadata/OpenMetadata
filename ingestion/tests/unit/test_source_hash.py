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

"""Tests for source hash generation"""

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.utils.source_hash import generate_source_hash


def _request(aliases):
    return CreateTableRequest(
        name="orders",
        databaseSchema="mssql_service.analytics_master.dbo",
        columns=[],
        aliases=aliases,
    )


def test_source_hash_is_stable_across_alias_ordering():
    first = generate_source_hash(_request(["svc.db_a.dbo.orders", "svc.db_b.dbo.orders"]))
    second = generate_source_hash(_request(["svc.db_b.dbo.orders", "svc.db_a.dbo.orders"]))

    assert first == second


def test_source_hash_changes_when_an_alias_is_added():
    without = generate_source_hash(_request(["svc.db_a.dbo.orders"]))
    with_extra = generate_source_hash(_request(["svc.db_a.dbo.orders", "svc.db_b.dbo.orders"]))

    assert without != with_extra
