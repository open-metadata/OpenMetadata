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
Salesforce Data 360 pipeline connection handler
"""

from simple_salesforce.api import Salesforce
from simple_salesforce.exceptions import SalesforceAuthenticationFailed

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.pipeline.data360PipelineConnection import (
    Data360PipelineConnection as Data360PipelineConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.data360.client import (
    get_calculated_insights,
    get_datastreams,
    get_datatransforms,
)
from metadata.ingestion.source.pipeline.data360pipeline.exceptions import (
    InvalidDomainException,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# The steps below prove the connected app can reach each API; they are not a dry
# run of the ingestion, so they read only the first page, of the smallest size the
# endpoints allow.
PROBE_LIMIT = 1

# The OAuth client credentials flow only works on the org's My Domain. simple_salesforce
# does not even try it on `login` or `test` and falls back to a password login, whose
# error says nothing about the domain; any other wrong host gets this answer. See
# ADR:2026-11-12-data360-pipeline-authenticates-on-the-org-my-domain.
GENERIC_LOGIN_DOMAINS = ("login", "test")
UNSUPPORTED_DOMAIN_ERROR = "request not supported on this domain"


def _my_domain_hint(domain: str) -> str:
    return f"Set the Salesforce Domain to the org's My Domain (e.g. `mycompany.my`), not `{domain}`."


class Data360PipelineConnection(BaseConnection[Data360PipelineConnectionConfig, Salesforce]):
    def _get_client(self) -> Salesforce:
        connection = self.service_connection
        if connection.salesforceDomain in GENERIC_LOGIN_DOMAINS:
            raise InvalidDomainException(
                f"Data 360 authenticates with OAuth client credentials. {_my_domain_hint(connection.salesforceDomain)}"
            )
        try:
            client = Salesforce(
                consumer_key=connection.consumerKey.get_secret_value(),
                consumer_secret=connection.consumerSecret.get_secret_value(),
                domain=connection.salesforceDomain,
                version=connection.salesforceApiVersion,
            )
        except SalesforceAuthenticationFailed as exc:
            if UNSUPPORTED_DOMAIN_ERROR in str(exc):
                raise InvalidDomainException(f"{exc}. {_my_domain_hint(connection.salesforceDomain)}") from exc
            raise
        # simple_salesforce opens a requests.Session per client. This one is ours,
        # so it is released with the connection rather than at interpreter exit.
        session = getattr(client, "session", None)
        if session is not None:
            self._on_close(session.close)
        return client

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        """Validates connectivity and that the connected app can list each object
        type ingested as a pipeline. Authenticating is not enough on its own, since
        Data 360 grants its scopes per API.

        The client logs in when it is first built, so it is built inside the steps: a
        rejected login then fails ``CheckAccess`` with its reason instead of escaping
        before any step result is written."""
        service_connection = self.service_connection

        def probe(getter):
            return lambda: getter(
                self.client,
                pagination_limit=PROBE_LIMIT,
                log_warning=logger.warning,
                first_page_only=True,
            )

        def check_access():
            # Not `self.client.describe`: that would log in right here, outside the steps.
            return self.client.describe()

        test_fn = {
            "CheckAccess": check_access,
            "GetPipelines": probe(get_datastreams),
            "GetCalculatedInsights": probe(get_calculated_insights),
            "GetDataTransforms": probe(get_datatransforms),
        }
        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
