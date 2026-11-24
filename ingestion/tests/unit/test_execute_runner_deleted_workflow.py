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

"""A deleted automation workflow must not crash the runner (issue #38521)."""

from unittest.mock import MagicMock, patch

from metadata.automations import execute_runner


def test_execute_skips_deleted_workflow():
    """get_by_name returns None for a hard-deleted workflow: execute must not raise.

    A test-connection workflow is ephemeral. If the UI deletes it while its
    Kubernetes Job is still waiting for a Pod, the eventual runner finds no
    workflow. It used to dereference ``None.request`` -> AttributeError, which
    the Job retried as a transient failure. The runner should exit cleanly.
    """
    encrypted = MagicMock()
    encrypted.name.root = "deleted-test-workflow"
    encrypted.openMetadataServerConnection = MagicMock()

    client = MagicMock()
    client.get_by_name.return_value = None  # workflow was hard-deleted

    with patch.object(execute_runner, "OpenMetadata", return_value=client), patch.object(
        execute_runner, "run_workflow"
    ) as run_workflow:
        result = execute_runner.execute(encrypted)

    assert result is None
    run_workflow.assert_not_called()


def test_execute_still_runs_existing_workflow():
    """No regression: an existing workflow is still dispatched to run_workflow."""
    encrypted = MagicMock()
    encrypted.name.root = "live-workflow"
    encrypted.openMetadataServerConnection = MagicMock()

    workflow = MagicMock()
    workflow.request = MagicMock()
    client = MagicMock()
    client.get_by_name.return_value = workflow

    with patch.object(execute_runner, "OpenMetadata", return_value=client), patch.object(
        execute_runner, "run_workflow"
    ) as run_workflow:
        execute_runner.execute(encrypted)

    run_workflow.assert_called_once()
