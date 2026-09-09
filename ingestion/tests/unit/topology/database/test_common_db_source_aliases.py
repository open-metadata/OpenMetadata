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

from unittest.mock import MagicMock, patch

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import TableType
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


def test_yield_table_includes_aliases_from_hook():
    """Verify that the aliases returned by get_table_aliases are included in the yielded CreateTableRequest."""
    # Expected aliases to be returned by the hook
    expected_aliases = ["svc.analytics_core.dbo.orders"]

    # Create a mock source with get_table_aliases returning the expected aliases
    source = MagicMock(spec=CommonDbSourceService)
    source.get_table_aliases.return_value = expected_aliases
    source.metadata = MagicMock()  # Need to mock metadata for fqn.build

    # Stub all the collaborators that yield_table calls
    source.get_columns_and_constraints.return_value = ([], [], {})
    source.get_schema_definition.return_value = None
    source.update_table_constraints.return_value = []
    source.normalize_table_constraints.return_value = []
    source.get_table_description.return_value = None
    source.get_tag_labels.return_value = []
    source.get_source_url.return_value = None
    source.get_owner_ref.return_value = None
    source.get_location_path.return_value = None
    source.get_table_extensions.return_value = None
    source.get_table_partition_details.return_value = (False, None)
    source.register_record.return_value = None
    source.inspector = MagicMock()

    # Stub context.get() to return required fields
    mock_context_value = MagicMock()
    mock_context_value.database = "test_db"
    mock_context_value.database_service = "test_service"
    mock_context_value.database_schema = "dbo"
    source.context.get.return_value = mock_context_value

    # Patch fqn.build to avoid needing a real metadata client
    with patch("metadata.ingestion.source.database.common_db_source.fqn.build") as mock_fqn_build:
        mock_fqn_build.return_value = "test_service.test_db.dbo"

        # Call yield_table
        results = list(CommonDbSourceService.yield_table(source, ("orders", TableType.Regular)))

    # Should have exactly one result (the CreateTableRequest)
    assert len(results) == 1
    result = results[0]

    # Result should be a right-hand Either (successful case)
    assert result.right is not None
    request = result.right

    # Verify that the aliases from the hook are in the request
    # Schema wraps aliases in FullyQualifiedEntityName, so we use model_str to extract the values
    assert [model_str(alias) for alias in request.aliases] == expected_aliases
