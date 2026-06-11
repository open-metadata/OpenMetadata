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

from functools import partial
from typing import Any, Optional

from pydantic import BaseModel

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.couchbaseConnection import (
    CouchbaseConnection as CouchbaseConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


class CouchbaseConnection(BaseConnection[CouchbaseConnectionConfig, Any]):
    def _get_client(self) -> Any:
        # pylint: disable=import-outside-toplevel
        from couchbase.auth import PasswordAuthenticator  # noqa: PLC0415
        from couchbase.cluster import Cluster  # noqa: PLC0415
        from couchbase.options import ClusterOptions  # noqa: PLC0415

        connection = self.service_connection
        auth = PasswordAuthenticator(connection.username, connection.password.get_secret_value())
        url = f"{connection.scheme.value}://{connection.hostport}"  # pyright: ignore[reportOptionalMemberAccess]
        return Cluster.connect(url, ClusterOptions(auth))

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
        # pylint: disable=import-outside-toplevel
        from couchbase.cluster import Cluster  # noqa: PLC0415

        client = self.client

        class SchemaHolder(BaseModel):
            database: Optional[str] = None  # noqa: UP045

        holder = SchemaHolder()

        def test_get_databases(client: Cluster, holder: SchemaHolder):
            buckets = client.buckets()
            list_bucket = buckets.get_all_buckets()
            for database in list_bucket:
                holder.database = database.name
                break

        def test_get_collections(client: Cluster, holder: SchemaHolder):
            database = client.bucket(holder.database)
            collection_manager = database.collections()
            collection_manager.get_all_scopes()

        test_fn = {
            "GetDatabases": partial(test_get_databases, client, holder),
            "GetCollections": partial(test_get_collections, client, holder),
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=self.service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
