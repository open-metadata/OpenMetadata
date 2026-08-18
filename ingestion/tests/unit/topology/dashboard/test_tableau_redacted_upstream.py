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
Tableau withholds source table metadata from accounts without Catalog permissions.

The Metadata API still returns the `upstreamTables` objects and keeps `id` and `luid`, but
nulls `name`, `fullName`, `schema` and `database.name`. Nothing can be resolved from that,
so lineage is empty for those tables while the run itself reports complete success.

The payloads below were captured from Tableau for one workbook and table, queried once as a
site admin and once as an Explorer.
"""

from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.dashboard.tableau.client import (
    MAX_SAMPLED_WORKBOOKS,
    TableauClient,
    TableauUpstreamTablesRedacted,
    TableauWorkBookException,
)
from metadata.ingestion.source.dashboard.tableau.models import (
    DataSource,
    TableauDatasources,
)

CLIENT_MODULE = "metadata.ingestion.source.dashboard.tableau.client"

# Captured live: what a site admin sees.
VISIBLE_TABLE = {
    "id": "b3ef7314-b9e5-900e-2869-41d858ab17a8",
    "luid": "b127038f-754c-48d0-892a-0ced6335f710",
    "name": "rpt_repro_transfer_out_mv",
    "fullName": "[reporting_prod].[finance].[rpt_repro_transfer_out_mv]",
    "schema": "finance",
    "database": {"id": "0f9b1efd-b968-d24c-f5e1-b3788b993cbe", "name": "reporting_prod"},
}

# Captured live: the same table, same workbook, seen by a restricted account.
REDACTED_TABLE = {
    "id": "b3ef7314-b9e5-900e-2869-41d858ab17a8",
    "luid": "b127038f-754c-48d0-892a-0ced6335f710",
    "name": None,
    "fullName": None,
    "schema": None,
    "database": {"id": "0f9b1efd-b968-d24c-f5e1-b3788b993cbe", "name": None},
}

# A custom SQL data source. The name is withheld the same way, but the query survives, and
# _get_database_tables resolves the table from it, so no lineage is lost.
QUERY_BACKED_TABLE = {
    **REDACTED_TABLE,
    "referencedByQueries": [
        {"id": "0f5a1c22-9d3e-4b71-8c6a-2e4f7b90d135", "name": "Custom SQL Query", "query": "SELECT 1"}
    ],
}

# Captured live: a sample workbook over a spreadsheet. An Explorer reads these names even
# when every database asset on the same site is withheld.
SPREADSHEET_TABLE = {
    "id": "5c9d2e77-1f4a-4a55-9a41-2a6f0b8d3c11",
    "luid": "7a1c3f90-6d2b-4e88-b0f4-95c7e2a41d63",
    "name": "Orders",
    "fullName": "[Sample - Superstore.xlsx].[Orders]",
    "schema": None,
    "database": {"id": "c41a7f65-3b2e-4d19-8f7a-1e5b9c0d2a48", "name": "Sample - Superstore.xlsx"},
}


@contextmanager
def fake_site(workbooks):
    """A TableauClient over a fake site. `workbooks` is [(name, datasources)] in Pager order."""
    with patch.object(TableauClient, "__init__", return_value=None):
        client = TableauClient()
    client.tableau_server = MagicMock()
    client._query_datasources = MagicMock(side_effect=[datasources for _, datasources in workbooks])

    items = []
    for index, (workbook_name, _) in enumerate(workbooks):
        item = MagicMock(id=f"wb-{index}")
        item.name = workbook_name
        items.append(item)

    with patch(f"{CLIENT_MODULE}.Pager", return_value=items):
        yield client


def datasources_with(tables, name="rpt_repro_transfer_out_mv (reporting_prod.finance)"):
    return TableauDatasources(
        nodes=[DataSource(id="ds-1", name=name, upstreamTables=tables)],
        totalCount=1,
    )


class TestGetSourceTablesCheck:
    def test_withheld_name_fails_the_check(self):
        """
        The whole point: lineage that cannot be built must not look healthy. The message
        has to name the data source and workbook, because the table has nothing left to
        identify it by.
        """
        with (
            fake_site([("Repro Databricks Lineage", datasources_with([REDACTED_TABLE]))]) as client,
            pytest.raises(TableauUpstreamTablesRedacted) as excinfo,
        ):
            client.test_get_source_tables()

        message = str(excinfo.value)
        assert "no name" in message
        assert "Repro Databricks Lineage" in message
        assert "rpt_repro_transfer_out_mv (reporting_prod.finance)" in message, (
            "an operator needs to know which data source is affected"
        )

    def test_named_tables_pass(self):
        with fake_site([("Repro", datasources_with([VISIBLE_TABLE]))]) as client:
            assert client.test_get_source_tables() is True

    def test_a_withheld_name_with_a_query_fallback_passes(self):
        """
        _get_database_tables resolves a nameless table through its referencedByQueries and
        the SQL lineage parser, so that table is not lost and there is nothing to report.
        """
        with fake_site([("Custom SQL", datasources_with([QUERY_BACKED_TABLE]))]) as client:
            assert client.test_get_source_tables() is True

    def test_no_upstream_tables_passes(self):
        """
        A workbook over an extract declares no source tables. There is nothing to judge,
        so this must not be reported as a permissions problem.
        """
        with fake_site([("Extract only", datasources_with([]))]) as client:
            assert client.test_get_source_tables() is True

    def test_a_readable_name_does_not_excuse_a_withheld_one(self):
        """
        View is granted per external asset, so a readable table proves nothing about the
        one next to it. The withheld table is lost lineage either way.
        """
        with (
            fake_site([("Mixed", datasources_with([VISIBLE_TABLE, REDACTED_TABLE]))]) as client,
            pytest.raises(TableauUpstreamTablesRedacted),
        ):
            client.test_get_source_tables()

    def test_a_spreadsheet_workbook_does_not_hide_a_later_blackout(self):
        """
        Observed live: an Explorer passed this check because the first workbook the API
        returned was a sample one over a spreadsheet, whose names it could read, while the
        Databricks backed workbook behind it was fully withheld. Sampling only the first
        workbook reported a healthy connection for an account that builds no lineage.
        """
        with (
            fake_site(
                [
                    ("Superstore", datasources_with([SPREADSHEET_TABLE], name="Sample - Superstore")),
                    ("Repro Databricks Lineage", datasources_with([REDACTED_TABLE])),
                ]
            ) as client,
            pytest.raises(TableauUpstreamTablesRedacted) as excinfo,
        ):
            client.test_get_source_tables()

        assert "Repro Databricks Lineage" in str(excinfo.value)

    def test_the_sample_is_capped(self):
        """
        Every test connection step shares one timeout, so a large site must not be read to
        the end just to confirm a healthy connection.
        """
        healthy = [(f"wb-{n}", datasources_with([VISIBLE_TABLE])) for n in range(50)]

        with fake_site(healthy) as client:
            assert client.test_get_source_tables() is True
            assert client._query_datasources.call_count == MAX_SAMPLED_WORKBOOKS

    def test_no_datasources_passes(self):
        with fake_site([("Empty", None)]) as client:
            assert client.test_get_source_tables() is True

    def test_no_workbooks_raises(self):
        with fake_site([]) as client, pytest.raises(TableauWorkBookException):
            client.test_get_source_tables()
