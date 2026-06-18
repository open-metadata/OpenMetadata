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
Salesforce Data 360 connection handler
"""


from simple_salesforce.api import Salesforce

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.data360Connection import (
    Data360Connection,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def get_connection(connection: Data360Connection) -> Salesforce:
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
    service_connection: Data360Connection,
    automation_workflow: AutomationWorkflow | None = None,
):
    """Validates connectivity to the Salesforce Data 360 instance."""
    test_fn = {"CheckAccess": client.describe}
    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
