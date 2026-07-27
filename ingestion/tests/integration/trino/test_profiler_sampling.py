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
Sampler-level integration tests for Trino dynamic sampling.
Tests _get_asset_row_count via SHOW STATS and dynamic sampling resolution.
Requires Trino multi-container stack (Trino + Hive MetaStore + MinIO + MySQL).
"""

from copy import deepcopy

from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow


def test_profiler_static_sampling(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    profiler_config,
    create_test_data,
    db_service,
    metadata,
):
    """Static 50% sampling via TABLESAMPLE should produce a valid profile."""
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

    # titanic table has 891 rows
    fqn = f"{db_service.fullyQualifiedName.root}.minio.my_schema.titanic"
    table = metadata.get_latest_table_profile(fqn)
    assert table.profile is not None
    assert table.profile.rowCount is not None
    assert table.profile.profileSample == 50.0
    assert table.profile.profileSampleType.root == ProfileSampleType.PERCENTAGE


def test_profiler_dynamic_smart_sampling(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    profiler_config,
    create_test_data,
    db_service,
    metadata,
):
    """Dynamic smart sampling: titanic has 891 rows → <=100K tier → 100%."""
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

    fqn = f"{db_service.fullyQualifiedName.root}.minio.my_schema.titanic"
    table = metadata.get_latest_table_profile(fqn)
    assert table.profile is not None
    assert table.profile.rowCount is not None
    # 891 rows → <=100K tier → 100% (no sampling)
    assert table.profile.profileSample == 100.0
    assert table.profile.profileSampleType.root == ProfileSampleType.PERCENTAGE


def test_profiler_dynamic_threshold_sampling(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    profiler_config,
    create_test_data,
    db_service,
    metadata,
):
    """Dynamic threshold: threshold at 100 rows → 25%. Titanic has 891 rows, should match."""
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)

    config = deepcopy(profiler_config)
    config["source"]["sourceConfig"]["config"]["profileSampleConfig"] = {
        "sampleConfigType": "DYNAMIC",
        "config": {
            "smartSampling": False,
            "thresholds": [
                {
                    "rowCountThreshold": 100,
                    "profileSample": 25,
                    "profileSampleType": "PERCENTAGE",
                },
            ],
        },
    }
    run_workflow(ProfilerWorkflow, config)

    fqn = f"{db_service.fullyQualifiedName.root}.minio.my_schema.titanic"
    table = metadata.get_latest_table_profile(fqn)
    assert table.profile is not None
    assert table.profile.rowCount is not None
    # 891 rows >= threshold 100 → 25%
    assert table.profile.profileSample == 25.0
    assert table.profile.profileSampleType.root == ProfileSampleType.PERCENTAGE
