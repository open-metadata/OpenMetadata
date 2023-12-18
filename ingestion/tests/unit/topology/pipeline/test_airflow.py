#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Test Airflow processing
"""
from unittest import TestCase

from metadata.ingestion.source.pipeline.airflow.models import (
    AirflowDag,
    AirflowDagDetails,
)
from metadata.ingestion.source.pipeline.airflow.utils import get_schedule_interval


class TestAirflow(TestCase):
    """
    Test Airflow model processing
    """

    def test_parsing(self):
        """
        We can properly pick up Airflow's payload and convert
        it to our models
        """

        serialized_dag = {
            "__version": 1,
            "dag": {
                "_dag_id": "test-lineage-253",
                "fileloc": "/opt/airflow/dags/lineage-test.py",
                "default_args": {
                    "__var": {
                        "owner": "airflow",
                        "depends_on_past": False,
                        "email": ["airflow@example.com"],
                        "email_on_failure": False,
                        "email_on_retry": False,
                        "retries": 1,
                        "retry_delay": {"__var": 1, "__type": "timedelta"},
                    },
                    "__type": "dict",
                },
                "timezone": "UTC",
                "catchup": False,
                "edge_info": {},
                "dataset_triggers": [],
                "_description": "An example DAG which simulate dbt run of fct_application_summary for airflow lineage backend",
                "_task_group": {
                    "_group_id": None,
                    "prefix_group_id": True,
                    "tooltip": "",
                    "ui_color": "CornflowerBlue",
                    "ui_fgcolor": "#000",
                    "children": {
                        "task0": ["operator", "task0"],
                        "task1": ["operator", "task1"],
                    },
                    "upstream_group_ids": [],
                    "downstream_group_ids": [],
                    "upstream_task_ids": [],
                    "downstream_task_ids": [],
                },
                "is_paused_upon_creation": False,
                "start_date": 1688860800,
                "schedule_interval": None,
                "_processor_dags_folder": "/opt/airflow/dags",
                "tasks": [
                    {
                        "owner": "airflow",
                        "retry_delay": 1,
                        "retries": 1,
                        "ui_color": "#e8f7e4",
                        "email": ["airflow@example.com"],
                        "task_id": "task0",
                        "email_on_failure": False,
                        "email_on_retry": False,
                        "pool": "default_pool",
                        "downstream_task_ids": ["task1"],
                        "template_ext": [],
                        "template_fields_renderers": {},
                        "inlets": [
                            {
                                "__var": {
                                    "tables": [
                                        "sample_data.ecommerce_db.shopify.dim_location"
                                    ]
                                },
                                "__type": "dict",
                            }
                        ],
                        "template_fields": [],
                        "ui_fgcolor": "#000",
                        "_task_type": "EmptyOperator",
                        "_task_module": "airflow.operators.empty",
                        "_is_empty": True,
                    },
                    {
                        "outlets": [
                            {
                                "__var": {
                                    "tables": [
                                        "sample_data.ecommerce_db.shopify.dim_staff"
                                    ]
                                },
                                "__type": "dict",
                            }
                        ],
                        "owner": "airflow",
                        "retry_delay": 1,
                        "retries": 1,
                        "ui_color": "#e8f7e4",
                        "email": ["airflow@example.com"],
                        "task_id": "task1",
                        "email_on_failure": False,
                        "email_on_retry": False,
                        "pool": "default_pool",
                        "downstream_task_ids": [],
                        "template_ext": [],
                        "template_fields_renderers": {},
                        "template_fields": [],
                        "ui_fgcolor": "#000",
                        "_task_type": "EmptyOperator",
                        "_task_module": "airflow.operators.empty",
                        "_is_empty": True,
                    },
                ],
                "dag_dependencies": [],
                "params": {},
            },
        }

        data = serialized_dag["dag"]

        dag = AirflowDagDetails(
            dag_id="id",
            fileloc="loc",
            data=AirflowDag.parse_obj(serialized_dag),
            max_active_runs=data.get("max_active_runs", None),
            description=data.get("_description", None),
            start_date=data.get("start_date", None),
            tasks=data.get("tasks", []),
            schedule_interval=None,
            owners=None,
        )

        self.assertEqual(
            dag.tasks[0].inlets,
            [
                {
                    "__var": {
                        "tables": ["sample_data.ecommerce_db.shopify.dim_location"]
                    },
                    "__type": "dict",
                }
            ],
        )
        self.assertEqual(
            dag.tasks[1].outlets,
            [
                {
                    "__var": {"tables": ["sample_data.ecommerce_db.shopify.dim_staff"]},
                    "__type": "dict",
                }
            ],
        )

    def test_get_schedule_interval(self):
        """
        Check the shape of different DAGs
        """

        pipeline_data = {"schedule_interval": None}
        self.assertIsNone(get_schedule_interval(pipeline_data))

        pipeline_data = {"schedule_interval": {"__var": 86400.0, "__type": "timedelta"}}
        self.assertEqual(get_schedule_interval(pipeline_data), "1 day, 0:00:00")

        pipeline_data = {
            "timetable": {
                "__type": "airflow.timetables.simple.OnceTimetable",
                "__var": {},
            }
        }
        self.assertEqual(get_schedule_interval(pipeline_data), "@once")

        pipeline_data = {
            "timetable": {
                "__type": "airflow.timetables.interval.CronDataIntervalTimetable",
                "__var": {"expression": "*/2 * * * *", "timezone": "UTC"},
            }
        }
        self.assertEqual(get_schedule_interval(pipeline_data), "*/2 * * * *")
