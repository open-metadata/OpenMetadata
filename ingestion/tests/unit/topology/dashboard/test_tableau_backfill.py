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
Tableau rebuilds its Metadata API store after the API is enabled and after upgrades, which
can take up to a week. Until it finishes, every GraphQL response carries a BACKFILL_RUNNING
warning next to data that may be missing whole workbooks and data sources.

Data models are only read from that API. Reconciling them against a partial listing
soft-deletes data models that still exist in Tableau, and re-sending a dashboard with the
partial list unlinks the others (#16038). Workbooks and views come from the REST API and are
complete either way.
"""

from contextlib import contextmanager
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.ingestion.api.step import WorkflowFatalError
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.tableau.client import TableauClient
from metadata.ingestion.source.dashboard.tableau.metadata import TableauSource

CLIENT_MODULE = "metadata.ingestion.source.dashboard.tableau.client"
CONNECTION_MODULE = "metadata.ingestion.source.dashboard.tableau.connection"

# As Tableau returns it, quoted in #16038.
BACKFILL_RUNNING = {
    "message": "Still creating the Metadata API Store. Results from the query might be incomplete at this time.",
    "extensions": {"severity": "WARNING", "code": "BACKFILL_RUNNING"},
}

# The query every run opens with, before the first workbook is read.
CUSTOM_SQL_QUERY = "customSQLTables"

CUSTOM_SQL_TABLES = {
    "data": {
        "customSQLTables": [
            {
                "id": "cs-1",
                "name": "Custom SQL Query",
                "query": "SELECT * FROM orders",
                "downstreamDatasources": [{"id": "ds-wb-1", "name": "Orders wb-1"}],
            }
        ]
    }
}

SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="tableau_source_test",
    fullyQualifiedName="tableau_source_test",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Tableau,
)

TABLEAU_SOURCE = {
    "type": "tableau",
    "serviceName": "tableau_source_test",
    "serviceConnection": {
        "config": {
            "type": "Tableau",
            "authType": {"username": "username", "password": "abcdefg"},
            "hostPort": "http://tableauHost.com",
            "siteName": "site",
        }
    },
    "sourceConfig": {"config": {"type": "DashboardMetadata", "includeOwners": False, "includeTags": False}},
}


def datasources_of(workbook_id: str) -> dict:
    return {
        "data": {
            "workbooks": [
                {
                    "id": f"gql-{workbook_id}",
                    "luid": workbook_id,
                    "name": f"Workbook {workbook_id}",
                    "embeddedDatasourcesConnection": {
                        "nodes": [
                            {
                                "id": f"ds-{workbook_id}",
                                "name": f"Orders {workbook_id}",
                                "fields": [],
                                "upstreamTables": [],
                                "upstreamDatasources": [],
                            }
                        ],
                        "totalCount": 1,
                    },
                }
            ]
        }
    }


def tableau_server(
    workbook_ids: list[str],
    backfill_in: set[str] = frozenset(),
    not_indexed: set[str] = frozenset(),
) -> MagicMock:
    """
    A Tableau site whose Metadata API answers with BACKFILL_RUNNING, next to its data, for
    the queries in `backfill_in`: CUSTOM_SQL_QUERY, or a workbook id for its data sources.
    The store has not reached the workbooks in `not_indexed` yet, so it returns none of them.
    """
    server = MagicMock()
    server.workbooks.get.return_value = ([], SimpleNamespace(total_available=len(workbook_ids)))

    def query(query: str) -> dict:
        if CUSTOM_SQL_QUERY in query:
            key, response = CUSTOM_SQL_QUERY, CUSTOM_SQL_TABLES
        else:
            key = next(workbook_id for workbook_id in workbook_ids if f'luid: "{workbook_id}"' in query)
            response = {"data": {"workbooks": []}} if key in not_indexed else datasources_of(key)
        return {**response, "errors": [BACKFILL_RUNNING]} if key in backfill_in else response

    server.metadata.query.side_effect = query
    return server


def tableau_client(server: MagicMock) -> TableauClient:
    with patch(f"{CLIENT_MODULE}.Server", return_value=server):
        return TableauClient(
            tableau_server_auth=MagicMock(),
            config=SimpleNamespace(hostPort="http://tableauHost.com", apiVersion=None, siteName="site"),
            verify_ssl=False,
            pagination_limit=10,
        )


def om_client() -> MagicMock:
    metadata = MagicMock()
    metadata.config.forceEntityOverwriting = False
    metadata.get_create_service_from_source.return_value = CreateDashboardServiceRequest(
        name="tableau_source_test", serviceType=DashboardServiceType.Tableau
    )
    metadata.get_by_name.side_effect = lambda entity, *_, **__: SERVICE if entity is DashboardService else None
    return metadata


@contextmanager
def tableau_source(
    workbook_ids: list[str],
    backfill_in: set[str] = frozenset(),
    not_indexed: set[str] = frozenset(),
    **source_config,
):
    """The Tableau source over that site, with the REST listings served through Pager."""
    server = tableau_server(workbook_ids, backfill_in, not_indexed)
    workbooks = [
        SimpleNamespace(
            id=workbook_id,
            name=f"Workbook {workbook_id}",
            project_id="p-1",
            project_name="Sales",
            views=[
                SimpleNamespace(
                    id=f"v-{workbook_id}",
                    name=f"Sheet {workbook_id}",
                    tags=set(),
                    owner_id=None,
                    content_url=f"{workbook_id}/sheets/Sheet",
                    sheet_type="worksheet",
                    total_views=1,
                )
            ],
            owner_id=None,
            description=None,
            tags=set(),
            webpage_url=f"http://tableauHost.com/#/site/site/workbooks/{workbook_id}",
        )
        for workbook_id in workbook_ids
    ]
    config = deepcopy(TABLEAU_SOURCE)
    config["sourceConfig"]["config"].update(source_config)
    metadata = om_client()

    with (
        patch(f"{CONNECTION_MODULE}.get_connection", return_value=tableau_client(server)),
        patch.object(DashboardServiceSource, "test_connection"),
    ):
        source = TableauSource.create(config, metadata)
    with patch(
        f"{CLIENT_MODULE}.Pager",
        side_effect=lambda endpoint, *_: iter(workbooks if endpoint is server.workbooks else []),
    ):
        yield source, metadata


def created(records: list, request_type: type) -> list[str]:
    return [record.name.root for record in records if isinstance(record, request_type)]


def deleted_entity_types(metadata: MagicMock) -> set[type]:
    return {call.kwargs["entity"] for call in metadata.delete_stale_entities.call_args_list}


class TestBackfillDetection:
    def test_a_backfill_is_recorded_and_its_partial_data_kept(self):
        """
        The data next to the warning is still returned: it is all there is to ingest when
        data model deletion is off.
        """
        client = tableau_client(tableau_server(["wb-1"], backfill_in={"wb-1"}))

        datasources = client.get_datasources("wb-1")

        assert [datasource.id for datasource in datasources] == ["ds-wb-1"]
        assert client.metadata_api_backfill_running

    def test_the_query_a_run_opens_with_reports_it(self):
        client = tableau_client(tableau_server([], backfill_in={CUSTOM_SQL_QUERY}))

        client.cache_custom_sql_tables()

        assert client.get_custom_sql_table_queries("ds-wb-1") == ["SELECT * FROM orders"]
        assert client.metadata_api_backfill_running

    def test_a_complete_store_is_not_a_backfill(self):
        client = tableau_client(tableau_server(["wb-1"]))

        client.cache_custom_sql_tables()
        client.get_datasources("wb-1")

        assert not client.metadata_api_backfill_running

    def test_an_error_without_a_code_is_not_a_backfill(self):
        server = tableau_server(["wb-1"])
        server.metadata.query.side_effect = None
        server.metadata.query.return_value = {**datasources_of("wb-1"), "errors": [{"message": "Something failed"}]}
        client = tableau_client(server)

        datasources = client.get_datasources("wb-1")

        assert [datasource.id for datasource in datasources] == ["ds-wb-1"]
        assert not client.metadata_api_backfill_running


WORKBOOKS = ["wb-1", "wb-2", "wb-3"]
# Tableau reports the backfill on every query while it runs.
BACKFILL_EVERYWHERE = {CUSTOM_SQL_QUERY, *WORKBOOKS}


class TestIngestionDuringBackfill:
    """In each run the store has not reached wb-2 yet, so its data model looks deleted."""

    @pytest.mark.parametrize(
        "backfill_in, ingested",
        [
            pytest.param(BACKFILL_EVERYWHERE, [], id="reported before the first workbook"),
            pytest.param({"wb-2"}, ["wb-1"], id="first reported for the second workbook"),
        ],
    )
    def test_the_run_stops_and_fails_without_deleting(self, backfill_in, ingested):
        """
        With data model deletion on, nothing more is written once the store is known to be
        incomplete, including the dashboard whose data sources revealed it. The dashboard
        and chart listings stop there too, so nothing at all is marked deleted. The run
        fails whatever the success threshold, since every record it did send succeeded.
        """
        with tableau_source(WORKBOOKS, backfill_in, not_indexed={"wb-2"}) as (source, metadata):
            records = []
            with pytest.raises(WorkflowFatalError, match="BACKFILL_RUNNING") as error:
                records.extend(source.run())

        assert created(records, CreateDashboardRequest) == ingested
        assert created(records, CreateDashboardDataModelRequest) == [f"ds-{workbook}" for workbook in ingested]
        assert created(records, CreateChartRequest) == [f"v-{workbook}" for workbook in ingested]
        metadata.delete_stale_entities.assert_not_called()
        assert "markDeletedDataModels" in str(error.value), "the operator needs to know how to ingest anyway"
        assert [failure.name for failure in source.status.failures] == ["Tableau Metadata API"]

    @pytest.mark.parametrize(
        "source_config, data_models",
        [
            pytest.param({"markDeletedDataModels": False}, ["ds-wb-1", "ds-wb-3"], id="data model deletion off"),
            pytest.param({"includeDataModels": False}, [], id="data models not ingested"),
        ],
    )
    def test_without_data_model_reconciliation_the_partial_results_are_ingested(self, source_config, data_models):
        """
        Here the backfill cannot change what is deleted, so the run goes on and only warns;
        #16038 asks for the error only when deletion is on. Workbooks and views are complete,
        so their reconciliation still runs.
        """
        with tableau_source(WORKBOOKS, BACKFILL_EVERYWHERE, not_indexed={"wb-2"}, **source_config) as (
            source,
            metadata,
        ):
            records = list(source.run())

        assert created(records, CreateDashboardRequest) == WORKBOOKS
        assert created(records, CreateChartRequest) == [f"v-{workbook}" for workbook in WORKBOOKS]
        assert created(records, CreateDashboardDataModelRequest) == data_models
        assert {Dashboard, Chart} <= deleted_entity_types(metadata)
        assert source.status.failures == []
        assert [list(warning) for warning in source.status.warnings] == [["Tableau Metadata API"]]

    def test_a_complete_store_ingests_and_reconciles_as_before(self):
        with tableau_source(WORKBOOKS) as (source, metadata):
            records = list(source.run())

        assert created(records, CreateDashboardRequest) == WORKBOOKS
        assert created(records, CreateChartRequest) == ["v-wb-1", "v-wb-2", "v-wb-3"]
        assert created(records, CreateDashboardDataModelRequest) == ["ds-wb-1", "ds-wb-2", "ds-wb-3"]
        assert deleted_entity_types(metadata) == {Dashboard, DashboardDataModel, Chart}
        assert source.status.warnings == []
