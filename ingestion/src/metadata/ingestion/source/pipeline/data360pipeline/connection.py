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

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.pipeline.data360PipelineConnection import (
    Data360PipelineConnection,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.data360.client import (
    get_calculated_insights,
    get_datastreams,
    get_datatransforms,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# The steps below prove the connected app can reach each API; they are not a dry
# run of the ingestion, so they ask for the smallest page the endpoints allow.
PROBE_LIMIT = 1


def get_connection(connection: Data360PipelineConnection) -> Salesforce:
    """Creates and returns a Salesforce API client."""
    return Salesforce(
        consumer_key=connection.consumerKey.get_secret_value(),
        consumer_secret=connection.consumerSecret.get_secret_value(),
        domain=connection.salesforceDomain,
        version=connection.salesforceApiVersion,
    )


def test_connection(
    metadata: OpenMetadata,
    client: Salesforce,
    service_connection: Data360PipelineConnection,
    automation_workflow: AutomationWorkflow | None = None,
):
    """Validates connectivity and that the connected app can list each object type
    ingested as a pipeline. Authenticating is not enough on its own, since Data 360
    grants its scopes per API."""
    test_fn = {
        "CheckAccess": client.describe,
        "GetPipelines": lambda: get_datastreams(client, pagination_limit=PROBE_LIMIT, log_warning=logger.warning),
        "GetCalculatedInsights": lambda: get_calculated_insights(
            client, pagination_limit=PROBE_LIMIT, log_warning=logger.warning
        ),
        "GetDataTransforms": lambda: get_datatransforms(
            client, pagination_limit=PROBE_LIMIT, log_warning=logger.warning
        ),
    }
    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
        automation_workflow=automation_workflow,
    )
