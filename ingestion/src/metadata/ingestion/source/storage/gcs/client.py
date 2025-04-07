#  Copyright 2024 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""A client for Google Cloud Storage that supports multiple projects."""
from functools import partial
from typing import List, Optional, Type, Union

from google import auth
from google.cloud.monitoring_v3 import MetricServiceClient
from google.cloud.storage import Client


class MultiProjectClient:
    """Google Cloud Client does not support ad-hoc project switching. This class wraps the client and allows
    switching between projects. If no project is specified, the client will not have a project set and will try
    to resolve it from ADC.
    Example usage:
    ```
    from google.cloud.storage import Client
    client = MultiProjectClient(Client, project_ids=["project1", "project2"])
    buckets_project1 = client.list_buckets("project1")
    buckets_project2 = client.list_buckets("project2")
    """

    def __init__(
        self,
        client_class: Union[Type[Client], Type[MetricServiceClient]],
        project_ids: Optional[List[str]] = None,
        **client_kwargs,
    ):
        self.default_project = None
        if project_ids:
            self.clients = {
                project_id: client_class(project=project_id, **client_kwargs)
                for project_id in project_ids
            }
        else:
            _, project_id = auth.default()
            self.default_project = project_id
            self.clients = {project_id: client_class(**client_kwargs)}

    def __getattr__(self, client_method):
        """Return the underlying client method as a partial function so we can inject the project_id."""
        return partial(self._call, client_method)

    def _call(self, method, project_id, *args, **kwargs):
        """Call the method on the client for the given project_id. The args and kwargs are passed through."""
        client = self.clients.get(project_id, self.clients.get(self.default_project))
        if not client:
            raise ValueError(f"Project {project_id} not found")
        return getattr(client, method)(*args, **kwargs)
