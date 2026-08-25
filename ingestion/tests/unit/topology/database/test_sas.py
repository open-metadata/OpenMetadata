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
Unit tests for the SAS connector.

These tests pin the bug fixes from issue #16888 where metadata ingestion
failed with a default SAS Viya 4 configuration because:
  1. `casHost` (and other nullable SAS attributes) came back as None and
     the backend rejected the CreateTableRequest with 400
     "Custom field casHost has invalid JSON [$: null found, string expected]".
  2. After the sink rejection, the source re-fetched the table and crashed
     on `None.id`, masking the real sink error.
  3. The bare `except` in `create_table_entity` referenced `table_name`
     before it was assigned in some code paths.
  4. `create_database_schema` only caught `HTTPError`, so a malformed
     `resourceId` raised an uncaught `IndexError`.
"""
# pylint: disable=protected-access

from unittest.mock import MagicMock, patch

import pytest
from requests.exceptions import HTTPError

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.sas.client import SASClient
from metadata.ingestion.source.database.sas.metadata import (
    SASResourceContext,
    SasSource,
    parse_resource_id,
)

MOCK_SAS_CONFIG = {
    "source": {
        "type": "sas",
        "serviceName": "local_sas",
        "serviceConnection": {
            "config": {
                "type": "SAS",
                "serverHost": "http://your-server-host.org",
                "username": "username",
                "password": "password",
                "datatables": True,
                "dataTablesCustomFilter": None,
                "reports": False,
                "reportsCustomFilter": None,
                "dataflows": False,
                "dataflowsCustomFilter": None,
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "sas-unit-test"},
        }
    },
}

# A realistic dataset search hit taken from the user's ingestion log
# (#16888). resourceId uses the "~fs~" separator style that the parsing
# code in create_database_schema relies on.
LAS_TRAIN_SEARCH_HIT = {
    "id": "0396a44a-889f-4ee0-8211-252fc088a3cc",
    "name": "LAS_TRAIN",
    "type": "sasTable",
    "attributes": {"library": "PUBLIC", "reviewStatus": "none"},
}

# Mock `get_views` response. The SAS source expects a `dataSet` entity
# plus zero or more `dataField`/`Column` entities in "entities".
LAS_TRAIN_VIEW = {
    "entities": [
        {
            "id": "0396a44a-889f-4ee0-8211-252fc088a3cc",
            "type": ["Table", "dataSet"],
            "name": "LAS_TRAIN",
            "resourceId": (
                "/dataTables/dataSources/Compute~fs~49736234-36b3-48d2-b2e2-e12aa365ce05~fs~PUBLIC/tables/LAS_TRAIN"
            ),
            "creationTimeStamp": None,
            "attributes": {
                "analysisTimeStamp": "2024-07-01T10:25:00.000Z",
                "rowCount": 10,
                "columnCount": 1,
                "dataSize": 1024,
                # The specific field that triggered the original bug —
                # SAS returns it as null for compute-backed tables.
                "casHost": None,
                "CASLIB": "PUBLIC",
                "engineName": "V9",
            },
        },
        {
            "id": "col-1",
            "type": ["Column"],
            "name": "col1",
            "attributes": {
                "dataType": "char",
                "ordinalPosition": 1,
                "charsMaxCount": 10,
            },
        },
    ]
}


@pytest.fixture
def sas_source():
    """Build a SasSource with every network call mocked out."""
    with (
        patch.object(SASClient, "get_token", return_value="token"),
        patch("metadata.ingestion.source.database.sas.metadata.SasSource.test_connection"),
        patch("metadata.ingestion.source.database.sas.metadata.SasSource.add_table_custom_attributes"),
    ):
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_SAS_CONFIG)
        source = SasSource.create(
            MOCK_SAS_CONFIG["source"],
            MagicMock(),
        )
        source.config = config.source
        source.db_service_name = "local_sas"
        return source


class TestParseResourceId:
    """Cover the standalone parse_resource_id function that extracts
    provider/host/library from a SAS Information Catalog resourceId.

    Known shapes (SAS Data Tables REST API):
        /dataTables/dataSources/{provider}~fs~{host}~fs~{library}/tables/{table}
    """

    def test_cas_table(self):
        ctx = parse_resource_id(
            "/dataTables/dataSources/cas~fs~cas-shared-default~fs~Samples/tables/WATER_CLUSTER?ext=sashdat"
        )
        assert ctx == SASResourceContext(
            provider="cas",
            host="cas-shared-default",
            library="Samples",
            raw_resource_id=(
                "/dataTables/dataSources/cas~fs~cas-shared-default~fs~Samples/tables/WATER_CLUSTER?ext=sashdat"
            ),
        )
        assert ctx.database_name == "cas.cas-shared-default"

    def test_compute_table(self):
        ctx = parse_resource_id(
            "/dataTables/dataSources/Compute~fs~49736234-36b3-48d2-b2e2-e12aa365ce05~fs~PUBLIC/tables/LAS_TRAIN"
        )
        assert ctx.provider == "Compute"
        assert ctx.host == "49736234-36b3-48d2-b2e2-e12aa365ce05"
        assert ctx.library == "PUBLIC"
        assert ctx.database_name == "Compute.49736234-36b3-48d2-b2e2-e12aa365ce05"

    def test_too_few_slash_segments_returns_none(self):
        assert parse_resource_id("/too/short") is None

    def test_missing_field_separator_returns_none(self):
        assert parse_resource_id("/dataTables/dataSources/no-separators-here/tables/T") is None

    def test_only_two_fields_returns_none(self):
        assert parse_resource_id("/dataTables/dataSources/cas~fs~host/tables/T") is None

    def test_empty_string_returns_none(self):
        assert parse_resource_id("") is None

    def test_frozen_dataclass(self):
        ctx = parse_resource_id("/dataTables/dataSources/cas~fs~host~fs~lib/tables/T")
        with pytest.raises(AttributeError):
            ctx.provider = "modified"


class TestCreateDatabaseSchema:
    """Cover create_database_schema using parse_resource_id + fallback."""

    def test_well_formed_resource_id_sets_db_and_schema(self, sas_source):
        sas_source.metadata = MagicMock()
        sas_source.metadata.create_or_update.return_value = MagicMock(fullyQualifiedName="cas.cas-shared-default")
        table = {
            "resourceId": (
                "/dataTables/dataSources/cas~fs~cas-shared-default~fs~Samples/tables/WATER_CLUSTER?ext=sashdat"
            ),
        }

        sas_source.create_database_schema(table)

        assert sas_source.db_name == "cas.cas-shared-default"
        assert sas_source.db_schema_name == "Samples"

    def test_malformed_resource_id_falls_back_to_relationships(self, sas_source):
        sas_source.metadata = MagicMock()
        sas_source.sas_client = MagicMock()
        sas_source.sas_client.get_instance.return_value = {
            "name": "fallback_schema",
            "resourceId": "/dataSources/some/parent",
            "links": [{"rel": "parent", "uri": "/parent"}],
        }
        sas_source.create_database_alt = MagicMock(return_value=MagicMock(fullyQualifiedName="fallback_db"))

        table = {
            "resourceId": "/too/short",
            "relationships": [
                {
                    "definitionId": "4b114f6e-1c2a-4060-9184-6809a612f27b",
                    "endpointId": "data-store-1",
                }
            ],
        }

        result = sas_source.create_database_schema(table)

        assert result is not None
        sas_source.create_database_alt.assert_called_once()

    def test_fallback_returns_none_when_no_data_store_relationship(self, sas_source):
        sas_source.metadata = MagicMock()
        sas_source.sas_client = MagicMock()

        table = {
            "resourceId": "/x/y",
            "relationships": [],
        }

        assert sas_source.create_database_schema(table) is None


class TestExtensionAttributeFiltering:
    """The primary bug: null extension values must be stripped before
    the CreateTableRequest is yielded, otherwise the sink returns 400."""

    def _run_create_table_entity(self, sas_source):
        sas_source.sas_client = MagicMock()
        sas_source.sas_client.get_information_catalog_link.return_value = "http://sas/catalog/LAS_TRAIN"
        sas_source.metadata = MagicMock()
        # Table does not exist yet, so the source should yield a Create.
        sas_source.metadata.get_by_name.return_value = None

        with (
            patch.object(
                SasSource,
                "get_entities_using_view",
                return_value=(LAS_TRAIN_VIEW["entities"], LAS_TRAIN_VIEW["entities"][0]),
            ),
            patch.object(
                SasSource,
                "create_database_schema",
                return_value=MagicMock(fullyQualifiedName="cas.49736234.PUBLIC"),
            ),
        ):
            return list(sas_source.create_table_entity(LAS_TRAIN_SEARCH_HIT))

    def test_null_cas_host_is_dropped_from_extension(self, sas_source):
        """The regression guard from #16888: casHost=None must not end
        up in the CreateTableRequest extension."""
        results = self._run_create_table_entity(sas_source)

        create_requests = [r.right for r in results if r.right is not None and isinstance(r.right, CreateTableRequest)]
        assert create_requests, f"No CreateTableRequest yielded: {results}"
        request = create_requests[0]
        assert request.extension is not None
        extension = request.extension.root
        assert "casHost" not in extension, (
            "Null casHost must be stripped so the backend does not reject the create with 'null found, string expected'"
        )
        # Non-null custom attributes should still be kept.
        assert extension.get("CASLIB") == "PUBLIC"
        assert extension.get("engineName") == "V9"


class TestSinkFailureGuard:
    """After yielding the CreateTableRequest, the source must tolerate
    the table not existing (e.g. because the sink rejected the create)."""

    def test_missing_table_after_yield_does_not_raise_attribute_error(self, sas_source):
        """Simulates the log in #16888: get_by_name returns None after the
        yield because the sink 400'd. We must NOT crash on `None.id`."""
        sas_source.sas_client = MagicMock()
        sas_source.sas_client.get_information_catalog_link.return_value = "http://sas/catalog/LAS_TRAIN"
        sas_source.metadata = MagicMock()
        # Two get_by_name calls:
        #   1. Check-before-create → None (table does not exist yet)
        #   2. Re-fetch after yield → None (sink rejected create)
        sas_source.metadata.get_by_name.return_value = None

        with (
            patch.object(
                SasSource,
                "get_entities_using_view",
                return_value=(LAS_TRAIN_VIEW["entities"], LAS_TRAIN_VIEW["entities"][0]),
            ),
            patch.object(
                SasSource,
                "create_database_schema",
                return_value=MagicMock(fullyQualifiedName="cas.49736234.PUBLIC"),
            ),
            patch.object(SasSource, "create_lineage_table_source", return_value=iter([])),
        ):
            results = list(sas_source.create_table_entity(LAS_TRAIN_SEARCH_HIT))

        # The CreateTableRequest must still be yielded (the sink will
        # record its own failure); the source itself must NOT yield a
        # StackTraceError (AttributeError) on the follow-up patch calls.
        stack_trace_errors = [r for r in results if r.left is not None]
        assert not stack_trace_errors, (
            f"Source should not raise after sink-side failure, got: {[e.left.error for e in stack_trace_errors]}"
        )
        # The PATCH/profile calls must not have been invoked because we
        # returned early.
        sas_source.metadata.client.patch.assert_not_called()
        sas_source.metadata.client.put.assert_not_called()


class TestExceptionHandlerSafety:
    """The bare except used to reference `table_name` which could be
    undefined if the exception fired before it was assigned."""

    def test_exception_before_table_name_assigned_yields_stack_trace(self, sas_source):
        """If get_entities_using_view throws, `table_name` is not set.
        The except block must still produce a valid StackTraceError
        (previously raised UnboundLocalError)."""
        sas_source.sas_client = MagicMock()
        sas_source.sas_client.get_information_catalog_link.return_value = "url"
        sas_source.metadata = MagicMock()

        with patch.object(
            SasSource,
            "get_entities_using_view",
            side_effect=HTTPError("boom"),
        ):
            results = list(sas_source.create_table_entity(LAS_TRAIN_SEARCH_HIT))

        errors = [r.left for r in results if r.left is not None]
        assert len(errors) == 1
        error = errors[0]
        # Falls back to the search-hit's name (not an UnboundLocalError).
        assert error.name == "LAS_TRAIN"
        assert "boom" in error.error

    def test_exception_with_non_dict_table_yields_unknown_name(self, sas_source):
        """Defensive: even if `table` is not a dict, the except block
        should still produce a valid StackTraceError."""
        sas_source.sas_client = MagicMock()
        sas_source.sas_client.get_information_catalog_link.side_effect = RuntimeError("kaboom")
        sas_source.metadata = MagicMock()

        results = list(sas_source.create_table_entity({"id": "abc"}))

        errors = [r.left for r in results if r.left is not None]
        assert len(errors) == 1
        # Without a "name" in the search hit, we fall back to the id.
        assert errors[0].name == "abc"
