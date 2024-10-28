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
Source connection handler
"""
from functools import partial
from typing import Any, Optional

from pydantic import BaseModel

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.couchbaseConnection import (
    CouchbaseConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


def get_connection(connection: CouchbaseConnection):
    """
    Create connection
    """
    # pylint: disable=import-outside-toplevel
    from couchbase.auth import PasswordAuthenticator
    from couchbase.cluster import Cluster
    from couchbase.options import ClusterOptions

    auth = PasswordAuthenticator(
        connection.username, connection.password.get_secret_value()
    )
    url = f"{connection.scheme.value}://{connection.hostport}"
    couchbase_cluster = Cluster.connect(url, ClusterOptions(auth))
    return couchbase_cluster


def test_connection(
    metadata: OpenMetadata,
    client: Any,
    service_connection: CouchbaseConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    # pylint: disable=import-outside-toplevel
    from couchbase.cluster import Cluster

    class SchemaHolder(BaseModel):
        database: Optional[str] = None

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
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
