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

"""POST /run_automation must report a workflow deleted before its runner ran."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Blueprint

from metadata.automations.execute_runner import WORKFLOW_NOT_FOUND
from openmetadata_managed_apis.api.routes import run_automation as route_module


def _identity_decorator(_permissions):
    """Neutralize the Airflow auth wrapper so the route body can be unit-tested."""

    def deco(fn):
        return fn

    return deco


def _call_route():
    """Register and invoke the route without a live Airflow app or auth context."""
    with patch(
        "openmetadata_managed_apis.utils.airflow_version.is_airflow_3_or_higher",
        return_value=True,
    ), patch(
        "openmetadata_managed_apis.utils.security_compat.requires_access_decorator",
        side_effect=_identity_decorator,
    ):
        route = route_module.get_fn(Blueprint("test-run-automation", __name__))

    # The Flask request proxy is patched while the route body actually runs.
    with patch.object(route_module, "request", MagicMock()) as req:
        req.get_json.return_value = {}
        return route()


def _workflow(name):
    return SimpleNamespace(
        name=name,
        openMetadataServerConnection=SimpleNamespace(
            secretsManagerProvider="noop", secretsManagerLoader=None
        ),
    )


def test_deleted_workflow_reports_not_found():
    """A workflow deleted between submission and get_by_name() is reported gone."""
    with patch.object(
        route_module, "parse_automation_workflow_gracefully", return_value=_workflow("deleted-workflow")
    ), patch.object(route_module, "SecretsManagerFactory"), patch.object(
        route_module, "execute", return_value=WORKFLOW_NOT_FOUND
    ), patch.object(route_module, "ApiResponse") as api_response:
        _call_route()

    api_response.not_found.assert_called_once()
    api_response.success.assert_not_called()


def test_live_workflow_reports_triggered():
    """No regression: a normally dispatched workflow still reports triggered."""
    with patch.object(
        route_module, "parse_automation_workflow_gracefully", return_value=_workflow("live-workflow")
    ), patch.object(route_module, "SecretsManagerFactory"), patch.object(
        route_module, "execute", return_value=None
    ), patch.object(route_module, "ApiResponse") as api_response:
        _call_route()

    api_response.success.assert_called_once()
    api_response.not_found.assert_not_called()
