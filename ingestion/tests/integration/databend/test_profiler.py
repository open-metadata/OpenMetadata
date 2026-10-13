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
"""Databend profiler and sampler integration tests."""

from copy import deepcopy

import pytest

from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow


@pytest.fixture(scope="module")
def ingest_databend_metadata(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
):
    search_cache.clear()
    return run_workflow(MetadataWorkflow, ingestion_config)


def _table_fqn(db_service) -> str:
    return f"{db_service.fullyQualifiedName.root}.default.analytics.customers"


def test_profiler_computes_databend_metrics(
    ingest_databend_metadata,
    run_workflow,
    profiler_config,
    db_service,
    metadata,
):
    run_workflow(ProfilerWorkflow, profiler_config)

    table = metadata.get_latest_table_profile(_table_fqn(db_service))
    id_profile = next(column.profile for column in table.columns if column.name.root == "id")

    assert table.profile is not None
    assert table.profile.rowCount == 100
    assert id_profile.min == 1
    assert id_profile.max == 100
    assert id_profile.median == 50.5
    assert id_profile.firstQuartile == 25.75
    assert id_profile.thirdQuartile == 75.25


def test_profiler_percentage_sampling(
    ingest_databend_metadata,
    run_workflow,
    profiler_config,
    db_service,
    metadata,
):
    config = deepcopy(profiler_config)
    config["source"]["sourceConfig"]["config"]["profileSampleConfig"] = {
        "sampleConfigType": "STATIC",
        "config": {
            "profileSample": 50,
            "profileSampleType": "PERCENTAGE",
        },
    }

    run_workflow(ProfilerWorkflow, config)

    table = metadata.get_latest_table_profile(_table_fqn(db_service))
    assert table.profile is not None
    assert table.profile.rowCount == 100
    assert table.profile.profileSample == 50.0
    assert table.profile.profileSampleType.root == ProfileSampleType.PERCENTAGE
