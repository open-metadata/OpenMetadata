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
Tests for MWAA (Managed Workflows for Apache Airflow) client
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.ingestion.source.pipeline.airflow.api.models import (
    AirflowApiDagDetails,
    AirflowApiDagRun,
    AirflowApiTaskInstance,
)
from metadata.ingestion.source.pipeline.airflow.api.mwaa import MWAAClient


class TestMWAAClientInitialization:
    """Test MWAAClient initialization and setup"""

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_init_creates_aws_client(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        aws_credentials = AWSCredentials(
            awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
        )
        environment_name = "test-env"

        client = MWAAClient(aws_credentials, environment_name)

        assert client.aws_credentials == aws_credentials
        assert client.environment_name == environment_name
        assert client._aws_client == mock_aws_client
        assert client._mwaa_client == mock_mwaa_client
        mock_aws_client_cls.assert_called_once_with(aws_credentials)
        mock_aws_client.get_mwaa_client.assert_called_once()


class TestMWAAClientInvokeRestApi:
    """Test _invoke_rest_api method with various scenarios"""

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_invoke_rest_api_basic_get(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        expected_response = {"dags": [{"dag_id": "test_dag"}]}
        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": expected_response
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client._invoke_rest_api("/dags")

        assert result == expected_response
        mock_mwaa_client.invoke_rest_api.assert_called_once_with(
            Name="test-env", Path="/dags", Method="GET"
        )

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_invoke_rest_api_with_query_params(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"dags": []}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        query = {"limit": "100", "offset": "0"}
        client._invoke_rest_api("/dags", query=query)

        mock_mwaa_client.invoke_rest_api.assert_called_once_with(
            Name="test-env", Path="/dags", Method="GET", QueryParameters=query
        )

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_invoke_rest_api_with_body_dict(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"success": True}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        body = {"conf": {"key": "value"}}
        client._invoke_rest_api("/dags/test/dagRuns", method="POST", body=body)

        mock_mwaa_client.invoke_rest_api.assert_called_once_with(
            Name="test-env",
            Path="/dags/test/dagRuns",
            Method="POST",
            Body=json.dumps(body),
        )

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_invoke_rest_api_with_string_body(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"success": True}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        body = '{"conf": {"key": "value"}}'
        client._invoke_rest_api("/dags/test/dagRuns", method="POST", body=body)

        mock_mwaa_client.invoke_rest_api.assert_called_once_with(
            Name="test-env", Path="/dags/test/dagRuns", Method="POST", Body=body
        )

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_invoke_rest_api_string_response_json_parsing(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        json_response = '{"dags": [{"dag_id": "test"}]}'
        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": json_response
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client._invoke_rest_api("/dags")

        assert result == {"dags": [{"dag_id": "test"}]}

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.logger")
    def test_invoke_rest_api_invalid_json_response(
        self, mock_logger, mock_aws_client_cls
    ):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        invalid_json = "invalid json response"
        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": invalid_json
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client._invoke_rest_api("/dags")

        assert result == {"raw_response": invalid_json}
        mock_logger.warning.assert_called_once()

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.logger")
    def test_invoke_rest_api_exception_handling(self, mock_logger, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.side_effect = Exception("AWS Error")

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        with pytest.raises(Exception, match="AWS Error"):
            client._invoke_rest_api("/dags")

        mock_logger.error.assert_called_once()
        mock_logger.debug.assert_called_once()


class TestMWAAClientBasicMethods:
    """Test basic client methods"""

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_get_version(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.get_version()

        assert result == {"version": "MWAA", "status": "connected"}

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_list_dags(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        expected_response = {"dags": [{"dag_id": "test_dag"}]}
        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": expected_response
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.list_dags(limit=50, offset=10)

        assert result == expected_response
        mock_mwaa_client.invoke_rest_api.assert_called_once_with(
            Name="test-env",
            Path="/dags",
            Method="GET",
            QueryParameters={"limit": "50", "offset": "10"},
        )

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_get_dag_tasks(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        expected_response = {"tasks": [{"task_id": "task1"}]}
        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": expected_response
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.get_dag_tasks("my_dag")

        assert result == expected_response
        mock_mwaa_client.invoke_rest_api.assert_called_once_with(
            Name="test-env", Path="/dags/my_dag/tasks", Method="GET"
        )

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_get_dag_tasks_with_special_chars(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"tasks": []}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        client.get_dag_tasks("my-dag/with spaces")

        mock_mwaa_client.invoke_rest_api.assert_called_once_with(
            Name="test-env", Path="/dags/my-dag%2Fwith%20spaces/tasks", Method="GET"
        )

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_list_dag_runs(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        expected_response = {"dag_runs": [{"dag_run_id": "run1"}]}
        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": expected_response
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.list_dag_runs("my_dag", limit=5)

        assert result == expected_response
        mock_mwaa_client.invoke_rest_api.assert_called_once_with(
            Name="test-env",
            Path="/dags/my_dag/dagRuns?order_by=-start_date&limit=5",
            Method="GET",
        )

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_list_dag_runs_no_limit(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"dag_runs": []}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        client.list_dag_runs("my_dag", limit=None)

        mock_mwaa_client.invoke_rest_api.assert_called_once_with(
            Name="test-env",
            Path="/dags/my_dag/dagRuns?order_by=-start_date",
            Method="GET",
        )

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_get_task_instances(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        expected_response = {"task_instances": [{"task_id": "task1"}]}
        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": expected_response
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.get_task_instances("my_dag", "run_id_1")

        assert result == expected_response
        mock_mwaa_client.invoke_rest_api.assert_called_once_with(
            Name="test-env",
            Path="/dags/my_dag/dagRuns/run_id_1/taskInstances",
            Method="GET",
        )


class TestMWAAClientPagination:
    """Test pagination methods"""

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_paginate_single_page(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        page_response = {
            "dags": [{"dag_id": "dag1"}, {"dag_id": "dag2"}],
            "total_entries": 2,
        }
        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": page_response
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client._paginate("/dags", "dags", limit=100)

        assert result == [{"dag_id": "dag1"}, {"dag_id": "dag2"}]
        assert mock_mwaa_client.invoke_rest_api.call_count == 1

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_paginate_multiple_pages(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        page1 = {
            "dags": [{"dag_id": f"dag{i}"} for i in range(100)],
            "total_entries": 150,
        }
        page2 = {
            "dags": [{"dag_id": f"dag{i}"} for i in range(100, 150)],
            "total_entries": 150,
        }

        responses = [{"RestApiResponse": page1}, {"RestApiResponse": page2}]
        mock_mwaa_client.invoke_rest_api.side_effect = responses

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client._paginate("/dags", "dags", limit=100)

        assert len(result) == 150
        assert result[0]["dag_id"] == "dag0"
        assert result[-1]["dag_id"] == "dag149"
        assert mock_mwaa_client.invoke_rest_api.call_count == 2

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_paginate_without_total_entries_fetches_until_short_page(
        self, mock_aws_client_cls
    ):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        page1 = {"dags": [{"dag_id": f"dag{i}"} for i in range(100)]}
        page2 = {"dags": [{"dag_id": f"dag{i}"} for i in range(100, 120)]}

        mock_mwaa_client.invoke_rest_api.side_effect = [
            {"RestApiResponse": page1},
            {"RestApiResponse": page2},
        ]

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client._paginate("/dags", "dags", limit=100)

        assert len(result) == 120
        assert result[-1]["dag_id"] == "dag119"
        assert mock_mwaa_client.invoke_rest_api.call_count == 2

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_paginate_empty_response(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {"RestApiResponse": None}

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client._paginate("/dags", "dags", limit=100)

        assert result == []

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_paginate_empty_page_key(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"dags": [], "total_entries": 0}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client._paginate("/dags", "dags", limit=100)

        assert result == []

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_get_all_dags(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        page_response = {"dags": [{"dag_id": "dag1"}], "total_entries": 1}
        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": page_response
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.get_all_dags()

        assert result == [{"dag_id": "dag1"}]


class TestMWAAClientBuildDagDetails:
    """Test build_dag_details method"""

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_build_dag_details_basic(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        tasks_response = {
            "tasks": [
                {
                    "task_id": "task1",
                    "downstream_task_ids": ["task2"],
                    "owner": "admin",
                    "doc_md": "Task documentation",
                    "start_date": "2025-01-01T00:00:00+00:00",
                    "end_date": None,
                    "class_ref": {"class_name": "PythonOperator"},
                }
            ]
        }
        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": tasks_response
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        dag_data = {
            "dag_id": "test_dag",
            "description": "Test DAG",
            "fileloc": "/dags/test_dag.py",
            "is_paused": False,
            "owners": ["admin"],
            "tags": [{"name": "production"}, {"name": "etl"}],
            "schedule_interval": "@daily",
            "max_active_runs": 1,
            "start_date": "2025-01-01T00:00:00+00:00",
        }

        result = client.build_dag_details(dag_data)

        assert isinstance(result, AirflowApiDagDetails)
        assert result.dag_id == "test_dag"
        assert result.description == "Test DAG"
        assert result.fileloc == "/dags/test_dag.py"
        assert result.is_paused is False
        assert result.owners == ["admin"]
        assert result.tags == ["production", "etl"]
        assert result.schedule_interval == "@daily"
        assert result.max_active_runs == 1
        assert result.start_date is not None
        assert result.start_date.year == 2025
        assert result.start_date.month == 1
        assert result.start_date.day == 1
        assert len(result.tasks) == 1
        assert result.tasks[0].task_id == "task1"

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_build_dag_details_tag_variations(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"tasks": []}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        dag_data = {
            "dag_id": "test_dag",
            "tags": [
                {"name": "tag1"},  # dict format
                "tag2",  # string format
                {"name": ""},  # empty name
                {"name": None},  # None name
                123,  # invalid type
                {"name": "tag3"},  # valid dict
            ],
        }

        result = client.build_dag_details(dag_data)

        assert result.tags == ["tag1", "tag2", "tag3"]

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_build_dag_details_schedule_variations(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"tasks": []}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        # Test dict schedule_interval
        dag_data = {"dag_id": "test_dag", "schedule_interval": {"value": "@hourly"}}

        result = client.build_dag_details(dag_data)
        assert result.schedule_interval == "@hourly"

        # Test string schedule_interval
        dag_data = {"dag_id": "test_dag", "schedule_interval": "@daily"}

        result = client.build_dag_details(dag_data)
        assert result.schedule_interval == "@daily"

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_build_dag_details_file_loc_fallback(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"tasks": []}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        # Test file_loc fallback
        dag_data = {"dag_id": "test_dag", "file_loc": "/dags/test.py"}

        result = client.build_dag_details(dag_data)
        assert result.fileloc == "/dags/test.py"

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.logger")
    def test_build_dag_details_task_fetch_error(self, mock_logger, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.side_effect = Exception("Task fetch failed")

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        dag_data = {"dag_id": "test_dag"}

        result = client.build_dag_details(dag_data)

        assert result.tasks == []
        mock_logger.warning.assert_called_once()


class TestMWAAClientGetDagRuns:
    """Test get_dag_runs method"""

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_get_dag_runs_success(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        runs_response = {
            "dag_runs": [
                {
                    "dag_run_id": "run1",
                    "state": "success",
                    "logical_date": "2025-01-01T00:00:00+00:00",
                    "start_date": "2025-01-01T00:01:00+00:00",
                    "end_date": "2025-01-01T00:05:00+00:00",
                },
                {
                    "dag_run_id": "run2",
                    "state": "failed",
                    "execution_date": "2024-12-31T23:00:00+00:00",
                    "start_date": "2024-12-31T23:01:00+00:00",
                    "end_date": "2024-12-31T23:03:00+00:00",
                },
            ]
        }
        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": runs_response
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.get_dag_runs("test_dag", limit=5)

        assert len(result) == 2
        assert all(isinstance(run, AirflowApiDagRun) for run in result)

        assert result[0].dag_run_id == "run1"
        assert result[0].state == "success"
        assert result[0].execution_date is not None
        assert result[0].execution_date.year == 2025
        assert result[0].execution_date.month == 1
        assert result[0].execution_date.day == 1

        assert result[1].dag_run_id == "run2"
        assert result[1].state == "failed"
        assert result[1].execution_date is not None
        assert result[1].execution_date.year == 2024
        assert result[1].execution_date.month == 12
        assert result[1].execution_date.day == 31

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.logger")
    def test_get_dag_runs_api_error(self, mock_logger, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.side_effect = Exception("API Error")

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.get_dag_runs("test_dag")

        assert result == []
        mock_logger.warning.assert_called_once()

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_get_dag_runs_empty_response(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"dag_runs": []}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.get_dag_runs("test_dag")

        assert result == []


class TestMWAAClientGetTaskInstancesForRun:
    """Test get_task_instances_for_run method"""

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_get_task_instances_for_run_success(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        instances_response = {
            "task_instances": [
                {
                    "task_id": "task1",
                    "state": "success",
                    "start_date": "2025-01-01T00:01:00+00:00",
                    "end_date": "2025-01-01T00:02:00+00:00",
                },
                {
                    "task_id": "task2",
                    "state": "failed",
                    "start_date": "2025-01-01T00:02:00+00:00",
                    "end_date": "2025-01-01T00:03:00+00:00",
                },
            ]
        }
        mock_mwaa_client.invoke_rest_api.side_effect = [
            {"RestApiResponse": instances_response}
        ]

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.get_task_instances_for_run("test_dag", "run_1")

        assert len(result) == 2
        assert all(isinstance(ti, AirflowApiTaskInstance) for ti in result)

        assert result[0].task_id == "task1"
        assert result[0].state == "success"
        assert result[1].task_id == "task2"
        assert result[1].state == "failed"

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.logger")
    def test_get_task_instances_for_run_api_error(
        self, mock_logger, mock_aws_client_cls
    ):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.side_effect = Exception("API Error")

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.get_task_instances_for_run("test_dag", "run_1")

        assert result == []
        mock_logger.warning.assert_called_once()

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_get_task_instances_for_run_empty_response(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.side_effect = [
            {"RestApiResponse": {"task_instances": []}}
        ]

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.get_task_instances_for_run("test_dag", "run_1")

        assert result == []

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_get_task_instances_for_run_with_special_chars(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.side_effect = [
            {"RestApiResponse": {"task_instances": []}}
        ]

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        client.get_task_instances_for_run("my-dag/test", "run with spaces")

        expected_path = "/dags/my-dag%2Ftest/dagRuns/run%20with%20spaces/taskInstances"
        mock_mwaa_client.invoke_rest_api.assert_called_once_with(
            Name="test-env",
            Path=expected_path,
            Method="GET",
            QueryParameters={"limit": "100", "offset": "0"},
        )


class TestMWAAClientEdgeCases:
    """Test edge cases and error scenarios"""

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_empty_tags_list(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"tasks": []}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        dag_data = {"dag_id": "test_dag", "tags": []}

        result = client.build_dag_details(dag_data)
        assert result.tags == []

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_none_tags(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"tasks": []}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        dag_data = {"dag_id": "test_dag", "tags": None}

        result = client.build_dag_details(dag_data)
        assert result.tags == []

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_none_owners(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": {"tasks": []}
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        dag_data = {"dag_id": "test_dag", "owners": None}

        result = client.build_dag_details(dag_data)
        assert result.owners == []

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_missing_dag_run_id(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        runs_response = {
            "dag_runs": [
                {"state": "success", "logical_date": "2025-01-01T00:00:00+00:00"}
            ]
        }
        mock_mwaa_client.invoke_rest_api.return_value = {
            "RestApiResponse": runs_response
        }

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.get_dag_runs("test_dag")

        assert len(result) == 1
        assert result[0].dag_run_id == ""

    @patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient")
    def test_missing_task_id(self, mock_aws_client_cls):
        mock_aws_client = MagicMock()
        mock_mwaa_client = MagicMock()
        mock_aws_client.get_mwaa_client.return_value = mock_mwaa_client
        mock_aws_client_cls.return_value = mock_aws_client

        instances_response = {
            "task_instances": [
                {"state": "success", "start_date": "2025-01-01T00:01:00+00:00"}
            ]
        }
        mock_mwaa_client.invoke_rest_api.side_effect = [
            {"RestApiResponse": instances_response}
        ]

        client = MWAAClient(
            AWSCredentials(
                awsAccessKeyId="key", awsSecretAccessKey="secret", awsRegion="us-east-1"
            ),
            "test-env",
        )

        result = client.get_task_instances_for_run("test_dag", "run_1")

        assert len(result) == 1
        assert result[0].task_id == ""
