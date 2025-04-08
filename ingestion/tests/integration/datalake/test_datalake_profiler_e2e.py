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
Test Datalake Profiler workflow

To run this we need OpenMetadata server up and running.

No sample data is required beforehand
"""
import pytest

from metadata.generated.schema.entity.data.table import ColumnProfile, Table
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.profiler import ProfilerWorkflow
from metadata.workflow.workflow_output_handler import WorkflowResultStatus

from .conftest import BUCKET_NAME


@pytest.fixture(scope="class", autouse=True)
def before_each(run_ingestion):
    pass


class TestDatalakeProfilerTestE2E:
    """datalake profiler E2E test"""

    def test_datalake_profiler_workflow(self, ingestion_config, metadata):
        ingestion_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
            }
        )
        ingestion_config["processor"] = {
            "type": "orm-profiler",
            "config": {},
        }

        profiler_workflow = ProfilerWorkflow.create(ingestion_config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == WorkflowResultStatus.SUCCESS

        table_profile = metadata.get_profile_data(
            f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"',
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
        )

        column_profile = metadata.get_profile_data(
            f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv".first_name',
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
            profile_type=ColumnProfile,
        )

        assert table_profile.entities
        assert column_profile.entities

    def test_values_partitioned_datalake_profiler_workflow(
        self, metadata, ingestion_config
    ):
        """Test partitioned datalake profiler workflow"""
        ingestion_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
            }
        )
        ingestion_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "tableConfig": [
                    {
                        "fullyQualifiedName": f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"',
                        "partitionConfig": {
                            "enablePartitioning": "true",
                            "partitionColumnName": "first_name",
                            "partitionIntervalType": "COLUMN-VALUE",
                            "partitionValues": ["John"],
                        },
                    }
                ]
            },
        }

        profiler_workflow = ProfilerWorkflow.create(ingestion_config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == WorkflowResultStatus.SUCCESS

        table = metadata.get_by_name(
            entity=Table,
            fqn=f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"',
            fields=["tableProfilerConfig"],
            nullable=False,
        )

        profile = metadata.get_latest_table_profile(table.fullyQualifiedName)
        table_profile = profile.profile
        column_profile = profile.columns[0].profile

        assert table_profile.rowCount == 1.0
        assert column_profile.valuesCount == 1.0

    def test_datetime_partitioned_datalake_profiler_workflow(
        self, ingestion_config, metadata
    ):
        """Test partitioned datalake profiler workflow"""
        ingestion_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
            }
        )
        ingestion_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "tableConfig": [
                    {
                        "fullyQualifiedName": f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"',
                        "partitionConfig": {
                            "enablePartitioning": "true",
                            "partitionColumnName": "birthdate",
                            "partitionIntervalType": "TIME-UNIT",
                            "partitionIntervalUnit": "YEAR",
                            "partitionInterval": 35,
                        },
                    }
                ],
            },
        }

        profiler_workflow = ProfilerWorkflow.create(ingestion_config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == WorkflowResultStatus.SUCCESS

        table = metadata.get_by_name(
            entity=Table,
            fqn=f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"',
            fields=["tableProfilerConfig"],
        )

        profile = metadata.get_latest_table_profile(table.fullyQualifiedName)
        table_profile = profile.profile
        column_profile = profile.columns[0].profile

        assert table_profile.rowCount == 2.0
        assert column_profile.valuesCount == 2.0

    def test_integer_range_partitioned_datalake_profiler_workflow(
        self, ingestion_config, metadata
    ):
        """Test partitioned datalake profiler workflow"""
        ingestion_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
            }
        )
        ingestion_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "tableConfig": [
                    {
                        "fullyQualifiedName": f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"',
                        "profileSample": 100,
                        "partitionConfig": {
                            "enablePartitioning": "true",
                            "partitionColumnName": "age",
                            "partitionIntervalType": "INTEGER-RANGE",
                            "partitionIntegerRangeStart": 35,
                            "partitionIntegerRangeEnd": 44,
                        },
                    }
                ],
            },
        }

        profiler_workflow = ProfilerWorkflow.create(ingestion_config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == WorkflowResultStatus.SUCCESS

        table = metadata.get_by_name(
            entity=Table,
            fqn=f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"',
            fields=["tableProfilerConfig"],
        )

        profile = metadata.get_latest_table_profile(table.fullyQualifiedName)
        table_profile = profile.profile
        column_profile = profile.columns[0].profile

        assert table_profile.rowCount == 2.0
        assert column_profile.valuesCount == 2.0

    def test_datalake_profiler_workflow_with_custom_profiler_config(
        self, metadata, ingestion_config
    ):
        """Test custom profiler config return expected sample and metric computation"""
        profiler_metrics = [
            "MIN",
            "MAX",
            "MEAN",
            "MEDIAN",
        ]
        id_metrics = ["MIN", "MAX"]
        non_metric_values = ["name", "timestamp"]

        ingestion_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
            }
        )
        ingestion_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "profiler": {
                    "name": "ingestion_profiler",
                    "metrics": profiler_metrics,
                },
                "tableConfig": [
                    {
                        "fullyQualifiedName": f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"',
                        "columnConfig": {
                            "includeColumns": [
                                {"columnName": "id", "metrics": id_metrics},
                                {"columnName": "age"},
                            ]
                        },
                    }
                ],
            },
        }

        profiler_workflow = ProfilerWorkflow.create(ingestion_config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == WorkflowResultStatus.SUCCESS

        table = metadata.get_by_name(
            entity=Table,
            fqn=f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv"',
            fields=["tableProfilerConfig"],
        )

        id_profile = metadata.get_profile_data(
            f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv".id',
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
            profile_type=ColumnProfile,
        ).entities

        latest_id_profile = max(id_profile, key=lambda o: o.timestamp.root)

        id_metric_ln = 0
        for metric_name, metric in latest_id_profile:
            if metric_name.upper() in id_metrics:
                assert metric is not None
                id_metric_ln += 1
            else:
                assert metric is None if metric_name not in non_metric_values else True

        assert id_metric_ln == len(id_metrics)

        age_profile = metadata.get_profile_data(
            f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv".age',
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
            profile_type=ColumnProfile,
        ).entities

        latest_age_profile = max(age_profile, key=lambda o: o.timestamp.root)

        age_metric_ln = 0
        for metric_name, metric in latest_age_profile:
            if metric_name.upper() in profiler_metrics:
                assert metric is not None
                age_metric_ln += 1
            else:
                assert metric is None if metric_name not in non_metric_values else True

        assert age_metric_ln == len(profiler_metrics)

        latest_exc_timestamp = latest_age_profile.timestamp.root
        first_name_profile = metadata.get_profile_data(
            f'{ingestion_config["source"]["serviceName"]}.default.{BUCKET_NAME}."profiler_test_.csv".first_name_profile',
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
            profile_type=ColumnProfile,
        ).entities

        assert not [
            p for p in first_name_profile if p.timestamp.root == latest_exc_timestamp
        ]

        ingestion_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "AutoClassification",
                "storeSampleData": True,
                "enableAutoClassification": False,
            }
        )

        auto_workflow = AutoClassificationWorkflow.create(ingestion_config)
        auto_workflow.execute()
        status = auto_workflow.result_status()
        auto_workflow.stop()

        assert status == WorkflowResultStatus.SUCCESS

        sample_data = metadata.get_sample_data(table)
        assert sorted([c.root for c in sample_data.sampleData.columns]) == sorted(
            ["id", "age"]
        )
