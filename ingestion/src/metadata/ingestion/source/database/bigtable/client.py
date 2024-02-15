#  Copyright 2024 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""A client for Google Cloud Bigtable that supports multiple projects."""
from functools import partial
from typing import List, Optional, Type

from google import auth
from google.cloud.bigtable import Client

NoProject = object()


class MultiProjectClient:
    """Google Cloud Client does not support ad-hoc project switching. This class wraps the client and allows
    switching between projects. If no project is specified, the client will not have a project set and will try
    to resolve it from ADC.
    Example usage:
    ```
    from google.cloud.bigtable import Client
    client = MultiProjectClient(Client, project_ids=["project1", "project2"])
    instances_project1 = client.list_instances("project1")
    instances_project2 = client.list_instances("project2")
    """

    def __init__(
        self,
        client_class: Type[Client],
        project_ids: Optional[List[str]] = None,
        **client_kwargs,
    ):
        if project_ids:
            self.clients = {
                project_id: client_class(project=project_id, **client_kwargs)
                for project_id in project_ids
            }
        else:
            self.clients = {NoProject: client_class(**client_kwargs)}

    def project_ids(self):
        if NoProject in self.clients:
            _, project_id = auth.default()
            return [project_id]
        return list(self.clients.keys())

    def __getattr__(self, client_method):
        """Return the underlying client method as a partial function so we can inject the project_id."""
        return partial(self._call, client_method)

    def _call(self, method, project_id, *args, **kwargs):
        """Call the method on the client for the given project_id. The args and kwargs are passed through."""
        client = self.clients.get(project_id, self.clients.get(NoProject))
        if not client:
            raise ValueError(f"Project {project_id} not found")
        return getattr(client, method)(*args, **kwargs)
