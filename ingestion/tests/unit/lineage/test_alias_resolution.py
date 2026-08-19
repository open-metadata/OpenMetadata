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
"""Lineage resolution falls back to an exact alias match"""

from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.lineage.sql_lineage import search_table_entities


def _table(table_fqn):
    table = MagicMock(spec=Table)
    table.fullyQualifiedName = table_fqn
    return table


def test_canonical_match_does_not_consult_aliases():
    metadata = MagicMock()
    metadata.es_search_from_fqn.return_value = [_table("svc.analytics_master.dbo.orders")]

    with patch("metadata.ingestion.lineage.sql_lineage.search_cache", MagicMock(get=lambda _: None)):
        result = search_table_entities(
            metadata=metadata,
            service_names="svc",
            database="analytics_master",
            database_schema="dbo",
            table="orders",
        )

    assert result is not None
    metadata.es_search_from_alias.assert_not_called()


def test_alias_match_resolves_to_the_canonical_table():
    metadata = MagicMock()
    metadata.es_search_from_fqn.return_value = None
    metadata.get_by_name.return_value = None
    metadata.es_search_from_alias.return_value = [_table("svc.analytics_master.dbo.orders")]

    with patch("metadata.ingestion.lineage.sql_lineage.search_cache", MagicMock(get=lambda _: None)):
        result = search_table_entities(
            metadata=metadata,
            service_names="svc",
            database="analytics_core",
            database_schema="dbo",
            table="orders",
        )

    assert [entity.fullyQualifiedName for entity in result] == ["svc.analytics_master.dbo.orders"]
    metadata.es_search_from_alias.assert_called_once()


def test_no_match_returns_none():
    metadata = MagicMock()
    metadata.es_search_from_fqn.return_value = None
    metadata.get_by_name.return_value = None
    metadata.es_search_from_alias.return_value = None

    with patch("metadata.ingestion.lineage.sql_lineage.search_cache", MagicMock(get=lambda _: None)):
        result = search_table_entities(
            metadata=metadata,
            service_names="svc",
            database="analytics_core",
            database_schema="dbo",
            table="orders",
        )

    assert result is None
