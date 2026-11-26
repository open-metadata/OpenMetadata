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

# Import the runner module at collection time so the @run_workflow.register
# handlers are installed on the real singledispatch before any test patches it.
# execute() imports this lazily; doing it here keeps the dispatcher independent
# of test order and of patches applied inside execute().
from metadata.automations import runner as _runner  # noqa: F401
from metadata.automations.execute_runner import WORKFLOW_NOT_FOUND
from metadata.generated.schema.entity.automations.testServiceConnection import (
    TestServiceConnectionRequest,
)


def _build_test_connection_request():
    """A minimal real request so dispatch resolves through the real registry."""
    return TestServiceConnectionRequest(connection=MagicMock())


def test_execute_skips_deleted_workflow():
    """get_by_name returns None for a hard-deleted workflow: execute reports a
    distinct outcome instead of raising, and the real dispatcher stays usable."""
    encrypted = MagicMock()
    encrypted.name.root = "deleted-test-workflow"
    encrypted.openMetadataServerConnection = MagicMock()

    client = MagicMock()
    client.get_by_name.return_value = None  # workflow was hard-deleted

    with patch.object(execute_runner, "OpenMetadata", return_value=client):
        result = execute_runner.execute(encrypted)

    assert result is WORKFLOW_NOT_FOUND
    assert result is not None

    # The real dispatcher must still be registered after this test. Dispatch a
    # real TestServiceConnectionRequest and confirm the registered handler runs
    # (it used to raise NotImplementedError once run_workflow had been mocked).
    with patch("metadata.automations.runner.check_ssl_and_init", return_value=None), patch(
        "metadata.automations.runner._test_connection", return_value=None
    ) as test_connection:
        execute_runner.run_workflow(_build_test_connection_request(), MagicMock(), client)

    test_connection.assert_called_once()


def test_execute_still_runs_existing_workflow():
    """No regression: a live workflow is dispatched to run_workflow with the
    exact request, workflow and client, and the real handler actually runs."""
    encrypted = MagicMock()
    encrypted.name.root = "live-workflow"
    encrypted.openMetadataServerConnection = MagicMock()

    workflow = MagicMock()
    workflow.request = _build_test_connection_request()
    client = MagicMock()
    client.get_by_name.return_value = workflow

    # Capture the real dispatcher before patching so a spy can observe the call
    # arguments while still delegating to the registered handler.
    real_dispatch = execute_runner.run_workflow

    with patch.object(execute_runner, "OpenMetadata", return_value=client), patch.object(
        execute_runner, "run_workflow", wraps=real_dispatch
    ) as dispatch_spy, patch("metadata.automations.runner.check_ssl_and_init", return_value=None), patch(
        "metadata.automations.runner._test_connection", return_value=None
    ) as test_connection:
        result = execute_runner.execute(encrypted)

    # Guard the unchanged dispatch path: (workflow.request, workflow, client).
    dispatch_spy.assert_called_once_with(workflow.request, workflow, client)
    # The real handler actually ran through the connection boundary.
    test_connection.assert_called_once()
    # The live handler returns None, which is distinct from WORKFLOW_NOT_FOUND.
    assert result is None
    assert result is not WORKFLOW_NOT_FOUND
