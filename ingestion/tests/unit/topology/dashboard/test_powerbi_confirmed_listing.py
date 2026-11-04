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
PowerBI confirms it has nothing to ingest only after every fetch behind a listing succeeded and at
least one workspace was read. Only then does stale deletion send an empty run as authoritative, so
the server soft-deletes what earlier runs ingested.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource
from metadata.ingestion.source.dashboard.powerbi.models import (
    Dataset,
    Group,
    PowerBIDashboard,
    PowerBIReport,
    Workspaces,
)

SERVICE_NAME = "powerbi_listing"


def _source_config(connection: dict, pipeline: dict) -> dict:
    return {
        "type": "powerbi",
        "serviceName": SERVICE_NAME,
        "serviceConnection": {
            "config": {
                "type": "PowerBI",
                "clientId": "client_id",
                "clientSecret": "secret",
                "tenantId": "tenant_id",
                "useAdminApis": False,
                **connection,
            }
        },
        "sourceConfig": {"config": {"type": "DashboardMetadata", "includeOwners": False, **pipeline}},
    }


@pytest.fixture
def make_source():
    def _make(connection: dict | None = None, **pipeline) -> PowerbiSource:
        with (
            patch("metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"),
            patch("metadata.ingestion.source.dashboard.dashboard_service.create_connection") as create_connection,
        ):
            create_connection.return_value.client = False
            source = PowerbiSource.create(_source_config(connection or {}, pipeline), MagicMock())
        source.client = MagicMock()
        source.context.get = MagicMock(return_value=MagicMock(dashboard_service=SERVICE_NAME))
        # The real seen-sets are class attributes shared by every source in the process.
        source.dashboard_source_state = set()
        source.datamodel_source_state = set()
        return source

    return _make


def _org_api(source: PowerbiSource, workspaces, dashboards=(), reports=(), datasets=()) -> None:
    """Answer the non-admin fetches; `None` is how the API client reports a failed fetch."""
    api = source.client.api_client
    api.fetch_all_workspaces.return_value = workspaces
    api.fetch_all_org_dashboards.return_value = None if dashboards is None else list(dashboards)
    api.fetch_all_org_reports.return_value = None if reports is None else list(reports)
    api.fetch_all_org_datasets.return_value = None if datasets is None else list(datasets)
    api.fetch_all_org_tiles.return_value = []
    api.fetch_dataset_tables.return_value = []


def _admin_api(source: PowerbiSource, workspaces, scans) -> None:
    """Answer the admin fetches with one scan result per batch; `None` fails that batch's scan."""
    api = source.client.api_client
    api.fetch_all_workspaces.return_value = workspaces
    api.initiate_workspace_scan.side_effect = [None if scan is None else MagicMock(id="scan") for scan in scans]
    api.wait_for_scan_complete.return_value = True
    api.fetch_workspace_scan_result.side_effect = [scan for scan in scans if scan is not None]


def _run_workspaces(source: PowerbiSource) -> None:
    """Drive the workspace node as the topology runner does: each workspace's data model stage
    runs while get_dashboard is paused on that workspace."""
    for workspace in source.get_dashboard():
        list(source.yield_datamodel(workspace))


def _stale_delete_request(source: PowerbiSource, mark_deleted) -> dict:
    """Run a markDeleted step through the real OpenMetadata client and return the body it sent."""
    metadata = source.metadata
    metadata.get_suffix.return_value = "/stale"
    metadata.client.delete.return_value = {
        "status": "success",
        "numberOfRowsProcessed": 0,
        "numberOfRowsPassed": 0,
        "numberOfRowsFailed": 0,
    }
    metadata.delete_stale_entities = lambda **kwargs: OpenMetadata.delete_stale_entities(metadata, **kwargs)
    list(mark_deleted())
    return metadata.client.delete.call_args.kwargs["json"]


def test_workspaces_without_data_models_confirm_the_empty_run(make_source):
    source = make_source()
    _org_api(source, workspaces=[Group(id="ws-1", name="Sales")])

    _run_workspaces(source)

    body = _stale_delete_request(source, source.mark_datamodels_as_deleted)
    assert body["seenFqns"] == []
    assert body["allowEmptySeenFqns"] is True


def test_data_models_all_filtered_out_confirm_the_empty_run(make_source):
    source = make_source(dataModelFilterPattern={"includes": ["^Marketing$"]})
    _org_api(
        source,
        workspaces=[Group(id="ws-1", name="Sales")],
        datasets=[Dataset(id="ds-1", name="Revenue"), Dataset(id="ds-2", name="Costs")],
    )

    _run_workspaces(source)

    body = _stale_delete_request(source, source.mark_datamodels_as_deleted)
    assert body["seenFqns"] == []
    assert body["allowEmptySeenFqns"] is True


@pytest.mark.parametrize(
    "overrides",
    [{"workspaces": None}, {"workspaces": []}, {"datasets": None}],
    ids=["workspace-fetch-failed", "no-workspace-found", "dataset-fetch-failed"],
)
def test_unconfirmed_data_model_listing_keeps_the_empty_run_ambiguous(make_source, overrides):
    source = make_source()
    _org_api(source, **{"workspaces": [Group(id="ws-1", name="Sales")], **overrides})

    _run_workspaces(source)

    assert "allowEmptySeenFqns" not in _stale_delete_request(source, source.mark_datamodels_as_deleted)


def test_workspace_listing_short_of_its_count_keeps_the_empty_run_ambiguous(make_source):
    source = make_source()
    _org_api(source, workspaces=None)

    def list_short_of_the_count(filter_pattern, on_incomplete):
        on_incomplete()
        return [Group(id="ws-1", name="Sales")]

    source.client.api_client.fetch_all_workspaces.side_effect = list_short_of_the_count

    _run_workspaces(source)

    assert "allowEmptySeenFqns" not in _stale_delete_request(source, source.mark_datamodels_as_deleted)


def test_failed_project_filter_batch_keeps_the_empty_run_ambiguous(make_source):
    """More than ten include patterns are fetched in batches; a failed batch hides its workspaces."""
    source = make_source(projectFilterPattern={"includes": [f"^Team {index}$" for index in range(11)]})
    _org_api(source, workspaces=None)
    source.client.api_client.fetch_all_workspaces.side_effect = [None, [Group(id="ws-1", name="Team 10")]]

    _run_workspaces(source)

    assert "allowEmptySeenFqns" not in _stale_delete_request(source, source.mark_datamodels_as_deleted)


def test_failed_data_model_listing_keeps_the_empty_run_ambiguous(make_source):
    source = make_source()
    _org_api(source, workspaces=[Group(id="ws-1", name="Sales")])
    source._get_datamodels_list = MagicMock(side_effect=RuntimeError("boom"))

    _run_workspaces(source)

    assert "allowEmptySeenFqns" not in _stale_delete_request(source, source.mark_datamodels_as_deleted)


def test_failed_workspace_keeps_both_empty_runs_ambiguous(make_source):
    source = make_source()
    _org_api(source, workspaces=[Group(id="ws-1", name="Sales"), Group(id="ws-2", name="Finance")])
    source.get_dashboards_list = MagicMock(side_effect=[RuntimeError("boom"), []])

    _run_workspaces(source)

    assert "allowEmptySeenFqns" not in _stale_delete_request(source, source.mark_dashboards_as_deleted)
    assert "allowEmptySeenFqns" not in _stale_delete_request(source, source.mark_datamodels_as_deleted)


def test_skipped_data_models_keep_the_empty_run_ambiguous(make_source):
    source = make_source(includeDataModels=False)
    _org_api(source, workspaces=[Group(id="ws-1", name="Sales")])

    _run_workspaces(source)

    assert "allowEmptySeenFqns" not in _stale_delete_request(source, source.mark_datamodels_as_deleted)


def test_dashboards_all_filtered_out_confirm_the_empty_run(make_source):
    source = make_source(dashboardFilterPattern={"includes": ["^Marketing$"]})
    _org_api(
        source,
        workspaces=[Group(id="ws-1", name="Sales")],
        dashboards=[PowerBIDashboard(id="d-1", displayName="Revenue")],
        reports=[PowerBIReport(id="r-1", name="Costs")],
    )

    _run_workspaces(source)

    body = _stale_delete_request(source, source.mark_dashboards_as_deleted)
    assert body["seenFqns"] == []
    assert body["allowEmptySeenFqns"] is True


def test_failed_report_fetch_keeps_the_empty_dashboard_run_ambiguous(make_source):
    source = make_source()
    _org_api(source, workspaces=[Group(id="ws-1", name="Sales")], reports=None)

    _run_workspaces(source)

    assert "allowEmptySeenFqns" not in _stale_delete_request(source, source.mark_dashboards_as_deleted)


def test_admin_scan_without_data_models_confirms_the_empty_run(make_source):
    source = make_source(connection={"useAdminApis": True})
    _admin_api(
        source,
        workspaces=[Group(id="ws-1", name="Sales")],
        scans=[Workspaces(workspaces=[Group(id="ws-1", name="Sales", state="Active")])],
    )

    _run_workspaces(source)

    assert _stale_delete_request(source, source.mark_datamodels_as_deleted)["allowEmptySeenFqns"] is True


@pytest.mark.parametrize(
    "batch_size, scans",
    [
        (1, [None, Workspaces(workspaces=[Group(id="ws-2", name="Finance", state="Active")])]),
        (2, [Workspaces(workspaces=[Group(id="ws-1", name="Sales", state="Active")])]),
    ],
    ids=["scan-batch-failed", "workspace-missing-from-scan"],
)
def test_incomplete_admin_scan_keeps_the_empty_run_ambiguous(make_source, batch_size, scans):
    source = make_source(connection={"useAdminApis": True, "pagination_entity_per_page": batch_size})
    _admin_api(
        source,
        workspaces=[Group(id="ws-1", name="Sales"), Group(id="ws-2", name="Finance")],
        scans=scans,
    )

    _run_workspaces(source)

    assert "allowEmptySeenFqns" not in _stale_delete_request(source, source.mark_datamodels_as_deleted)
