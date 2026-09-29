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
"""End-to-end ingestion for one custom connector per service type.

Custom connectors resolve their source class from ``sourcePythonClass`` and read
no external system, so these need a running OpenMetadata server and nothing else.
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass, field

import custom_database
import custom_pipeline
import pytest

from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.directory import Directory
from metadata.generated.schema.entity.data.file import File
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline, StatusType
from metadata.generated.schema.entity.data.searchIndex import SearchIndex
from metadata.generated.schema.entity.data.spreadsheet import Spreadsheet
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.data.worksheet import Worksheet
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.driveService import DriveService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.services.searchService import SearchService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.ingestion.ometa.utils import model_str
from metadata.workflow.metadata import MetadataWorkflow


@dataclass(frozen=True)
class ConnectorSpec:
    """One custom connector: how to run it and what it must have produced."""

    key: str
    source_type: str
    connection_type: str
    source_python_class: str
    source_config_type: str
    service_entity: type
    entities: list[tuple[type, str]]
    checks: dict[str, Callable] = field(default_factory=dict)


SPECS = [
    ConnectorSpec(
        key="database",
        source_type="custom-database",
        connection_type="CustomDatabase",
        source_python_class="custom_database.CustomDatabaseSource",
        source_config_type="DatabaseMetadata",
        service_entity=DatabaseService,
        entities=[
            (Database, "my_catalog"),
            (DatabaseSchema, "my_catalog.my_schema"),
            (DatabaseSchema, "my_catalog.my_other_schema"),
            (Table, "my_catalog.my_schema.customers"),
            (Table, "my_catalog.my_schema.orders"),
            (Table, "my_catalog.my_other_schema.daily_revenue"),
            (StoredProcedure, f"my_catalog.my_other_schema.{custom_database.STORED_PROCEDURE}"),
        ],
        checks={
            "my_catalog.my_schema.customers": lambda t: (
                [model_str(c.name) for c in t.columns] == ["customer_id", "email", "created_at"]
                and all(c.description for c in t.columns)
            ),
        },
    ),
    ConnectorSpec(
        key="dashboard",
        source_type="custom-dashboard",
        connection_type="CustomDashboard",
        source_python_class="custom_dashboard.CustomDashboardSource",
        source_config_type="DashboardMetadata",
        service_entity=DashboardService,
        entities=[
            (Chart, "revenue_by_month"),
            (Chart, "orders_by_region"),
            (DashboardDataModel, "model.my_revenue_model"),
            (Dashboard, "my_sales_overview"),
        ],
        checks={
            "model.my_revenue_model": lambda m: (
                [model_str(c.name) for c in m.columns] == ["day", "revenue"] and all(c.description for c in m.columns)
            ),
        },
    ),
    ConnectorSpec(
        key="messaging",
        source_type="custom-messaging",
        connection_type="CustomMessaging",
        source_python_class="custom_messaging.CustomMessagingSource",
        source_config_type="MessagingMetadata",
        service_entity=MessagingService,
        entities=[(Topic, "my_orders_topic"), (Topic, "my_clickstream_topic")],
        checks={
            "my_orders_topic": lambda t: (
                t.partitions == 3
                and [model_str(f.name) for f in t.messageSchema.schemaFields] == ["event_id", "event_ts"]
                and all(f.description for f in t.messageSchema.schemaFields)
            ),
        },
    ),
    ConnectorSpec(
        key="mlmodel",
        source_type="custom-mlmodel",
        connection_type="CustomMlModel",
        source_python_class="custom_mlmodel.CustomMlModelSource",
        source_config_type="MlModelMetadata",
        service_entity=MlModelService,
        entities=[(MlModel, "my_churn_classifier")],
        checks={
            "my_churn_classifier": lambda m: (
                m.algorithm == "GradientBoostingClassifier"
                and [model_str(f.name) for f in m.mlFeatures] == ["tenure_months", "plan_tier"]
                and all(f.description for f in m.mlFeatures)
                and [model_str(h.name) for h in m.mlHyperParameters] == ["n_estimators", "max_depth"]
                and all(h.description for h in m.mlHyperParameters)
            ),
        },
    ),
    ConnectorSpec(
        key="pipeline",
        source_type="custom-pipeline",
        connection_type="CustomPipeline",
        source_python_class="custom_pipeline.CustomPipelineSource",
        source_config_type="PipelineMetadata",
        service_entity=PipelineService,
        entities=[(Pipeline, "my_daily_etl")],
        checks={
            "my_daily_etl": lambda p: (
                [model_str(t.name) for t in p.tasks] == ["extract", "transform", "load"]
                and all(t.description for t in p.tasks)
            ),
        },
    ),
    ConnectorSpec(
        key="search",
        source_type="custom-search",
        connection_type="CustomSearch",
        source_python_class="custom_search.CustomSearchSource",
        source_config_type="SearchMetadata",
        service_entity=SearchService,
        entities=[(SearchIndex, "my_product_index"), (SearchIndex, "my_customer_index")],
        checks={
            "my_product_index": lambda i: (
                [model_str(f.name) for f in i.fields] == ["product_id", "title", "price"]
                and all(f.description for f in i.fields)
            ),
        },
    ),
    ConnectorSpec(
        key="storage",
        source_type="custom-storage",
        connection_type="CustomStorage",
        source_python_class="custom_storage.CustomStorageSource",
        source_config_type="StorageMetadata",
        service_entity=StorageService,
        entities=[(Container, "my_bucket"), (Container, "my_bucket.my_prefix")],
        checks={
            "my_bucket.my_prefix": lambda c: (
                [model_str(col.name) for col in c.dataModel.columns] == ["event_id", "event_ts"]
                and all(col.description for col in c.dataModel.columns)
            ),
        },
    ),
    ConnectorSpec(
        key="drive",
        source_type="custom-drive",
        connection_type="CustomDrive",
        source_python_class="custom_drive.CustomDriveSource",
        source_config_type="DriveMetadata",
        service_entity=DriveService,
        entities=[
            (Directory, "my_directory"),
            (File, 'my_directory."my_report.csv"'),
            (Spreadsheet, "my_spreadsheet"),
            (Worksheet, "my_spreadsheet.my_worksheet"),
        ],
        checks={
            "my_spreadsheet.my_worksheet": lambda w: (
                [model_str(c.name) for c in w.columns] == ["day", "revenue"] and all(c.description for c in w.columns)
            ),
        },
    ),
]

SPEC_BY_KEY = {spec.key: spec for spec in SPECS}


def build_config(spec: ConnectorSpec, service_name: str, workflow_config: dict, sink_config: dict) -> dict:
    return {
        "source": {
            "type": spec.source_type,
            "serviceName": service_name,
            "serviceConnection": {
                "config": {
                    "type": spec.connection_type,
                    "sourcePythonClass": spec.source_python_class,
                }
            },
            "sourceConfig": {"config": {"type": spec.source_config_type}},
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture
def ingested_service(metadata, workflow_config, sink_config):
    """Run one custom connector against a fresh service and clean it up afterwards."""
    created = []

    def _run(spec: ConnectorSpec) -> tuple[str, MetadataWorkflow]:
        service_name = f"custom_{spec.key}_{uuid.uuid4().hex[:8]}"
        # Registered before the run: a workflow that fails partway may still have
        # created the service, and teardown has to reclaim it either way.
        created.append((spec.service_entity, service_name))
        workflow = MetadataWorkflow.create(build_config(spec, service_name, workflow_config, sink_config))
        workflow.execute()
        workflow.raise_from_status()
        return service_name, workflow

    yield _run

    for service_entity, service_name in created:
        service = metadata.get_by_name(entity=service_entity, fqn=service_name)
        if service:
            metadata.delete(entity=service_entity, entity_id=service.id, recursive=True, hard_delete=True)


@pytest.mark.parametrize("spec", SPECS, ids=lambda spec: spec.key)
def test_custom_connector_ingests_entities(spec, metadata, ingested_service):
    service_name, workflow = ingested_service(spec)

    for entity_type, suffix in spec.entities:
        fqn = f"{service_name}.{suffix}"
        entity = metadata.get_by_name(entity=entity_type, fqn=fqn, fields=["*"])
        assert entity is not None, f"{entity_type.__name__} {fqn} was not ingested"
        assert model_str(entity.fullyQualifiedName) == fqn
        assert entity.description, f"{entity_type.__name__} {fqn} lost its description"
        check = spec.checks.get(suffix)
        if check:
            assert check(entity), f"{entity_type.__name__} {fqn} lost fields on the way to the API"

    source_status = workflow.source.get_status()
    assert source_status.failures == []
    assert source_status.warnings == []
    assert workflow.steps[0].get_status().failures == []


@pytest.mark.parametrize("spec", SPECS, ids=lambda spec: spec.key)
def test_custom_connector_describes_its_service(spec, metadata, ingested_service):
    """A custom connector builds its own service request, so it can set fields the
    shared get_create_service_from_source helper leaves empty."""
    service_name, _ = ingested_service(spec)

    service = metadata.get_by_name(entity=spec.service_entity, fqn=service_name)
    assert service is not None
    assert service.serviceType.value == spec.connection_type
    assert service.description, "service description was dropped"
    assert service.displayName, "service displayName was dropped"


def test_custom_database_tags_its_tables(metadata, ingested_service):
    service_name, _ = ingested_service(SPEC_BY_KEY["database"])

    table = metadata.get_by_name(
        entity=Table,
        fqn=f"{service_name}.my_catalog.my_schema.orders",
        fields=["tags"],
    )
    assert [model_str(tag.tagFQN) for tag in table.tags] == [custom_database.TAG_FQN]


def test_custom_database_emits_lineage(metadata, ingested_service):
    """Lineage is resolved by FQN, which only works because the connector yields a
    Barrier to flush the sink's bulk buffer before the lineage record."""
    service_name, _ = ingested_service(SPEC_BY_KEY["database"])

    downstream_fqn = f"{service_name}.my_catalog.{custom_database.LINEAGE_TO}"
    lineage = metadata.client.get(f"/lineage/table/name/{downstream_fqn}?upstreamDepth=1&downstreamDepth=0")

    upstream_names = [node["fullyQualifiedName"] for node in lineage.get("nodes") or []]
    assert upstream_names == [f"{service_name}.my_catalog.{custom_database.LINEAGE_FROM}"]
    assert len(lineage.get("upstreamEdges") or []) == 1


def test_custom_dashboard_links_charts_and_data_model(metadata, ingested_service):
    service_name, _ = ingested_service(SPEC_BY_KEY["dashboard"])

    dashboard = metadata.get_by_name(
        entity=Dashboard,
        fqn=f"{service_name}.my_sales_overview",
        fields=["charts", "dataModels"],
    )
    assert sorted(model_str(chart.fullyQualifiedName) for chart in dashboard.charts.root) == [
        f"{service_name}.orders_by_region",
        f"{service_name}.revenue_by_month",
    ]
    assert [model_str(model.fullyQualifiedName) for model in dashboard.dataModels.root] == [
        f"{service_name}.model.my_revenue_model"
    ]


def test_custom_messaging_attaches_sample_data(metadata, ingested_service):
    service_name, _ = ingested_service(SPEC_BY_KEY["messaging"])

    topic = metadata.get_by_name(entity=Topic, fqn=f"{service_name}.my_orders_topic")
    # Sample data is not returned as an entity field; it has its own endpoint.
    with_sample_data = metadata.get_topic_sample_data(topic)
    assert with_sample_data.sampleData is not None, "topic sample data was not ingested"
    assert len(with_sample_data.sampleData.messages) == 2


def test_custom_pipeline_records_execution_status(metadata, ingested_service):
    service_name, _ = ingested_service(SPEC_BY_KEY["pipeline"])

    pipeline_fqn = f"{service_name}.my_daily_etl"
    statuses = metadata.client.get(
        f"/pipelines/{pipeline_fqn}/status"
        f"?startTs={custom_pipeline.RUN_TIMESTAMP - 1}&endTs={custom_pipeline.RUN_END_TIMESTAMP + 1}"
    )
    runs = statuses.get("data") or []
    assert len(runs) == 1
    assert runs[0]["executionStatus"] == StatusType.Successful.value
    assert [task["name"] for task in runs[0]["taskStatus"]] == ["extract", "transform", "load"]
