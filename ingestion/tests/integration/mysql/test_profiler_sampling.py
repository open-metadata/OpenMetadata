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

"""Integration tests for profiler sampling configurations (static, dynamic, dynamic+smart).
Requires a running OpenMetadata server and MySQL container.

Validates that the profiler workflow completes successfully with each sampling mode
and that profiles are stored with the resolved sampling configuration."""

from copy import deepcopy

from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow

TABLE_NAME = "employees"


def _get_table_fqn(db_service):
    return f"{db_service.fullyQualifiedName.root}.default.employees.{TABLE_NAME}"


def test_profiler_static_sampling(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    profiler_config,
    db_service,
    metadata,
):
    """Static sampling with 50% PERCENTAGE should complete and store a profile."""
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)

    config = deepcopy(profiler_config)
    config["source"]["sourceConfig"]["config"]["profileSampleConfig"] = {
        "sampleConfigType": "STATIC",
        "config": {
            "profileSample": 50,
            "profileSampleType": "PERCENTAGE",
        },
    }
    run_workflow(ProfilerWorkflow, config)

    table = metadata.get_latest_table_profile(_get_table_fqn(db_service))
    assert table is not None
    assert table.profile is not None
    assert table.profile.rowCount is not None
    assert table.profile.profileSample == 50.0
    assert table.profile.profileSampleType.root == ProfileSampleType.PERCENTAGE


def test_profiler_dynamic_smart_sampling(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    profiler_config,
    db_service,
    metadata,
):
    """Dynamic smart sampling: employees has ~300K rows → 100K < rows <= 1M → 50%."""
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)

    config = deepcopy(profiler_config)
    config["source"]["sourceConfig"]["config"]["profileSampleConfig"] = {
        "sampleConfigType": "DYNAMIC",
        "config": {
            "smartSampling": True,
        },
    }
    run_workflow(ProfilerWorkflow, config)

    table = metadata.get_latest_table_profile(_get_table_fqn(db_service))
    assert table is not None
    assert table.profile is not None
    assert table.profile.rowCount is not None
    # employees table has ~300K rows → 100K < rows <= 1M → 50%
    assert table.profile.profileSample == 50.0
    assert table.profile.profileSampleType.root == ProfileSampleType.PERCENTAGE


def test_profiler_dynamic_threshold_sampling(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    profiler_config,
    db_service,
    metadata,
):
    """Dynamic threshold: threshold at 1000 rows → 25%. Employees has ~300K rows."""
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)

    config = deepcopy(profiler_config)
    config["source"]["sourceConfig"]["config"]["profileSampleConfig"] = {
        "sampleConfigType": "DYNAMIC",
        "config": {
            "smartSampling": False,
            "thresholds": [
                {
                    "rowCountThreshold": 1000,
                    "profileSample": 25,
                    "profileSampleType": "PERCENTAGE",
                },
            ],
        },
    }
    run_workflow(ProfilerWorkflow, config)

    table = metadata.get_latest_table_profile(_get_table_fqn(db_service))
    assert table is not None
    assert table.profile is not None
    assert table.profile.rowCount is not None
    # employees table has ~300K rows >= threshold 1000 → 25%
    assert table.profile.profileSample == 25.0
    assert table.profile.profileSampleType.root == ProfileSampleType.PERCENTAGE
