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
Unit tests for Unity Catalog table listing pagination.

Databricks rejects an unpaginated ListTables request once the result set grows
past a server threshold (`InvalidParameterValue ... Error code #UC-PGRQD`), so
the connector must always send `max_results` and let the SDK walk the pages.
The fake below reproduces that server contract rather than asserting on call
arguments, so it fails if the pagination parameter is ever dropped again.
"""

from functools import partial
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from databricks.sdk.errors.platform import InvalidParameterValue

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource

UC_METADATA_MODULE = "metadata.ingestion.source.database.unitycatalog.metadata"

SERVER_PAGE_SIZE = 2
TABLE_NAMES = ["tbl_a", "tbl_b", "tbl_c", "tbl_d", "tbl_e"]


class FakeTablesAPI:
    """`WorkspaceClient.tables` stand-in that enforces the real pagination contract
    and, like the SDK, hides the page walk behind a single iterator."""

    def __init__(self, table_names=None):
        self.table_names = TABLE_NAMES if table_names is None else table_names
        self.page_requests = 0

    def list(self, catalog_name, schema_name, max_results=None, **_):
        if max_results is None:
            raise InvalidParameterValue(
                "The ListTables result set is too large to return in a single "
                "response. Please adopt the paginated version of this API by "
                "setting max_results and paging through results with page_token. "
                "Error code #UC-PGRQD"
            )
        if max_results < 0:
            raise InvalidParameterValue("max_results must not be negative")
        # max_results=0 asks for the server-configured page size; a positive value
        # is clamped by the server, which SERVER_PAGE_SIZE emulates.
        page_length = (
            SERVER_PAGE_SIZE if max_results == 0 else min(max_results, SERVER_PAGE_SIZE)
        )
        start = 0
        while start < len(self.table_names):
            self.page_requests += 1
            for name in self.table_names[start : start + page_length]:
                yield SimpleNamespace(
                    name=name,
                    catalog_name=catalog_name,
                    schema_name=schema_name,
                    full_name=f"{catalog_name}.{schema_name}.{name}",
                    table_type=None,
                )
            start += page_length


def _make_source(tables_api):
    """A plain Mock used as `self`: the method under test only reads instance
    attributes assigned in __init__, which a spec'd Mock would not expose."""
    source = Mock()
    source.config.sourceConfig.config.useFqnForFiltering = False
    source.incremental.enabled = False
    source.incremental_table_processor = None
    source.client.tables = tables_api
    source.context.get.return_value = SimpleNamespace(
        database="cat", database_schema="schema1", database_service="svc"
    )
    # Real per-table processing: the assertions are about what reaches the
    # topology, not about the listing loop calling a collaborator.
    source._process_table = partial(UnitycatalogSource._process_table, source)
    return source


class TestUnityCatalogTablePagination:
    def test_all_pages_are_listed_without_pagination_error(self):
        tables_api = FakeTablesAPI()
        source = _make_source(tables_api)

        with (
            patch(f"{UC_METADATA_MODULE}.fqn") as fqn_mock,
            patch(f"{UC_METADATA_MODULE}.filter_by_table", return_value=False),
        ):
            fqn_mock.build.side_effect = (
                lambda *_, **kw: f"svc.cat.schema1.{kw['table_name']}"
            )
            result = list(UnitycatalogSource.get_tables_name_and_type(source))

        assert [name for name, _ in result] == TABLE_NAMES
        assert all(table_type == TableType.Regular for _, table_type in result)
        assert tables_api.page_requests == 3
        source.status.failed.assert_not_called()

    def test_unpaginated_listing_is_rejected_by_the_fake(self):
        """Guards the fake: without max_results the API errors, so the test above
        only passes because the connector paginates."""
        tables_api = FakeTablesAPI()

        with pytest.raises(InvalidParameterValue, match="UC-PGRQD"):
            list(tables_api.list(catalog_name="cat", schema_name="schema1"))
