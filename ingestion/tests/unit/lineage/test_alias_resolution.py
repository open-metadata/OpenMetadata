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
from metadata.ingestion.lineage.sql_lineage import (
    search_table_entities,
    service_resolves_aliases,
)


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

    with (
        patch("metadata.ingestion.lineage.sql_lineage.search_cache", MagicMock(get=lambda _: None)),
        patch("metadata.ingestion.lineage.sql_lineage.service_resolves_aliases", return_value=True),
    ):
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

    with (
        patch("metadata.ingestion.lineage.sql_lineage.search_cache", MagicMock(get=lambda _: None)),
        patch("metadata.ingestion.lineage.sql_lineage.service_resolves_aliases", return_value=True),
    ):
        result = search_table_entities(
            metadata=metadata,
            service_names="svc",
            database="analytics_core",
            database_schema="dbo",
            table="orders",
        )

    assert result is None


class TestAliasOptInGate:
    """The alias lookup must be per-service opt-in, not paid by every connector."""

    def setup_method(self):
        from metadata.ingestion.lineage import sql_lineage

        sql_lineage.alias_resolution_cache.clear()

    def _service(self, **connection_fields):
        service = MagicMock()
        service.connection.config = MagicMock(spec_set=list(connection_fields))
        for key, value in connection_fields.items():
            setattr(service.connection.config, key, value)

        return service

    def test_opted_in_service_resolves_aliases(self):
        metadata = MagicMock()
        metadata.get_by_name.return_value = self._service(includeSynonyms=True)

        assert service_resolves_aliases(metadata, "svc") is True

    def test_opted_out_service_does_not(self):
        metadata = MagicMock()
        metadata.get_by_name.return_value = self._service(includeSynonyms=False)

        assert service_resolves_aliases(metadata, "svc") is False

    def test_connector_without_the_field_does_not(self):
        metadata = MagicMock()
        metadata.get_by_name.return_value = self._service(hostPort="localhost:5432")

        assert service_resolves_aliases(metadata, "svc") is False

    def test_result_is_cached_so_the_service_is_fetched_once(self):
        metadata = MagicMock()
        metadata.get_by_name.return_value = self._service(includeSynonyms=True)

        service_resolves_aliases(metadata, "svc")
        service_resolves_aliases(metadata, "svc")

        assert metadata.get_by_name.call_count == 1

    def test_unreadable_service_defaults_to_disabled(self):
        metadata = MagicMock()
        metadata.get_by_name.side_effect = RuntimeError("boom")

        assert service_resolves_aliases(metadata, "svc") is False

    def test_opted_out_service_never_issues_the_alias_search(self):
        metadata = MagicMock()
        metadata.es_search_from_fqn.return_value = None
        metadata.get_by_name.return_value = None
        metadata.es_search_from_alias.return_value = [_table("svc.master.dbo.orders")]

        with patch("metadata.ingestion.lineage.sql_lineage.search_cache", MagicMock(get=lambda _: None)):
            result = search_table_entities(
                metadata=metadata,
                service_names="svc",
                database="core",
                database_schema="dbo",
                table="orders",
            )

        assert result is None
        metadata.es_search_from_alias.assert_not_called()
