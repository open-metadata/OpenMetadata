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
Tests for the Kubernetes exit handler module.
Tests the fault-tolerant diagnostics gathering for failed pipeline jobs.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add the operators/docker directory to the path for imports
operators_path = Path(__file__).parent.parent.parent / "operators" / "docker"
sys.path.insert(0, str(operators_path))

from exit_handler import (
    FailureDiagnostics,
    create_pod_diagnostics,
    find_main_pod,
    gather_failure_diagnostics,
    get_kubernetes_client,
    get_main_pod_description,
    get_main_pod_logs,
)


class TestFailureDiagnostics:
    """Test the FailureDiagnostics model."""

    def test_has_diagnostics_with_logs(self):
        """Test has_diagnostics returns True when logs are present."""
        diagnostics = FailureDiagnostics(pod_logs="some logs")
        assert diagnostics.has_diagnostics is True

    def test_has_diagnostics_with_description(self):
        """Test has_diagnostics returns True when description is present."""
        diagnostics = FailureDiagnostics(pod_description="pod info")
        assert diagnostics.has_diagnostics is True

    def test_has_diagnostics_with_both(self):
        """Test has_diagnostics returns True when both are present."""
        diagnostics = FailureDiagnostics(pod_logs="logs", pod_description="desc")
        assert diagnostics.has_diagnostics is True

    def test_has_diagnostics_empty(self):
        """Test has_diagnostics returns False when nothing is present."""
        diagnostics = FailureDiagnostics()
        assert diagnostics.has_diagnostics is False

    def test_summary_with_logs(self):
        """Test summary includes log line count."""
        diagnostics = FailureDiagnostics(pod_logs="line1\nline2\nline3")
        assert "logs (3 lines)" in diagnostics.summary

    def test_summary_with_description(self):
        """Test summary includes pod description."""
        diagnostics = FailureDiagnostics(pod_description="pod info")
        assert "pod description" in diagnostics.summary

    def test_summary_empty(self):
        """Test summary when no diagnostics available."""
        diagnostics = FailureDiagnostics()
        assert diagnostics.summary == "No diagnostics available"


class TestGetKubernetesClient:
    """Test Kubernetes client initialization."""

    @patch("exit_handler.config")
    @patch("exit_handler.client")
    def test_in_cluster_config_success(self, mock_client, mock_config):
        """Test successful in-cluster configuration."""
        mock_api = MagicMock()
        mock_client.CoreV1Api.return_value = mock_api

        result = get_kubernetes_client()

        mock_config.load_incluster_config.assert_called_once()
        assert result == mock_api

    @patch("exit_handler.config")
    @patch("exit_handler.client")
    def test_fallback_to_kubeconfig(self, mock_client, mock_config):
        """Test fallback to kubeconfig when in-cluster fails."""
        mock_config.load_incluster_config.side_effect = Exception("Not in cluster")
        mock_api = MagicMock()
        mock_client.CoreV1Api.return_value = mock_api

        result = get_kubernetes_client()

        mock_config.load_kube_config.assert_called_once()
        assert result == mock_api

    @patch("exit_handler.config")
    def test_returns_none_on_failure(self, mock_config):
        """Test returns None when all config methods fail."""
        mock_config.load_incluster_config.side_effect = Exception("Failed")
        mock_config.load_kube_config.side_effect = Exception("Failed")

        result = get_kubernetes_client()

        assert result is None


class TestFindMainPod:
    """Test main pod discovery."""

    def test_returns_none_with_invalid_params(self):
        """Test returns None when required params are missing."""
        mock_client = MagicMock()

        result = find_main_pod(mock_client, None, "")
        assert result is None

        result = find_main_pod(mock_client, "", "namespace")
        assert result is None

    def test_finds_pod_by_job_name_label(self):
        """Test finding pod by job-name label."""
        mock_client = MagicMock()
        mock_pod = MagicMock()
        mock_pod.metadata.name = "test-pod"

        mock_pod_list = MagicMock()
        mock_pod_list.items = [mock_pod]
        mock_client.list_namespaced_pod.return_value = mock_pod_list

        result = find_main_pod(mock_client, "test-job", "test-namespace")

        assert result == mock_pod
        mock_client.list_namespaced_pod.assert_called()

    def test_returns_none_when_no_pods_found(self):
        """Test returns None when no matching pods exist."""
        mock_client = MagicMock()
        mock_pod_list = MagicMock()
        mock_pod_list.items = []
        mock_client.list_namespaced_pod.return_value = mock_pod_list

        result = find_main_pod(mock_client, "nonexistent-job", "test-namespace")

        assert result is None

    def test_handles_api_exceptions_gracefully(self):
        """Test graceful handling of K8s API exceptions."""
        mock_client = MagicMock()
        mock_client.list_namespaced_pod.side_effect = Exception("API Error")

        result = find_main_pod(mock_client, "test-job", "test-namespace")

        assert result is None


class TestGetMainPodLogs:
    """Test pod log retrieval."""

    def test_returns_logs_successfully(self):
        """Test successful log retrieval."""
        mock_client = MagicMock()
        mock_client.read_namespaced_pod_log.return_value = "log line 1\nlog line 2"

        mock_pod = MagicMock()
        mock_pod.metadata.name = "test-pod"

        result = get_main_pod_logs(mock_client, mock_pod, "test-namespace")

        assert result == "log line 1\nlog line 2"
        mock_client.read_namespaced_pod_log.assert_called_once_with(
            name="test-pod",
            namespace="test-namespace",
            container="main",
            tail_lines=500,
        )

    def test_returns_none_for_invalid_pod(self):
        """Test returns None for invalid pod object."""
        mock_client = MagicMock()

        result = get_main_pod_logs(mock_client, None, "test-namespace")
        assert result is None

        mock_pod = MagicMock()
        mock_pod.metadata = None
        result = get_main_pod_logs(mock_client, mock_pod, "test-namespace")
        assert result is None

    def test_handles_api_exceptions_gracefully(self):
        """Test graceful handling of log fetch failures."""
        mock_client = MagicMock()
        mock_client.read_namespaced_pod_log.side_effect = Exception("Log fetch failed")

        mock_pod = MagicMock()
        mock_pod.metadata.name = "test-pod"

        result = get_main_pod_logs(mock_client, mock_pod, "test-namespace")

        assert result is None


class TestGetMainPodDescription:
    """Test pod description gathering."""

    def test_builds_description_with_status(self):
        """Test building description with pod status."""
        mock_client = MagicMock()
        mock_events = MagicMock()
        mock_events.items = []
        mock_client.list_namespaced_event.return_value = mock_events

        mock_pod = MagicMock()
        mock_pod.metadata.name = "test-pod"
        mock_pod.status.phase = "Failed"
        mock_pod.status.reason = "OOMKilled"
        mock_pod.status.message = "Container exceeded memory limit"
        mock_pod.status.container_statuses = []

        result = get_main_pod_description(mock_client, mock_pod, "test-namespace")

        assert result is not None
        assert "test-pod" in result
        assert "Failed" in result
        assert "OOMKilled" in result

    def test_returns_none_for_invalid_pod(self):
        """Test returns None for invalid pod object."""
        mock_client = MagicMock()

        result = get_main_pod_description(mock_client, None, "test-namespace")
        assert result is None

    def test_handles_exceptions_gracefully(self):
        """Test graceful handling of description failures."""
        mock_client = MagicMock()
        mock_client.list_namespaced_event.side_effect = Exception("Event fetch failed")

        mock_pod = MagicMock()
        mock_pod.metadata.name = "test-pod"
        mock_pod.status = None

        result = get_main_pod_description(mock_client, mock_pod, "test-namespace")
        assert result is not None


class TestGatherFailureDiagnostics:
    """Test the main diagnostics gathering function."""

    @patch("exit_handler.get_kubernetes_client")
    def test_returns_empty_when_k8s_unavailable(self, mock_get_client):
        """Test returns empty diagnostics when K8s client unavailable."""
        mock_get_client.return_value = None

        result = gather_failure_diagnostics("test-job", "test-namespace")

        assert result.has_diagnostics is False

    @patch("exit_handler.get_kubernetes_client")
    @patch("exit_handler.find_main_pod")
    def test_returns_empty_when_pod_not_found(self, mock_find_pod, mock_get_client):
        """Test returns empty diagnostics when pod not found."""
        mock_get_client.return_value = MagicMock()
        mock_find_pod.return_value = None

        result = gather_failure_diagnostics("test-job", "test-namespace")

        assert result.has_diagnostics is False

    @patch("exit_handler.get_kubernetes_client")
    @patch("exit_handler.find_main_pod")
    @patch("exit_handler.get_main_pod_logs")
    @patch("exit_handler.get_main_pod_description")
    def test_gathers_all_diagnostics(
        self, mock_description, mock_logs, mock_find_pod, mock_get_client
    ):
        """Test gathering complete diagnostics."""
        mock_get_client.return_value = MagicMock()
        mock_find_pod.return_value = MagicMock()
        mock_logs.return_value = "error logs"
        mock_description.return_value = "pod failed"

        result = gather_failure_diagnostics("test-job", "test-namespace")

        assert result.has_diagnostics is True
        assert result.pod_logs == "error logs"
        assert result.pod_description == "pod failed"

    @patch("exit_handler.get_kubernetes_client")
    @patch("exit_handler.find_main_pod")
    @patch("exit_handler.get_main_pod_logs")
    @patch("exit_handler.get_main_pod_description")
    def test_continues_on_partial_failure(
        self, mock_description, mock_logs, mock_find_pod, mock_get_client
    ):
        """Test continues gathering even when some operations fail."""
        mock_get_client.return_value = MagicMock()
        mock_find_pod.return_value = MagicMock()
        mock_logs.side_effect = Exception("Log fetch failed")
        mock_description.return_value = "pod description"

        result = gather_failure_diagnostics("test-job", "test-namespace")

        assert result.has_diagnostics is True
        assert result.pod_logs is None
        assert result.pod_description == "pod description"


class TestCreatePodDiagnostics:
    """Test StepSummary creation from diagnostics."""

    def test_creates_step_summary_with_logs(self):
        """Test creating StepSummary with logs."""
        result = create_pod_diagnostics("error log line", None)

        assert result.name == "Pod Diagnostics"
        assert result.errors == 1
        assert len(result.failures) == 1
        assert "error log line" in result.failures[0].stackTrace

    def test_creates_step_summary_with_description(self):
        """Test creating StepSummary with description."""
        result = create_pod_diagnostics(None, "Pod: test-pod\nStatus: Failed")

        assert result.name == "Pod Diagnostics"
        assert "Pod: test-pod" in result.failures[0].stackTrace

    def test_creates_step_summary_with_both(self):
        """Test creating StepSummary with both logs and description."""
        result = create_pod_diagnostics("logs here", "description here")

        stack_trace = result.failures[0].stackTrace
        assert "logs here" in stack_trace
        assert "description here" in stack_trace

    def test_handles_empty_diagnostics(self):
        """Test creating StepSummary when no diagnostics available."""
        result = create_pod_diagnostics(None, None)

        assert result.name == "Pod Diagnostics"
        assert "No diagnostics available" in result.failures[0].stackTrace
