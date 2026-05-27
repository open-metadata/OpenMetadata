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
Integration test for YDB view-lineage workflow.

Validates the DDL rewrite in ``YdbLineageSource.view_lineage_producer``:
the backtick-quoted slashed paths in YQL view definitions must resolve
to existing ``(schema, table)`` entities in OM so lineage edges land.
"""

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseLineageConfigType,
)
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture()
def lineage_config(db_service, workflow_config, sink_config):
    return {
        "source": {
            "type": "ydb-lineage",
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {"config": {"type": DatabaseLineageConfigType.DatabaseLineage.value}},
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


def test_view_lineage(
    patch_passwords_for_db_services,
    create_test_data,
    run_workflow,
    ingestion_config,
    lineage_config,
    metadata,
    db_service,
):
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(MetadataWorkflow, lineage_config)

    service = db_service.fullyQualifiedName.root

    # staging/events ← raw/events
    staging_edges = metadata.get_lineage_by_name(entity=Table, fqn=f"{service}./local.staging.events")
    edge_fqns = {n["fullyQualifiedName"] for n in staging_edges.get("nodes", [])}
    assert f"{service}./local.raw.events" in edge_fqns, (
        f"raw.events not upstream of staging.events; got nodes: {edge_fqns}"
    )

    # marts/analytics/events_by_user ← staging/events (two-segment schema name)
    marts_edges = metadata.get_lineage_by_name(
        entity=Table,
        fqn=f"{service}./local.marts/analytics.events_by_user",
    )
    marts_fqns = {n["fullyQualifiedName"] for n in marts_edges.get("nodes", [])}
    assert f"{service}./local.staging.events" in marts_fqns, (
        f"staging.events not upstream of marts/analytics.events_by_user; got nodes: {marts_fqns}"
    )
