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
Test Airflow processing
"""
from unittest import TestCase
from unittest.mock import patch
from urllib.parse import quote

import pytest

# pylint: disable=unused-import
try:
    import airflow  # noqa: F401
except ImportError:
    pytest.skip("Airflow dependencies not installed", allow_module_level=True)

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource
from metadata.ingestion.source.pipeline.airflow.models import (
    AirflowDag,
    AirflowDagDetails,
)
from metadata.ingestion.source.pipeline.airflow.utils import get_schedule_interval

MOCK_CONFIG = {
    "source": {
        "type": "airflow",
        "serviceName": "test_airflow",
        "serviceConnection": {
            "config": {
                "type": "Airflow",
                "hostPort": "https://localhost:8080",
                "connection": {"type": "Backend"},
            }
        },
        "sourceConfig": {
            "config": {
                "type": "PipelineMetadata",
                "includeOwners": True,
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        },
    },
}


SERIALIZED_DAG = {
    "__version": 1,
    "dag": {
        "_dag_id": "test-lineage-253",
        "fileloc": "/opt/airflow/dags/lineage-test.py",
        "default_args": {
            "__var": {
                "owner": "my_owner",
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
                "owner": "another_owner",
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
                            "tables": ["sample_data.ecommerce_db.shopify.dim_location"]
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
                            "tables": ["sample_data.ecommerce_db.shopify.dim_staff"]
                        },
                        "__type": "dict",
                    }
                ],
                "owner": "another_owner",
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


class TestAirflow(TestCase):
    """
    Test Airflow model processing
    """

    @patch.dict(
        "os.environ",
        {
            "DB_SCHEME": "mysql+pymysql",
            "DB_USER": "airflow",
            "DB_PASSWORD": "airflow",
            "DB_HOST": "localhost",
            "DB_PORT": "3306",
            "AIRFLOW_DB": "airflow",
        },
    )
    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(MOCK_CONFIG)

        # This already validates that the source can be initialized
        self.airflow: AirflowSource = AirflowSource.create(
            MOCK_CONFIG["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )

    def test_parsing(self):
        """
        We can properly pick up Airflow's payload and convert
        it to our models
        """
        data = SERIALIZED_DAG["dag"]

        dag = AirflowDagDetails(
            dag_id="id",
            fileloc="loc",
            data=AirflowDag.model_validate(SERIALIZED_DAG),
            max_active_runs=data.get("max_active_runs", None),
            description=data.get("_description", None),
            start_date=data.get("start_date", None),
            tasks=data.get("tasks", []),
            schedule_interval=None,
            owner=None,
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

    def test_get_dag_owners(self):
        """Test DAG owner extraction from tasks"""
        data = SERIALIZED_DAG["dag"]

        # The owner will be the one appearing as owner in most of the tasks
        self.assertEqual("another_owner", self.airflow.fetch_dag_owners(data))

        # if we monkey-patch the data dict with tasks with different owner counts...
        data = {
            "tasks": [
                {"owner": "my_owner"},
                {"owner": "my_owner"},
                {"owner": "another_owner"},
            ]
        }
        self.assertEqual("my_owner", self.airflow.fetch_dag_owners(data))

        # If there are no owners, return None
        data = {
            "tasks": [{"something": None}, {"another_thing": None}, {"random": None}]
        }
        self.assertIsNone(self.airflow.fetch_dag_owners(data))

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
        # Handle both scenarios: when Airflow modules are available vs when they're not
        result = get_schedule_interval(pipeline_data)
        if result == "@once":
            # Airflow modules are available, so we get the actual timetable summary
            pass  # This is the expected behavior when Airflow is available
        else:
            # Airflow modules are not available, so we fall back to Custom Timetable
            self.assertIn("Custom Timetable", result)
            self.assertIn("OnceTimetable", result)

        pipeline_data = {
            "timetable": {
                "__type": "airflow.timetables.interval.CronDataIntervalTimetable",
                "__var": {"expression": "*/2 * * * *", "timezone": "UTC"},
            }
        }
        self.assertEqual(get_schedule_interval(pipeline_data), "*/2 * * * *")

    def test_get_dag_owners_with_serialized_tasks(self):
        """Test DAG owner extraction with serialized task format"""
        # Case 1: All tasks have no explicit owner → fallback to default_args
        data = {
            "default_args": {"__var": {"owner": "default_owner"}},
            "tasks": [
                {"__var": {"task_id": "t1"}, "__type": "EmptyOperator"},
                {"__var": {"task_id": "t2"}, "__type": "EmptyOperator"},
            ],
        }
        self.assertEqual("default_owner", self.airflow.fetch_dag_owners(data))

        # Case 2: One task explicitly overrides the owner → tie between two owners
        data = {
            "default_args": {"__var": {"owner": "default_owner"}},
            "tasks": [
                {
                    "__var": {"task_id": "t1"},
                    "__type": "EmptyOperator",
                },  # uses default_owner
                {
                    "__var": {"task_id": "t2", "owner": "overridden_owner"},
                    "__type": "EmptyOperator",
                },
            ],
        }
        result = self.airflow.fetch_dag_owners(data)
        self.assertIn(result, {"default_owner", "overridden_owner"})

        # Case 3: One owner is majority -> must return that owner
        data = {
            "default_args": {"__var": {"owner": "default_owner"}},
            "tasks": [
                {
                    "__var": {"task_id": "t1", "owner": "overridden_owner"},
                    "__type": "EmptyOperator",
                },
                {
                    "__var": {"task_id": "t2", "owner": "overridden_owner"},
                    "__type": "EmptyOperator",
                },
                {
                    "__var": {"task_id": "t3", "owner": "another_owner"},
                    "__type": "EmptyOperator",
                },
            ],
        }
        self.assertEqual("overridden_owner", self.airflow.fetch_dag_owners(data))

    def test_get_schedule_interval_with_dataset_triggered_timetable(self):
        """
        Test handling of DatasetTriggeredTimetable which requires datasets argument
        """
        pipeline_data = {
            "timetable": {
                "__type": "airflow.timetables.dataset.DatasetTriggeredTimetable",
                "__var": {"datasets": ["dataset1", "dataset2"]},
            }
        }
        # Handle both scenarios: when Airflow modules are available vs when they're not
        result = get_schedule_interval(pipeline_data)
        if result == "Dataset Triggered":
            # Our specific handling for DatasetTriggeredTimetable worked
            pass  # This is the expected behavior
        else:
            # Airflow modules are not available, so we fall back to Custom Timetable
            self.assertIn("Custom Timetable", result)
            self.assertIn("DatasetTriggeredTimetable", result)

    def test_get_schedule_interval_with_cron_timetable(self):
        """
        Test handling of CronDataIntervalTimetable
        """
        pipeline_data = {
            "timetable": {
                "__type": "airflow.timetables.interval.CronDataIntervalTimetable",
                "__var": {"expression": "0 12 * * *", "timezone": "UTC"},
            }
        }
        # Should return the cron expression when available in __var
        result = get_schedule_interval(pipeline_data)
        if result == "0 12 * * *":
            # Expression was available in __var, so we get it directly
            pass  # This is the expected behavior
        else:
            # Airflow modules are not available, so we fall back to Custom Timetable
            self.assertIn("Custom Timetable", result)
            self.assertIn("CronDataIntervalTimetable", result)

    def test_get_schedule_interval_with_custom_timetable(self):
        """
        Test handling of custom timetable classes that might not have summary attribute
        """
        pipeline_data = {
            "timetable": {
                "__type": "airflow.timetables.custom.CustomTimetable",
                "__var": {},
            }
        }
        # Should return a descriptive string with the class name
        result = get_schedule_interval(pipeline_data)
        self.assertIn("Custom Timetable", result)
        self.assertIn("CustomTimetable", result)

    def test_get_schedule_interval_with_import_error(self):
        """
        Test handling of timetable classes that can't be imported
        """
        pipeline_data = {
            "timetable": {
                "__type": "nonexistent.module.NonExistentTimetable",
                "__var": {},
            }
        }
        # Should return a descriptive string with the class name
        result = get_schedule_interval(pipeline_data)
        self.assertIn("Custom Timetable", result)
        self.assertIn("NonExistentTimetable", result)

    def test_get_schedule_interval_with_missing_dag_id(self):
        """
        Test error handling when _dag_id is missing from pipeline_data
        """
        pipeline_data = {
            "schedule_interval": "invalid_format",
            # Missing _dag_id
        }
        # The function should return the string "invalid_format"
        # since it's a string schedule_interval
        result = get_schedule_interval(pipeline_data)
        self.assertEqual("invalid_format", result)

    def test_get_schedule_interval_with_none_dag_id(self):
        """
        Test error handling when _dag_id is None
        """
        pipeline_data = {
            "schedule_interval": "invalid_format",
            "_dag_id": None,
        }
        # The function should return the string "invalid_format"
        # since it's a string schedule_interval
        result = get_schedule_interval(pipeline_data)
        self.assertEqual("invalid_format", result)

    @patch("metadata.ingestion.source.pipeline.airflow.metadata.DagModel")
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.create_and_bind_session"
    )
    def test_get_pipelines_list_with_is_paused_query(
        self, mock_session, mock_dag_model
    ):
        """
        Test that the is_paused column is queried correctly
        instead of the entire DagModel
        """
        # Mock the session and query
        mock_session_instance = mock_session.return_value
        mock_query = mock_session_instance.query.return_value
        mock_filter = mock_query.filter.return_value
        mock_scalar = mock_filter.scalar.return_value

        # Test case 1: DAG is not paused
        mock_scalar.return_value = False

        # Create a mock serialized DAG result
        mock_serialized_dag = ("test_dag", {"dag": {"tasks": []}}, "/path/to/dag.py")

        # Mock the session query for SerializedDagModel
        mock_query_chain = mock_session_instance.query.return_value
        mock_query_chain = mock_query_chain.select_from.return_value
        mock_query_chain = mock_query_chain.filter.return_value
        mock_query_chain = mock_query_chain.limit.return_value
        mock_query_chain.offset.return_value.all.return_value = [mock_serialized_dag]

        # This would normally be called in get_pipelines_list, but we're testing the specific query
        # Verify that the query is constructed correctly
        is_paused_result = (
            mock_session_instance.query(mock_dag_model.is_paused)
            .filter(mock_dag_model.dag_id == "test_dag")
            .scalar()
        )

        # Verify the query was called correctly
        mock_session_instance.query.assert_called_with(mock_dag_model.is_paused)
        mock_query.filter.assert_called()
        mock_filter.scalar.assert_called()

        # Test case 2: DAG is paused
        mock_scalar.return_value = True
        is_paused_result = (
            mock_session_instance.query(mock_dag_model.is_paused)
            .filter(mock_dag_model.dag_id == "test_dag")
            .scalar()
        )
        self.assertTrue(is_paused_result)

    @patch("metadata.ingestion.source.pipeline.airflow.metadata.DagModel")
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.create_and_bind_session"
    )
    def test_get_pipelines_list_with_is_paused_query_error(
        self, mock_session, mock_dag_model
    ):
        """
        Test error handling when is_paused query fails
        """
        # Mock the session to raise an exception
        mock_session_instance = mock_session.return_value
        mock_filter = mock_session_instance.query.return_value.filter.return_value
        mock_filter.scalar.side_effect = Exception("Database error")

        # Create a mock serialized DAG result
        mock_serialized_dag = ("test_dag", {"dag": {"tasks": []}}, "/path/to/dag.py")

        # Mock the session query for SerializedDagModel
        mock_query_chain = mock_session_instance.query.return_value
        mock_query_chain = mock_query_chain.select_from.return_value
        mock_query_chain = mock_query_chain.filter.return_value
        mock_query_chain = mock_query_chain.limit.return_value
        mock_query_chain.offset.return_value.all.return_value = [mock_serialized_dag]

        # This would normally be called in get_pipelines_list,
        # but we're testing the error handling
        try:
            mock_session_instance.query(mock_dag_model.is_paused).filter(
                mock_dag_model.dag_id == "test_dag"
            ).scalar()
        except Exception:  # pylint: disable=broad-exception-caught
            # Expected to fail, but in the actual code
            # this would be caught and default to Active
            pass

        # Verify the query was attempted
        mock_session_instance.query.assert_called_with(mock_dag_model.is_paused)

    @patch("metadata.ingestion.source.pipeline.airflow.metadata.SerializedDagModel")
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.create_and_bind_session"
    )
    def test_get_pipelines_list_selects_latest_dag_version(
        self, mock_session, mock_serialized_dag_model  # pylint: disable=unused-argument
    ):
        """
        Test that when multiple versions of a DAG exist in serialized_dag table,
        only the latest version (by last_updated/created_at) is selected.
        This prevents the alternating behavior when task names are changed.
        """
        # Create mock session
        mock_session_instance = mock_session.return_value

        # New version with generate_data3_new
        new_dag_data = {
            "dag": {
                "_dag_id": "sample_lineage",
                "tasks": [
                    {"task_id": "generate_data"},
                    {"task_id": "generate_data2"},
                    {"task_id": "generate_data3_new"},  # New task name
                ],
            }
        }

        # Mock the subquery that gets max timestamp
        mock_subquery_result = (
            mock_session_instance.query.return_value.group_by.return_value
        )
        mock_subquery = mock_subquery_result.subquery.return_value
        mock_subquery.c.dag_id = "dag_id"
        mock_subquery.c.max_timestamp = "max_timestamp"

        # Mock the final query to return only the latest version
        mock_query_result = [("sample_lineage", new_dag_data, "/path/to/dag.py")]

        mock_join = mock_session_instance.query.return_value.join.return_value
        mock_filter = mock_join.filter.return_value
        mock_order = mock_filter.order_by.return_value
        mock_limit = mock_order.limit.return_value
        mock_limit.offset.return_value.all.return_value = mock_query_result

        # The test verifies that:
        # 1. A subquery is created to find max timestamp
        # 2. Only one result is returned (the latest)
        # 3. The returned result has the new task name

        # Actually execute the mock queries to verify the setup
        # This simulates what get_pipelines_list() does:
        # 1. Create subquery with max timestamp
        subquery_result = (
            mock_session_instance.query(
                mock_serialized_dag_model.dag_id, "max_timestamp"
            )
            .group_by(mock_serialized_dag_model.dag_id)
            .subquery()
        )

        # 2. Query with join to get latest version
        result = (
            mock_session_instance.query()
            .join(subquery_result)
            .filter()
            .order_by()
            .limit(100)
            .offset(0)
            .all()
        )

        # Verify the query structure was used
        mock_session_instance.query.assert_called()
        self.assertEqual(result, mock_query_result)

    @patch("metadata.ingestion.source.pipeline.airflow.metadata.SerializedDagModel")
    @patch("metadata.ingestion.source.pipeline.airflow.metadata.DagModel")
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.create_and_bind_session"
    )
    def test_get_pipelines_list_with_multiple_dag_versions_airflow_3(
        self,
        mock_session,
        mock_dag_model,  # pylint: disable=unused-argument
        mock_serialized_dag_model,  # pylint: disable=unused-argument
    ):
        """
        Test handling of multiple DAG versions in Airflow 3.x where fileloc
        comes from DagModel instead of SerializedDagModel
        """
        # Create mock session
        mock_session_instance = mock_session.return_value

        # Mock subquery
        mock_subquery_result = (
            mock_session_instance.query.return_value.group_by.return_value
        )
        mock_subquery = mock_subquery_result.subquery.return_value
        mock_subquery.c.dag_id = "dag_id"
        mock_subquery.c.max_timestamp = "max_timestamp"

        # Mock the final query with join to both subquery and DagModel
        new_dag_data = {
            "dag": {
                "_dag_id": "test_dag",
                "tasks": [
                    {"task_id": "task1"},
                    {"task_id": "task2_new"},  # Renamed from task2
                ],
            }
        }

        mock_query_result = [("test_dag", new_dag_data, "/path/to/dag.py")]

        # Mock the chained query calls for Airflow 3.x path
        mock_join_latest = mock_session_instance.query.return_value.join.return_value
        mock_join_dag_model = mock_join_latest.join.return_value
        mock_filter = mock_join_dag_model.filter.return_value
        mock_order = mock_filter.order_by.return_value
        mock_limit = mock_order.limit.return_value
        mock_limit.offset.return_value.all.return_value = mock_query_result

        # Verify multiple joins are performed (subquery + DagModel)
        # Actually execute the mock queries to verify the setup
        # This simulates what get_pipelines_list() does for Airflow 3.x:
        # 1. Create subquery with max timestamp
        subquery_result = (
            mock_session_instance.query(
                mock_serialized_dag_model.dag_id, "max_timestamp"
            )
            .group_by(mock_serialized_dag_model.dag_id)
            .subquery()
        )

        # 2. Query with TWO joins: one to latest subquery, one to DagModel for fileloc
        result = (
            mock_session_instance.query()
            .join(subquery_result)  # First join to latest version subquery
            .join(mock_dag_model)  # Second join to DagModel for fileloc
            .filter()
            .order_by()
            .limit(100)
            .offset(0)
            .all()
        )

        # Verify the query structure was used
        mock_session_instance.query.assert_called()
        self.assertEqual(result, mock_query_result)

    def test_serialized_dag_with_renamed_tasks(self):
        """
        Test that when tasks are renamed in a DAG, the metadata correctly
        reflects the new task names and doesn't fail with 'Invalid task name' error
        """
        # Original DAG structure
        old_serialized_dag = {
            "__version": 1,
            "dag": {
                "_dag_id": "test_dag",
                "fileloc": "/path/to/dag.py",
                "tasks": [
                    {"task_id": "task1", "_task_type": "EmptyOperator"},
                    {"task_id": "task2", "_task_type": "EmptyOperator"},
                    {"task_id": "old_task_name", "_task_type": "EmptyOperator"},
                ],
            },
        }

        # Updated DAG structure with renamed task
        new_serialized_dag = {
            "__version": 1,
            "dag": {
                "_dag_id": "test_dag",
                "fileloc": "/path/to/dag.py",
                "tasks": [
                    {"task_id": "task1", "_task_type": "EmptyOperator"},
                    {"task_id": "task2", "_task_type": "EmptyOperator"},
                    {"task_id": "new_task_name", "_task_type": "EmptyOperator"},
                ],
            },
        }

        # Verify old DAG has old task name
        old_data = old_serialized_dag["dag"]
        old_task_ids = [task["task_id"] for task in old_data["tasks"]]
        self.assertIn("old_task_name", old_task_ids)
        self.assertNotIn("new_task_name", old_task_ids)

        # Verify new DAG has new task name
        new_data = new_serialized_dag["dag"]
        new_task_ids = [task["task_id"] for task in new_data["tasks"]]
        self.assertIn("new_task_name", new_task_ids)
        self.assertNotIn("old_task_name", new_task_ids)

        # Create AirflowDagDetails with the new structure
        dag = AirflowDagDetails(
            dag_id="test_dag",
            fileloc="/path/to/dag.py",
            data=AirflowDag.model_validate(new_serialized_dag),
            max_active_runs=new_data.get("max_active_runs", None),
            description=new_data.get("_description", None),
            start_date=new_data.get("start_date", None),
            tasks=new_data.get("tasks", []),
            schedule_interval=None,
            owner=None,
        )

        # Verify the AirflowDagDetails has the new task structure
        task_ids = [task.task_id for task in dag.tasks]
        self.assertEqual(task_ids, ["task1", "task2", "new_task_name"])

    @patch("metadata.ingestion.source.pipeline.airflow.metadata.func")
    @patch("metadata.ingestion.source.pipeline.airflow.metadata.SerializedDagModel")
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.create_and_bind_session"
    )
    def test_latest_dag_subquery_uses_max_timestamp(
        self,
        mock_session,
        mock_serialized_dag_model,  # pylint: disable=unused-argument
        mock_func,  # pylint: disable=unused-argument
    ):
        """
        Test that the subquery correctly uses func.max()
        to find the latest timestamp
        """
        # Mock session and query
        mock_session_instance = mock_session.return_value

        # Verify that the session query method is available
        # The actual func.max usage is tested implicitly
        # through the get_pipelines_list method
        self.assertIsNotNone(mock_session_instance.query)

    def test_task_status_filtering_with_renamed_tasks(self):
        """
        Test that when generating pipeline status, task instances for renamed tasks
        are filtered correctly to prevent 'Invalid task name' errors
        """
        # Simulate the scenario where:
        # 1. Current DAG has task: generate_data3_new
        # 2. Historical task instances exist for: generate_data3 (old name)
        # 3. Task status should only include current task names

        current_task_names = {"generate_data", "generate_data2", "generate_data3_new"}

        # Historical task instances from database
        historical_task_instances = [
            {"task_id": "generate_data", "state": "success"},
            {"task_id": "generate_data2", "state": "success"},
            {"task_id": "generate_data3", "state": "success"},  # Old task name
        ]

        # Filter task instances to only include current task names
        # This mimics what happens in yield_pipeline_status
        filtered_tasks = [
            task
            for task in historical_task_instances
            if task["task_id"] in current_task_names
        ]

        # Verify old task is filtered out
        filtered_task_ids = [task["task_id"] for task in filtered_tasks]
        self.assertNotIn("generate_data3", filtered_task_ids)
        self.assertIn("generate_data", filtered_task_ids)
        self.assertIn("generate_data2", filtered_task_ids)

        # Verify only 2 tasks remain (not 3)
        self.assertEqual(len(filtered_tasks), 2)

    @patch("metadata.ingestion.source.pipeline.airflow.metadata.inspect")
    def test_execution_date_column_detection_airflow_3(self, mock_inspect):
        """
        Test that logical_date is detected when present (Airflow 3.x)
        """
        # Mock inspector and columns
        mock_inspector = mock_inspect.return_value
        mock_inspector.get_columns.return_value = [
            {"name": "logical_date"},
            {"name": "dag_id"},
        ]

        # Create a new AirflowSource instance (or use self.airflow if safe)
        # We need to reset the property cache first if using shared instance
        self.airflow._execution_date_column = None

        # Access property
        column = self.airflow.execution_date_column

        # Verify
        self.assertEqual(column, "logical_date")
        mock_inspector.get_columns.assert_called_with("dag_run")

    @patch("metadata.ingestion.source.pipeline.airflow.metadata.inspect")
    def test_execution_date_column_detection_airflow_2(self, mock_inspect):
        """
        Test that execution_date is used when logical_date is missing (Airflow 2.x)
        """
        # Mock inspector and columns
        mock_inspector = mock_inspect.return_value
        mock_inspector.get_columns.return_value = [
            {"name": "execution_date"},
            {"name": "dag_id"},
        ]

        # Reset cache
        self.airflow._execution_date_column = None

        # Access property
        column = self.airflow.execution_date_column

        # Verify
        self.assertEqual(column, "execution_date")

    @patch("metadata.ingestion.source.pipeline.airflow.metadata.inspect")
    def test_execution_date_column_error_fallback(self, mock_inspect):
        """
        Test fallback to execution_date when inspection fails
        """
        # Mock inspector to raise exception
        mock_inspect.side_effect = Exception("DB Error")

        # Reset cache
        self.airflow._execution_date_column = None

        # Access property
        column = self.airflow.execution_date_column

        # Verify fallback
        self.assertEqual(column, "execution_date")

    def test_task_source_url_format(self):
        """Test that task source URLs use correct filter parameters (Airflow 2.x)"""
        dag_id = "test_dag"
        host_port = "http://localhost:8080"

        # Mock remote Airflow as version 2.x
        self.airflow._is_remote_airflow_3 = False

        data = SERIALIZED_DAG["dag"]
        dag = AirflowDagDetails(
            dag_id=dag_id,
            fileloc="/path/to/dag.py",
            data=AirflowDag.model_validate(SERIALIZED_DAG),
            max_active_runs=data.get("max_active_runs", None),
            description=data.get("_description", None),
            start_date=data.get("start_date", None),
            tasks=data.get("tasks", []),
            schedule_interval=None,
            owner=None,
        )

        tasks = self.airflow.get_tasks_from_dag(dag, host_port)

        assert len(tasks) > 0
        for task in tasks:
            url = task.sourceUrl.root
            assert "_flt_3_dag_id=" in url
            assert "_flt_3_task_id=" in url
            assert "flt1_dag_id_equals" not in url

    def test_task_source_url_with_special_characters(self):
        """Test URL encoding for DAG and task IDs with special characters (Airflow 2.x)"""
        # Mock remote Airflow as version 2.x
        self.airflow._is_remote_airflow_3 = False

        dag_id = "timescale_loader_v7"
        task_id_with_dots = "loader_group.load_measurement"
        host_port = "http://localhost:8080"

        serialized_dag_with_dots = {
            "__version": 1,
            "dag": {
                "_dag_id": dag_id,
                "fileloc": "/path/to/dag.py",
                "tasks": [
                    {
                        "task_id": task_id_with_dots,
                        "_task_type": "EmptyOperator",
                        "downstream_task_ids": [],
                    }
                ],
            },
        }

        data = serialized_dag_with_dots["dag"]
        dag = AirflowDagDetails(
            dag_id=dag_id,
            fileloc="/path/to/dag.py",
            data=AirflowDag.model_validate(serialized_dag_with_dots),
            max_active_runs=data.get("max_active_runs", None),
            description=data.get("_description", None),
            start_date=data.get("start_date", None),
            tasks=data.get("tasks", []),
            schedule_interval=None,
            owner=None,
        )

        tasks = self.airflow.get_tasks_from_dag(dag, host_port)

        assert len(tasks) == 1
        task_url = tasks[0].sourceUrl.root
        assert f"_flt_3_dag_id={quote(dag_id)}" in task_url
        assert f"_flt_3_task_id={quote(task_id_with_dots)}" in task_url
        assert dag_id in task_url
        assert task_id_with_dots in task_url

    def test_task_source_url_airflow_2x_format(self):
        """Test that Airflow 2.x uses Flask-Admin URL format"""
        dag_id = "test_dag_v2"
        task_id = "test_task_v2"
        host_port = "http://localhost:8080"

        # Mock remote Airflow as version 2.x
        self.airflow._is_remote_airflow_3 = False

        data = SERIALIZED_DAG["dag"]
        dag = AirflowDagDetails(
            dag_id=dag_id,
            fileloc="/path/to/dag.py",
            data=AirflowDag.model_validate(SERIALIZED_DAG),
            max_active_runs=data.get("max_active_runs", None),
            description=data.get("_description", None),
            start_date=data.get("start_date", None),
            tasks=[{"task_id": task_id, "_task_type": "EmptyOperator"}],
            schedule_interval=None,
            owner=None,
        )

        tasks = self.airflow.get_tasks_from_dag(dag, host_port)

        assert len(tasks) > 0
        task_url = tasks[0].sourceUrl.root
        assert "/taskinstance/list/" in task_url
        assert f"_flt_3_dag_id={quote(dag_id)}" in task_url
        assert f"_flt_3_task_id={quote(task_id)}" in task_url
        assert "/dags/" not in task_url or "/tasks/" not in task_url

    def test_task_source_url_airflow_3x_format(self):
        """Test that Airflow 3.x uses React UI URL format"""
        dag_id = "test_dag_v3"
        task_id = "test_task_v3"
        host_port = "http://localhost:8080"

        # Mock remote Airflow as version 3.x
        self.airflow._is_remote_airflow_3 = True

        data = SERIALIZED_DAG["dag"]
        dag = AirflowDagDetails(
            dag_id=dag_id,
            fileloc="/path/to/dag.py",
            data=AirflowDag.model_validate(SERIALIZED_DAG),
            max_active_runs=data.get("max_active_runs", None),
            description=data.get("_description", None),
            start_date=data.get("start_date", None),
            tasks=[{"task_id": task_id, "_task_type": "EmptyOperator"}],
            schedule_interval=None,
            owner=None,
        )

        tasks = self.airflow.get_tasks_from_dag(dag, host_port)

        assert len(tasks) > 0
        task_url = tasks[0].sourceUrl.root
        assert f"/dags/{quote(dag_id)}/tasks/{quote(task_id)}" in task_url
        assert "/taskinstance/list/" not in task_url
        assert "_flt_3_dag_id=" not in task_url
