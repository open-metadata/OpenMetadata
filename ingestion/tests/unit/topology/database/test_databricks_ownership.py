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
Tests for Databricks owner resolution.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, Mock

from metadata.ingestion.source.database.databricks.client import (
    SCIM_GROUPS_PATH,
    SCIM_SERVICE_PRINCIPALS_PATH,
    DatabricksClient,
)
from metadata.ingestion.source.database.databricks.metadata import DatabricksSource
from metadata.ingestion.source.database.databricks.models import DescribeJsonPayload
from metadata.ingestion.source.database.databricks.ownership import (
    DatabricksOwnerResolver,
)
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource

_DATABRICKS_METADATA = "metadata.ingestion.source.database.databricks.metadata"
_APP_ID = "11111111-2222-3333-4444-555555555555"


class ScimResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code
        self.text = str(payload)

    def json(self):
        return self.payload


def _client_with_responses(responses):
    client = DatabricksClient.__new__(DatabricksClient)
    client.base_url = "https://workspace.cloud.databricks.com/api/2.0"
    client._get_auth_header = Mock(return_value={"Authorization": "Bearer token"})
    client.api_timeout = 120
    client.client = Mock()
    client.client.get.side_effect = responses
    return client


def test_scim_resource_listing_handles_pagination():
    client = _client_with_responses(
        [
            ScimResponse(
                {
                    "Resources": [{"applicationId": "app-1", "displayName": "Job Runner"}],
                    "itemsPerPage": 1,
                    "startIndex": 1,
                    "totalResults": 2,
                }
            ),
            ScimResponse(
                {
                    "Resources": [{"applicationId": "app-2", "displayName": "Loader"}],
                    "itemsPerPage": 1,
                    "startIndex": 2,
                    "totalResults": 2,
                }
            ),
        ]
    )

    assert list(client.list_service_principals()) == [
        {"applicationId": "app-1", "displayName": "Job Runner"},
        {"applicationId": "app-2", "displayName": "Loader"},
    ]
    assert client.client.get.call_args_list[0].kwargs["params"] == {"startIndex": 1, "count": 100}
    assert client.client.get.call_args_list[1].kwargs["params"] == {"startIndex": 2, "count": 100}
    assert client._get_auth_header.call_count == 2


def test_scim_listing_stops_when_items_per_page_is_non_positive():
    client = _client_with_responses(
        [
            ScimResponse(
                {
                    "Resources": [
                        {"applicationId": "app-1", "displayName": "Job Runner"},
                        {"applicationId": "app-2", "displayName": "Loader"},
                    ],
                    "itemsPerPage": "0",
                    "startIndex": 1,
                    "totalResults": 2,
                }
            ),
        ]
    )

    assert list(client.list_service_principals()) == [
        {"applicationId": "app-1", "displayName": "Job Runner"},
        {"applicationId": "app-2", "displayName": "Loader"},
    ]
    assert client.client.get.call_count == 1


def test_scim_listing_passes_filter_expression():
    client = _client_with_responses(
        [
            ScimResponse(
                {
                    "Resources": [{"applicationId": "app-1", "displayName": "Job Runner"}],
                    "itemsPerPage": 1,
                    "startIndex": 1,
                    "totalResults": 1,
                }
            ),
        ]
    )

    assert list(client.list_service_principals(filter_expression='applicationId eq "app-1"')) == [
        {"applicationId": "app-1", "displayName": "Job Runner"}
    ]
    assert client.client.get.call_args.kwargs["params"] == {
        "startIndex": 1,
        "count": 100,
        "filter": 'applicationId eq "app-1"',
    }


def test_owner_resolver_maps_service_principal_app_id_to_display_name():
    api_client = Mock()
    api_client.list_service_principals.return_value = [{"applicationId": _APP_ID, "displayName": "Job Runner"}]
    metadata = Mock()
    metadata.get_reference_by_name.return_value = "owner-ref"
    resolver = DatabricksOwnerResolver(api_client, metadata, include_owners=True)

    assert resolver.get_owner_ref(_APP_ID) == "owner-ref"
    api_client.list_service_principals.assert_called_once_with(filter_expression=f'applicationId eq "{_APP_ID}"')
    api_client.list_groups.assert_not_called()
    metadata.get_reference_by_name.assert_called_once_with(name="Job Runner")


def test_owner_resolver_maps_group_id_to_team_owner_lookup():
    api_client = Mock()
    api_client.list_groups.return_value = [{"id": "100000", "displayName": "Data Platform"}]
    metadata = Mock()
    metadata.get_reference_by_name.return_value = "team-ref"
    resolver = DatabricksOwnerResolver(api_client, metadata, include_owners=True)

    assert resolver.get_owner_ref("100000") == "team-ref"
    api_client.list_service_principals.assert_not_called()
    api_client.list_groups.assert_called_once_with(filter_expression='id eq "100000"')
    metadata.get_reference_by_name.assert_called_once_with(name="Data Platform", is_owner=True)


def test_owner_resolver_classifies_group_display_name_as_team_owner():
    api_client = Mock()
    api_client.list_groups.return_value = [{"id": "100000", "displayName": "Data Platform"}]
    metadata = Mock()
    metadata.get_reference_by_name.return_value = "team-ref"
    resolver = DatabricksOwnerResolver(api_client, metadata, include_owners=True)

    assert resolver.get_owner_ref("Data Platform") == "team-ref"
    api_client.list_service_principals.assert_not_called()
    api_client.list_groups.assert_called_once_with(filter_expression='displayName eq "Data Platform"')
    metadata.get_reference_by_name.assert_called_once_with(name="Data Platform", is_owner=True)


def test_owner_resolver_ignores_scim_results_that_do_not_match_owner():
    api_client = Mock()
    api_client.list_groups.return_value = [{"id": "200000", "displayName": "Other Team"}]
    metadata = Mock()
    metadata.get_reference_by_name.return_value = "owner-ref"
    resolver = DatabricksOwnerResolver(api_client, metadata, include_owners=True)

    assert resolver.get_owner_ref("100000") == "owner-ref"
    metadata.get_reference_by_name.assert_called_once_with(name="100000")


def test_owner_resolver_skips_group_lookup_for_unresolved_uuid_owner():
    api_client = Mock()
    api_client.list_service_principals.return_value = []
    metadata = Mock()
    metadata.get_reference_by_name.return_value = "owner-ref"
    resolver = DatabricksOwnerResolver(api_client, metadata, include_owners=True)

    assert resolver.get_owner_ref(_APP_ID) == "owner-ref"
    api_client.list_service_principals.assert_called_once()
    api_client.list_groups.assert_not_called()
    metadata.get_reference_by_name.assert_called_once_with(name=_APP_ID)


def test_owner_resolver_caches_resolved_owners():
    api_client = Mock()
    api_client.list_groups.return_value = [{"id": "100000", "displayName": "Data Platform"}]
    metadata = Mock()
    metadata.get_reference_by_name.return_value = "team-ref"
    resolver = DatabricksOwnerResolver(api_client, metadata, include_owners=True)

    assert resolver.get_owner_ref("100000") == "team-ref"
    assert resolver.get_owner_ref("100000") == "team-ref"
    api_client.list_groups.assert_called_once()
    metadata.get_reference_by_name.assert_called_once()


def test_owner_resolver_uses_email_lookup_for_email_owner():
    api_client = Mock()
    metadata = Mock()
    metadata.get_reference_by_email.return_value = "email-ref"
    resolver = DatabricksOwnerResolver(api_client, metadata, include_owners=True)

    assert resolver.get_owner_ref("user@example.com") == "email-ref"
    api_client.list_service_principals.assert_not_called()
    api_client.list_groups.assert_not_called()
    metadata.get_reference_by_email.assert_called_once()


def test_owner_resolver_falls_back_to_email_local_part_name():
    api_client = Mock()
    metadata = Mock()
    metadata.get_reference_by_email.return_value = None
    metadata.get_reference_by_name.return_value = "owner-ref"
    resolver = DatabricksOwnerResolver(api_client, metadata, include_owners=True)

    assert resolver.get_owner_ref("user@example.com") == "owner-ref"
    metadata.get_reference_by_name.assert_called_once_with(name="user")


def test_owner_resolver_falls_back_to_raw_owner_when_scim_fails():
    api_client = Mock()
    api_client.list_service_principals.side_effect = Exception("scim denied")
    api_client.list_groups.side_effect = Exception("scim denied")
    metadata = Mock()
    metadata.get_reference_by_name.return_value = "owner-ref"
    resolver = DatabricksOwnerResolver(api_client, metadata, include_owners=True)

    assert resolver.get_owner_ref(_APP_ID) == "owner-ref"
    api_client.list_service_principals.assert_called_once()
    api_client.list_groups.assert_not_called()
    metadata.get_reference_by_name.assert_called_once_with(name=_APP_ID)


def test_owner_resolver_skips_scim_and_lookup_when_include_owners_false():
    api_client = Mock()
    metadata = Mock()
    resolver = DatabricksOwnerResolver(api_client, metadata, include_owners=False)

    assert resolver.get_owner_ref(_APP_ID) is None
    api_client.list_service_principals.assert_not_called()
    api_client.list_groups.assert_not_called()
    metadata.get_reference_by_name.assert_not_called()


def test_unitycatalog_get_owner_ref_uses_databricks_owner_resolver():
    source = UnitycatalogSource.__new__(UnitycatalogSource)
    source.owner_resolver = Mock()
    source.owner_resolver.get_owner_ref.return_value = "owner-ref"

    assert UnitycatalogSource.get_owner_ref(source, _APP_ID) == "owner-ref"
    source.owner_resolver.get_owner_ref.assert_called_once_with(_APP_ID)


def test_databricks_get_owner_ref_uses_databricks_owner_resolver(monkeypatch):
    monkeypatch.setattr(
        f"{_DATABRICKS_METADATA}._fetch_table_describe_json",
        lambda *args, **kwargs: DescribeJsonPayload(owner=f"{_APP_ID} (Unknown)"),
    )
    source = MagicMock()
    source.__dict__["owner_resolver"] = Mock()
    source.owner_resolver.get_owner_ref.return_value = "owner-ref"
    source.context.get().database = "db"
    source.context.get().database_schema = "sch"
    source._filter_owner_name = DatabricksSource._filter_owner_name.__get__(source)
    source.inspector = SimpleNamespace(dialect=SimpleNamespace())

    assert DatabricksSource.get_owner_ref(source, "tbl") == "owner-ref"
    source.owner_resolver.get_owner_ref.assert_called_once_with(_APP_ID)


def test_scim_group_and_service_principal_paths_are_exposed():
    assert SCIM_SERVICE_PRINCIPALS_PATH == "/preview/scim/v2/ServicePrincipals"
    assert SCIM_GROUPS_PATH == "/preview/scim/v2/Groups"
