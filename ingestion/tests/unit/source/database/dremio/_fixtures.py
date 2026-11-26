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
A fake Dremio REST API, answering from a dict of endpoint to JSON body
"""

import requests

SOFTWARE_CONFIG = {
    "type": "dremio",
    "serviceName": "svc",
    "serviceConnection": {
        "config": {
            "type": "Dremio",
            "authType": {"hostPort": "http://dremio:9047", "username": "u", "password": "p"},
        }
    },
    "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
}


class FakeResponse:
    def __init__(self, status_code: int, body: dict):
        self.status_code = status_code
        self.body = body

    def json(self) -> dict:
        return self.body

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")


class FakeDremio:
    """An endpoint missing from `answers` is a 404, an exception in it is raised"""

    def __init__(self, answers: dict, is_cloud: bool = False):
        self.answers = answers
        self.is_cloud = is_cloud
        self.requested: list[str] = []

    def get(self, endpoint: str, **_) -> FakeResponse:
        self.requested.append(endpoint)
        answer = self.answers.get(endpoint)
        if isinstance(answer, Exception):
            raise answer
        return FakeResponse(404, {}) if answer is None else FakeResponse(200, answer)


def dataset(*path: str, view: bool = False, id_: str | None = None) -> dict:
    return {
        "type": "DATASET",
        "path": list(path),
        "datasetType": "VIRTUAL" if view else "PROMOTED",
        "id": id_ or "/".join(path),
    }


def folder(*path: str) -> dict:
    return {"type": "CONTAINER", "containerType": "FOLDER", "path": list(path), "id": "/".join(path)}
