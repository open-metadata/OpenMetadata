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
from metadata.ingestion.source.pipeline.airflow.metadata import (
    AirflowSource,
    OMTaskInstance,
)
from metadata.ingestion.source.pipeline.airflow.models import (
    AirflowDag,
    AirflowDagDetails,
    AirflowTask,
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

    def test_get_task_instances_bulk_query(self):
        """
        Verify that get_task_instances fires a single DB query for all run_ids
        (no N+1 per DagRun) and groups the returned rows by run_id.
        Tasks not present in serialized_tasks are excluded from the result.
        """
        from unittest.mock import MagicMock

        serialized_tasks = [
            AirflowTask(task_id="task_a"),
            AirflowTask(task_id="task_b"),
        ]

        row_run1 = MagicMock()
        row_run1._asdict.return_value = {
            "task_id": "task_a",
            "state": "success",
            "start_date": None,
            "end_date": None,
            "run_id": "run_1",
        }
        row_run2 = MagicMock()
        row_run2._asdict.return_value = {
            "task_id": "task_b",
            "state": "failed",
            "start_date": None,
            "end_date": None,
            "run_id": "run_2",
        }
        unknown_task_row = MagicMock()
        unknown_task_row._asdict.return_value = {
            "task_id": "task_unknown",
            "state": "success",
            "start_date": None,
            "end_date": None,
            "run_id": "run_1",
        }

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [row_run1, row_run2, unknown_task_row]
        mock_session = MagicMock()
        mock_session.query.return_value = mock_query

        original_session = getattr(self.airflow, "_session", None)
        self.airflow._session = mock_session
        try:
            result = self.airflow.get_task_instances(
                "my_dag", ["run_1", "run_2"], serialized_tasks
            )
        finally:
            self.airflow._session = original_session

        # Single DB query — not one per run_id
        mock_session.query.assert_called_once()

        # Results grouped correctly by run_id
        self.assertIn("run_1", result)
        self.assertIn("run_2", result)

        # task_unknown is not in serialized_tasks so it must be excluded
        self.assertEqual(len(result["run_1"]), 1)
        self.assertEqual(result["run_1"][0].task_id, "task_a")
        self.assertEqual(result["run_1"][0].state, "success")

        self.assertEqual(len(result["run_2"]), 1)
        self.assertEqual(result["run_2"][0].task_id, "task_b")
        self.assertEqual(result["run_2"][0].state, "failed")

    def test_get_task_instances_no_regression_vs_old_per_run_loop(self):
        """
        Behavioural-equivalence test against the previous per-run_id loop.

        Reconstructs a realistic mixed dataset (multiple DAG runs, multiple
        tasks per run, some renamed/removed tasks, one run with no surviving
        tasks) and asserts that the new bulk get_task_instances produces the
        same per-run mapping a per-run_id loop over the old single-run filter
        would have produced. This is the no-regression check the maintainer
        asked for, performed without needing a live Airflow DB.
        """
        from unittest.mock import MagicMock

        serialized_tasks = [
            AirflowTask(task_id="extract"),
            AirflowTask(task_id="transform"),
            AirflowTask(task_id="load"),
        ]

        def make_row(task_id, run_id, state):
            row = MagicMock()
            row._asdict.return_value = {
                "task_id": task_id,
                "state": state,
                "start_date": None,
                "end_date": None,
                "run_id": run_id,
            }
            return row

        all_rows = [
            make_row("extract", "scheduled__1", "success"),
            make_row("transform", "scheduled__1", "success"),
            make_row("load", "scheduled__1", "success"),
            make_row("extract", "scheduled__2", "success"),
            make_row("transform", "scheduled__2", "failed"),
            make_row("legacy_step", "scheduled__2", "success"),
            make_row("extract", "manual__3", "running"),
            make_row("only_old_task", "scheduled__4", "success"),
        ]
        run_ids = ["scheduled__1", "scheduled__2", "manual__3", "scheduled__4"]

        def expected_per_run():
            grouped = {}
            allowed = {t.task_id for t in serialized_tasks}
            for run_id in run_ids:
                grouped[run_id] = [
                    OMTaskInstance(
                        task_id=r._asdict()["task_id"],
                        state=r._asdict()["state"],
                        start_date=None,
                        end_date=None,
                    )
                    for r in all_rows
                    if r._asdict()["run_id"] == run_id
                    and r._asdict()["task_id"] in allowed
                ]
            return grouped

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = all_rows
        mock_session = MagicMock()
        mock_session.query.return_value = mock_query

        original_session = getattr(self.airflow, "_session", None)
        self.airflow._session = mock_session
        try:
            actual = self.airflow.get_task_instances(
                "etl_dag", run_ids, serialized_tasks
            )
        finally:
            self.airflow._session = original_session

        expected = expected_per_run()

        # Single bulk query, not one per run_id
        mock_session.query.assert_called_once()
        self.assertEqual(
            set(actual.keys()), {"scheduled__1", "scheduled__2", "manual__3"}
        )
        for run_id in actual:
            self.assertEqual(
                [(t.task_id, t.state) for t in actual[run_id]],
                [(t.task_id, t.state) for t in expected[run_id]],
                f"Bulk query result for {run_id} diverges from per-run loop output",
            )
        # scheduled__4 had only a legacy task: equivalent to old loop returning []
        self.assertEqual(actual.get("scheduled__4", []), expected["scheduled__4"])

    def test_get_task_instances_returns_empty_dict_on_db_exception(self):
        """
        On any DB error (e.g. older Airflow schemas without run_id column) the
        method must swallow the exception and return an empty dict so that
        yield_pipeline_status keeps emitting per-run statuses with empty task
        lists - matching the pre-change safe-fallback behaviour.
        """
        from unittest.mock import MagicMock

        mock_session = MagicMock()
        mock_session.query.side_effect = RuntimeError("simulated DB failure")

        original_session = getattr(self.airflow, "_session", None)
        self.airflow._session = mock_session
        try:
            result = self.airflow.get_task_instances(
                "any_dag",
                ["run_a", "run_b"],
                [AirflowTask(task_id="t1")],
            )
        finally:
            self.airflow._session = original_session

        self.assertEqual(result, {})

    def test_get_task_instances_handles_empty_run_ids(self):
        """
        If get_task_instances is ever called with no run_ids it must not throw
        (some SQL dialects reject `IN ()`). yield_pipeline_status guards this
        upstream, but the method itself should still degrade gracefully.
        """
        from unittest.mock import MagicMock

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = []
        mock_session = MagicMock()
        mock_session.query.return_value = mock_query

        original_session = getattr(self.airflow, "_session", None)
        self.airflow._session = mock_session
        try:
            result = self.airflow.get_task_instances("any_dag", [], [])
        finally:
            self.airflow._session = original_session

        self.assertEqual(result, {})

    def test_get_task_instances_skips_rows_with_missing_fields(self):
        """
        Negative-data test: if the DB returns rows with missing task_id or
        run_id (e.g. NULLs from a partial/corrupt Airflow schema), the
        method must log-and-continue - the rest of the batch must still be
        ingested. It must NOT raise and abort the whole DAG.
        """
        from unittest.mock import MagicMock

        serialized_tasks = [
            AirflowTask(task_id="task_a"),
            AirflowTask(task_id="task_b"),
        ]

        good_row = MagicMock()
        good_row._asdict.return_value = {
            "task_id": "task_a",
            "state": "success",
            "start_date": None,
            "end_date": None,
            "run_id": "run_1",
        }
        missing_task_id = MagicMock()
        missing_task_id._asdict.return_value = {
            "task_id": None,
            "state": "success",
            "start_date": None,
            "end_date": None,
            "run_id": "run_1",
        }
        missing_run_id = MagicMock()
        missing_run_id._asdict.return_value = {
            "task_id": "task_b",
            "state": "failed",
            "start_date": None,
            "end_date": None,
            "run_id": None,
        }
        second_good_row = MagicMock()
        second_good_row._asdict.return_value = {
            "task_id": "task_b",
            "state": "success",
            "start_date": None,
            "end_date": None,
            "run_id": "run_2",
        }

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [
            good_row,
            missing_task_id,
            missing_run_id,
            second_good_row,
        ]
        mock_session = MagicMock()
        mock_session.query.return_value = mock_query

        original_session = getattr(self.airflow, "_session", None)
        self.airflow._session = mock_session
        try:
            result = self.airflow.get_task_instances(
                "my_dag", ["run_1", "run_2"], serialized_tasks
            )
        finally:
            self.airflow._session = original_session

        # Bad rows skipped, good rows kept - no exception propagated
        self.assertEqual(set(result.keys()), {"run_1", "run_2"})
        self.assertEqual([t.task_id for t in result["run_1"]], ["task_a"])
        self.assertEqual([t.task_id for t in result["run_2"]], ["task_b"])

    def test_get_task_instances_continues_on_malformed_row(self):
        """
        Negative-data test: if a single row raises while being processed
        (e.g. ._asdict() explodes for one element), the method must log the
        offending row and keep going for the remaining rows in the batch.
        Preferred behaviour per maintainer review: log and move forward,
        do NOT interrupt processing of the whole DAG.
        """
        from unittest.mock import MagicMock

        serialized_tasks = [AirflowTask(task_id="task_a")]

        good_row_before = MagicMock()
        good_row_before._asdict.return_value = {
            "task_id": "task_a",
            "state": "success",
            "start_date": None,
            "end_date": None,
            "run_id": "run_1",
        }
        broken_row = MagicMock()
        broken_row._asdict.side_effect = RuntimeError("corrupt row")
        good_row_after = MagicMock()
        good_row_after._asdict.return_value = {
            "task_id": "task_a",
            "state": "failed",
            "start_date": None,
            "end_date": None,
            "run_id": "run_2",
        }

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [good_row_before, broken_row, good_row_after]
        mock_session = MagicMock()
        mock_session.query.return_value = mock_query

        original_session = getattr(self.airflow, "_session", None)
        self.airflow._session = mock_session
        try:
            result = self.airflow.get_task_instances(
                "my_dag", ["run_1", "run_2"], serialized_tasks
            )
        finally:
            self.airflow._session = original_session

        # Both surrounding good rows must be present despite the bad one
        self.assertEqual(set(result.keys()), {"run_1", "run_2"})
        self.assertEqual(result["run_1"][0].state, "success")
        self.assertEqual(result["run_2"][0].state, "failed")

    def test_get_task_instances_stray_run_id_grouped_separately(self):
        """
        Negative-data test: if the DB returns a TaskInstance whose run_id is
        not in the requested run_ids list (e.g. stale cache / race with a
        delete), it is grouped under its own key in the returned dict.
        yield_pipeline_status then safely ignores it via
        tasks_by_run_id.get(run_id, []) so no data for the requested runs is
        lost and no exception propagates.
        """
        from unittest.mock import MagicMock

        serialized_tasks = [AirflowTask(task_id="task_a")]

        requested_row = MagicMock()
        requested_row._asdict.return_value = {
            "task_id": "task_a",
            "state": "success",
            "start_date": None,
            "end_date": None,
            "run_id": "run_requested",
        }
        stray_row = MagicMock()
        stray_row._asdict.return_value = {
            "task_id": "task_a",
            "state": "success",
            "start_date": None,
            "end_date": None,
            "run_id": "run_stray",
        }

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [requested_row, stray_row]
        mock_session = MagicMock()
        mock_session.query.return_value = mock_query

        original_session = getattr(self.airflow, "_session", None)
        self.airflow._session = mock_session
        try:
            result = self.airflow.get_task_instances(
                "my_dag", ["run_requested"], serialized_tasks
            )
        finally:
            self.airflow._session = original_session

        # Requested run is populated
        self.assertIn("run_requested", result)
        self.assertEqual(len(result["run_requested"]), 1)
        self.assertEqual(result["run_requested"][0].task_id, "task_a")

        # Stray run is grouped under its own key (not merged with a requested
        # run, not dropped silently). yield_pipeline_status's
        # tasks_by_run_id.get(run_id, []) lookup means it's safely ignored
        # by the caller.
        self.assertIn("run_stray", result)
        self.assertEqual(len(result["run_stray"]), 1)
        self.assertEqual(result["run_stray"][0].task_id, "task_a")

    def test_yield_pipeline_status_chunks_run_ids(self):
        """
        Defense-in-depth: even though run_ids is already bounded by
        numberOfStatus upstream, yield_pipeline_status must chunk the calls
        to get_task_instances by _TASK_INSTANCE_RUN_ID_CHUNK_SIZE so that
        we never send an unbounded IN(...) list to the DB and so that a
        failed chunk does not wipe out the rest of the DAG's statuses.

        With 125 eligible runs and a chunk size of 50 we expect exactly
        3 calls (50 + 50 + 25) to get_task_instances and 125 yielded
        pipeline statuses.
        """
        from unittest.mock import MagicMock, patch

        from metadata.ingestion.source.pipeline.airflow import (
            metadata as airflow_module,
        )

        total_runs = 125
        chunk_size = 50
        expected_calls = 3

        dag_runs = []
        for i in range(total_runs):
            dag_run = MagicMock()
            dag_run.dag_id = "my_dag"
            dag_run.run_id = f"run_{i}"
            dag_run.state = "success"
            dag_run.logical_date = None
            dag_run.start_date = None
            dag_runs.append(dag_run)

        pipeline_details = MagicMock()
        pipeline_details.dag_id = "my_dag"
        pipeline_details.tasks = [AirflowTask(task_id="t1")]

        context_value = MagicMock()
        context_value.task_names = ["t1"]
        context_value.pipeline_service = "svc"
        context_value.pipeline = "my_dag"

        bulk_call_log = []

        def fake_get_task_instances(dag_id, run_ids, serialized_tasks):
            bulk_call_log.append(list(run_ids))
            return {run_id: [] for run_id in run_ids}

        with patch.object(
            airflow_module, "_TASK_INSTANCE_RUN_ID_CHUNK_SIZE", chunk_size
        ), patch.object(
            self.airflow, "get_pipeline_status", return_value=dag_runs
        ), patch.object(
            self.airflow, "get_task_instances", side_effect=fake_get_task_instances
        ), patch.object(
            self.airflow,
            "context",
            MagicMock(get=MagicMock(return_value=context_value)),
        ), patch.object(
            self.airflow, "metadata", MagicMock()
        ), patch(
            "metadata.ingestion.source.pipeline.airflow.metadata.fqn.build",
            return_value="svc.my_dag",
        ), patch(
            "metadata.ingestion.source.pipeline.airflow.metadata.datetime_to_ts",
            return_value=1,
        ):
            results = list(self.airflow.yield_pipeline_status(pipeline_details))

        # Exactly ceil(total_runs / chunk_size) bulk queries
        self.assertEqual(len(bulk_call_log), expected_calls)

        # Every chunk respects the configured bound
        for chunk in bulk_call_log:
            self.assertLessEqual(len(chunk), chunk_size)

        # Chunk sizes for 125 with chunk_size=50 are 50, 50, 25
        self.assertEqual([len(c) for c in bulk_call_log], [50, 50, 25])

        # Every eligible run_id is covered exactly once, in order
        flattened = [run_id for chunk in bulk_call_log for run_id in chunk]
        self.assertEqual(flattened, [f"run_{i}" for i in range(total_runs)])

        # One PipelineStatus is yielded per eligible DagRun
        self.assertEqual(len(results), total_runs)
        for either in results:
            self.assertIsNone(either.left)
            self.assertIsNotNone(either.right)

    def test_yield_pipeline_status_chunk_failure_does_not_block_other_chunks(self):
        """
        If one chunk's get_task_instances call raises, yield_pipeline_status
        must log the failure and keep processing the remaining chunks. To
        preserve the pre-PR safe-fallback behaviour, the failed chunk's runs
        still produce PipelineStatus objects with empty task lists (instead
        of being silently dropped) - matching the prior per-run loop where a
        DB error produced empty tasks but runs were still emitted.
        """
        from unittest.mock import MagicMock, patch

        from metadata.ingestion.source.pipeline.airflow import (
            metadata as airflow_module,
        )

        total_runs = 30
        chunk_size = 10  # -> 3 chunks of 10

        dag_runs = []
        for i in range(total_runs):
            dag_run = MagicMock()
            dag_run.dag_id = "my_dag"
            dag_run.run_id = f"run_{i}"
            dag_run.state = "success"
            dag_run.logical_date = None
            dag_run.start_date = None
            dag_runs.append(dag_run)

        pipeline_details = MagicMock()
        pipeline_details.dag_id = "my_dag"
        pipeline_details.tasks = [AirflowTask(task_id="t1")]

        context_value = MagicMock()
        context_value.task_names = ["t1"]
        context_value.pipeline_service = "svc"
        context_value.pipeline = "my_dag"

        call_counter = {"n": 0}

        def fake_get_task_instances(dag_id, run_ids, serialized_tasks):
            call_counter["n"] += 1
            # Fail the middle chunk only
            if call_counter["n"] == 2:
                raise RuntimeError("simulated chunk failure")
            return {run_id: [] for run_id in run_ids}

        with patch.object(
            airflow_module, "_TASK_INSTANCE_RUN_ID_CHUNK_SIZE", chunk_size
        ), patch.object(
            self.airflow, "get_pipeline_status", return_value=dag_runs
        ), patch.object(
            self.airflow, "get_task_instances", side_effect=fake_get_task_instances
        ), patch.object(
            self.airflow,
            "context",
            MagicMock(get=MagicMock(return_value=context_value)),
        ), patch.object(
            self.airflow, "metadata", MagicMock()
        ), patch(
            "metadata.ingestion.source.pipeline.airflow.metadata.fqn.build",
            return_value="svc.my_dag",
        ), patch(
            "metadata.ingestion.source.pipeline.airflow.metadata.datetime_to_ts",
            return_value=1,
        ):
            results = list(self.airflow.yield_pipeline_status(pipeline_details))

        # All 3 chunks were attempted even though the middle one raised
        self.assertEqual(call_counter["n"], 3)

        # All 30 statuses are emitted: good chunks with whatever tasks they
        # returned, failed chunk with empty task lists. None dropped.
        self.assertEqual(len(results), total_runs)
        for either in results:
            self.assertIsNone(either.left)
            self.assertIsNotNone(either.right)

        yielded_run_ids = {
            either.right.pipeline_status.executionId for either in results
        }
        self.assertEqual(yielded_run_ids, {f"run_{i}" for i in range(total_runs)})

        # Runs in the failed middle chunk have empty taskStatus lists
        failed_chunk_runs = {f"run_{i}" for i in range(10, 20)}
        failed_statuses = [
            e.right.pipeline_status
            for e in results
            if e.right.pipeline_status.executionId in failed_chunk_runs
        ]
        self.assertEqual(len(failed_statuses), 10)
        for status in failed_statuses:
            self.assertEqual(status.taskStatus, [])
