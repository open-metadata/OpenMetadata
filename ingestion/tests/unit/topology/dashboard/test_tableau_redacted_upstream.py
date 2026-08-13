#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Tableau withholds source table metadata from accounts without Catalog permissions.

The Metadata API still returns the `upstreamTables` objects and keeps `id` and `luid`, but
nulls `name`, `fullName`, `schema` and `database.name`. Nothing can be resolved from that,
so lineage is empty for the entire run while the run itself reports complete success.

The payloads below were captured from Tableau for one workbook and table, queried once as a
site admin and once as an Explorer.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.dashboard.tableau.client import (
    TableauClient,
    TableauUpstreamTablesRedacted,
)
from metadata.ingestion.source.dashboard.tableau.models import (
    DataSource,
    TableauDatasources,
)

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


def build_client(datasources):
    """A TableauClient whose only live behaviour is the upstream table check."""
    with patch.object(TableauClient, "__init__", lambda self, *a, **kw: None):
        client = TableauClient()
    client.test_get_workbooks = MagicMock(return_value=MagicMock(id="wb-1"))
    client._query_datasources = MagicMock(return_value=datasources)
    return client


def datasources_with(tables, name="rpt_repro_transfer_out_mv (reporting_prod.finance)"):
    return TableauDatasources(
        nodes=[DataSource(id="ds-1", name=name, upstreamTables=tables)],
        totalCount=1,
    )


class TestGetSourceTablesCheck:
    def test_redacted_names_fail_the_check(self):
        """
        The whole point: a run that produces no lineage at all must not look healthy.
        The message has to name the data source, because the table has nothing left to
        identify it by.
        """
        client = build_client(datasources_with([REDACTED_TABLE]))

        with pytest.raises(TableauUpstreamTablesRedacted) as excinfo:
            client.test_get_source_tables()

        message = str(excinfo.value)
        assert "no name" in message
        assert "rpt_repro_transfer_out_mv (reporting_prod.finance)" in message, (
            "an operator needs to know which data source is affected"
        )

    def test_named_tables_pass(self):
        client = build_client(datasources_with([VISIBLE_TABLE]))

        assert client.test_get_source_tables() is True

    def test_no_upstream_tables_passes(self):
        """
        A workbook over a spreadsheet or an extract declares no source tables. There is
        nothing to judge, so this must not be reported as a permissions problem.
        """
        client = build_client(datasources_with([]))

        assert client.test_get_source_tables() is True

    def test_partially_named_tables_pass(self):
        """
        If any name came through, the account can read Catalog assets and the missing one
        is a different problem. Only a total blackout indicates the permission gap.
        """
        client = build_client(datasources_with([VISIBLE_TABLE, REDACTED_TABLE]))

        assert client.test_get_source_tables() is True

    def test_no_datasources_passes(self):
        client = build_client(None)

        assert client.test_get_source_tables() is True
