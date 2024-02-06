from functools import partial
from typing import Optional, List, Type

from google import auth
from google.cloud.bigtable import Client


NoProject = object()


class MultiProjectClient:
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

    def __getattr__(self, item):
        return partial(self._call, item)

    def _call(self, method, project_id, *args, **kwargs):
        client = self.clients.get(project_id, self.clients.get(NoProject))
        if not client:
            raise ValueError(f"Project {project_id} not found")
        return getattr(client, method)(*args, **kwargs)
