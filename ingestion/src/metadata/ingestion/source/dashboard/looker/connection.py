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
Source connection handler
"""

import os
from typing import Optional

import looker_sdk
from looker_sdk.sdk.api40.methods import Looker40SDK

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection as LookerConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


class LookerConnection(BaseConnection[LookerConnectionConfig, Looker40SDK]):
    def _get_client(self) -> Looker40SDK:
        connection = self.service_connection
        if not os.environ.get("LOOKERSDK_CLIENT_ID"):
            os.environ["LOOKERSDK_CLIENT_ID"] = connection.clientId
        if not os.environ.get("LOOKERSDK_CLIENT_SECRET"):
            os.environ["LOOKERSDK_CLIENT_SECRET"] = connection.clientSecret.get_secret_value()
        if not os.environ.get("LOOKERSDK_BASE_URL"):
            os.environ["LOOKERSDK_BASE_URL"] = str(connection.hostPort)

        return looker_sdk.init40()

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        client = self.client
        service_connection = self.service_connection

        def list_datamodels_test():
            """
            Make sure that we get a non-empty result
            """
            assert client.all_lookml_models(limit=1)

        def validate_api_version():
            """
            Make sure we get a True
            """
            assert "4.0" in (api_version.version for api_version in client.versions().supported_versions)  # pyright: ignore[reportOptionalIterable]

        test_fn = {
            "CheckAccess": client.me,
            "ValidateVersion": validate_api_version,
            "ListDashboards": lambda: client.all_dashboards(fields="id,title"),
            "ListLookMLModels": list_datamodels_test,
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
