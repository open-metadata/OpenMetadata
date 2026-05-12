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
Integration tests for Datalake profiler with dynamic sampling configurations.
Tests static, dynamic smart, and dynamic threshold sampling via ProfilerWorkflow.
Requires a running OpenMetadata server and MinIO container.
"""

from copy import deepcopy

import pytest

from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.workflow.profiler import ProfilerWorkflow
from metadata.workflow.workflow_output_handler import WorkflowResultStatus

from .conftest import BUCKET_NAME  # noqa: TID252


@pytest.fixture(scope="class", autouse=True)
def _ingest_metadata(run_ingestion):
    """Ensure metadata ingestion runs before any profiler sampling test."""


class TestDatalakeProfilerSampling:
    """Datalake profiler dynamic sampling integration tests."""

    def test_static_percentage_sampling(self, ingestion_config, metadata):
        """Static 50% sampling should produce a successful profile."""
        config = deepcopy(ingestion_config)
        config["source"]["sourceConfig"]["config"].update({"type": "Profiler"})
        config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "tableConfig": [
                    {
                        "fullyQualifiedName": (
                            f'{config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"'
                        ),
                        "profileSampleConfig": {
                            "sampleConfigType": "STATIC",
                            "config": {
                                "profileSample": 50,
                                "profileSampleType": "PERCENTAGE",
                            },
                        },
                    }
                ]
            },
        }

        profiler_workflow = ProfilerWorkflow.create(config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == WorkflowResultStatus.SUCCESS

        fqn = f'{config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"'
        table = metadata.get_latest_table_profile(fqn)
        assert table.profile is not None
        assert table.profile.rowCount is not None
        assert table.profile.profileSample == 50.0
        assert table.profile.profileSampleType.root == ProfileSampleType.PERCENTAGE

    def test_dynamic_smart_sampling(self, ingestion_config, metadata):
        """Dynamic smart sampling: small CSV → <=100K tier → 100%."""
        config = deepcopy(ingestion_config)
        config["source"]["sourceConfig"]["config"].update({"type": "Profiler"})
        config["source"]["sourceConfig"]["config"]["profileSampleConfig"] = {
            "sampleConfigType": "DYNAMIC",
            "config": {
                "smartSampling": True,
            },
        }
        config["processor"] = {
            "type": "orm-profiler",
            "config": {},
        }

        profiler_workflow = ProfilerWorkflow.create(config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == WorkflowResultStatus.SUCCESS

        fqn = f'{config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"'
        table = metadata.get_latest_table_profile(fqn)
        assert table.profile is not None
        assert table.profile.rowCount is not None
        # Small CSV file → <=100K rows → smart sampling resolves to 100%
        assert table.profile.profileSample == 100.0
        assert table.profile.profileSampleType.root == ProfileSampleType.PERCENTAGE

    def test_dynamic_threshold_sampling(self, ingestion_config, metadata):
        """Dynamic threshold: threshold at 1 row → 50%. All tables should get 50% sampling."""
        config = deepcopy(ingestion_config)
        config["source"]["sourceConfig"]["config"].update({"type": "Profiler"})
        config["source"]["sourceConfig"]["config"]["profileSampleConfig"] = {
            "sampleConfigType": "DYNAMIC",
            "config": {
                "smartSampling": False,
                "thresholds": [
                    {
                        "rowCountThreshold": 1,
                        "profileSample": 50,
                        "profileSampleType": "PERCENTAGE",
                    },
                ],
            },
        }
        config["processor"] = {
            "type": "orm-profiler",
            "config": {},
        }

        profiler_workflow = ProfilerWorkflow.create(config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == WorkflowResultStatus.SUCCESS

        fqn = f'{config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"'
        table = metadata.get_latest_table_profile(fqn)
        assert table.profile is not None
        assert table.profile.rowCount is not None
        # Any table with >= 1 row should get 50% sampling
        assert table.profile.profileSample == 50.0
        assert table.profile.profileSampleType.root == ProfileSampleType.PERCENTAGE
