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
Tableau ingestion while the Metadata API is backfilling, end to end against a live server
(#16038). After a complete run, the store behind the Metadata API is rebuilt and has not
reached the Ops workbook yet, so its data model looks deleted to the connector.

Requires a server at http://localhost:8585.
"""

from collections.abc import Callable, Iterator

import pytest

from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.ingestion.api.step import WorkflowFatalError
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.workflow.metadata import MetadataWorkflow

from .conftest import FakeTableauSite, _workflow_config  # noqa: TID252

SERVICE = "tableau_backfill_it"
OPS_DATA_MODEL = f"{SERVICE}.model.ds-ops"
DATA_SOURCES = {
    workbook_id: [{"id": datasource_id, "name": name, "fields": [], "upstreamTables": [], "upstreamDatasources": []}]
    for workbook_id, datasource_id, name in [
        ("wb-sales", "ds-sales", "Sales Orders"),
        ("wb-ops", "ds-ops", "Incidents"),
    ]
}


def _config(**source_config) -> dict:
    config = _workflow_config(override_lineage=False)
    config["source"]["serviceName"] = SERVICE
    config["source"]["sourceConfig"]["config"].update(includeDataModels=True, **source_config)
    return config


def _delete_service(metadata) -> None:
    service = metadata.get_by_name(entity=DashboardService, fqn=SERVICE)
    if service:
        metadata.delete(entity=DashboardService, entity_id=service.id, recursive=True, hard_delete=True)


def _ops_data_model_is_live(metadata) -> bool:
    data_model = metadata.get_by_name(entity=DashboardDataModel, fqn=OPS_DATA_MODEL, include="all")
    return data_model is not None and not data_model.deleted


def _ops_dashboard_data_models(metadata) -> list[str]:
    dashboard = metadata.get_by_name(entity=Dashboard, fqn=f"{SERVICE}.wb-ops", fields=["dataModels"])
    return [reference.fullyQualifiedName for reference in dashboard.dataModels.root] if dashboard.dataModels else []


@pytest.fixture
def run_ingestion(run_workflow, monkeypatch) -> Callable[..., MetadataWorkflow]:
    """
    Runs the workflow as a scheduled run does, in a process of its own. The dashboard source
    keeps the entities it saw on the class, so a second run in this process would also count
    the ones the first run saw, and never find a data model stale.
    """

    def _run(**source_config) -> MetadataWorkflow:
        for seen in ("dashboard_source_state", "datamodel_source_state", "chart_source_state"):
            monkeypatch.setattr(DashboardServiceSource, seen, set())
        # The broken view fails every run, so the status is asserted instead of raised.
        return run_workflow(MetadataWorkflow, _config(**source_config), raise_from_status=False)

    return _run


@pytest.fixture
def backfilling_site(metadata, run_ingestion, tableau_site: FakeTableauSite) -> Iterator[FakeTableauSite]:
    """The site after a complete run has ingested both data models, once the backfill starts."""
    _delete_service(metadata)
    tableau_site.datasources = DATA_SOURCES
    run_ingestion()
    assert _ops_data_model_is_live(metadata)
    assert _ops_dashboard_data_models(metadata) == [OPS_DATA_MODEL]

    tableau_site.backfill_running = True
    tableau_site.not_indexed = {"wb-ops"}
    try:
        yield tableau_site
    finally:
        tableau_site.datasources, tableau_site.backfill_running, tableau_site.not_indexed = {}, False, set()
        _delete_service(metadata)


class TestIngestionDuringBackfill:
    def test_a_run_that_deletes_stale_data_models_fails_and_keeps_them(self, metadata, run_ingestion, backfilling_site):
        with pytest.raises(WorkflowFatalError, match="BACKFILL_RUNNING"):
            run_ingestion()

        assert _ops_data_model_is_live(metadata)
        assert _ops_dashboard_data_models(metadata) == [OPS_DATA_MODEL]

    def test_without_data_model_deletion_the_run_ingests_and_warns(self, metadata, run_ingestion, backfilling_site):
        """
        The cost the fatal message states for this setting: the Ops dashboard is sent without
        the data model the store has not reached, so it loses the link until a later run.
        """
        workflow = run_ingestion(markDeletedDataModels=False)

        assert [list(warning) for warning in workflow.source.status.warnings] == [["Tableau Metadata API"]]
        assert _ops_data_model_is_live(metadata)
        assert _ops_dashboard_data_models(metadata) == []
