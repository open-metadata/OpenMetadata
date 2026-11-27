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
Client of the Dremio REST API, for Dremio Cloud and Dremio Software.
ADR:2026-11-23-dremio-connector-reads-the-rest-api-not-arrow-flight
"""

import time
from collections.abc import Iterator

import requests

from metadata.generated.schema.entity.services.connections.database.dremio.cloudAuth import (
    DremioCloudAuthentication,
    Region,
)
from metadata.generated.schema.entity.services.connections.database.dremio.softwareAuth import (
    DremioSoftwareAuthentication,
)
from metadata.generated.schema.entity.services.connections.database.dremioConnection import (
    DremioConnection,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

CLOUD_API_URLS = {
    Region.US: "https://api.dremio.cloud",
    Region.EU: "https://api.eu.dremio.cloud",
}
SOFTWARE_API_PREFIX = "/api/v3"
# ADR:2026-11-23-dremio-connector-reads-the-rest-api-not-arrow-flight
REQUEST_TIMEOUT_SECONDS = 60
SQL_TIMEOUT_SECONDS = 300
JOB_POLL_SECONDS = 2
# The largest page the job results endpoint returns
RESULTS_PAGE_SIZE = 500


class DremioJobError(RuntimeError):
    """A SQL job that Dremio failed, canceled, or did not finish in time"""


class DremioClient:
    """
    Dremio Cloud authenticates with a Personal Access Token, Dremio Software
    with a username and a password exchanged for a session token.
    """

    def __init__(self, connection: DremioConnection, verify: bool | str = True):
        """`verify` is what DremioConnection resolved from verifySSL and sslConfig"""
        auth = connection.authType
        self.is_cloud = isinstance(auth, DremioCloudAuthentication)
        self.verify = verify
        self.session = requests.Session()
        self.session.headers["Content-Type"] = "application/json"

        if isinstance(auth, DremioCloudAuthentication):
            self.base_url = f"{CLOUD_API_URLS[auth.region]}/v0/projects/{auth.projectId}"
            self.session.headers["Authorization"] = f"Bearer {auth.personalAccessToken.get_secret_value()}"
        elif isinstance(auth, DremioSoftwareAuthentication):
            self.base_url = auth.hostPort.rstrip("/")
            self.session.headers["Authorization"] = f"_dremio{self._login(auth)}"
        else:
            raise TypeError(f"Unsupported Dremio authentication type: {type(auth).__name__}")

    def _login(self, auth: DremioSoftwareAuthentication) -> str:
        response = self.session.post(
            f"{self.base_url}/apiv2/login",
            json={"userName": auth.username, "password": auth.password.get_secret_value()},
            timeout=REQUEST_TIMEOUT_SECONDS,
            verify=self.verify,
        )
        response.raise_for_status()
        token = response.json().get("token")
        if not token:
            raise ValueError("Dremio Software login returned no token")
        return token

    def _build_url(self, endpoint: str) -> str:
        """
        Cloud carries the API root in base_url (/v0/projects/<id>); Software needs
        /api/v3 on every endpoint, /sql and /job as much as /catalog.
        """
        already_prefixed = endpoint == SOFTWARE_API_PREFIX or endpoint.startswith(f"{SOFTWARE_API_PREFIX}/")
        if self.is_cloud or already_prefixed:
            return f"{self.base_url}{endpoint}"
        return f"{self.base_url}{SOFTWARE_API_PREFIX}{endpoint}"

    def get(self, endpoint: str, **kwargs) -> requests.Response:
        # Per request: requests lets REQUESTS_CA_BUNDLE override a session-level verify
        kwargs.setdefault("timeout", REQUEST_TIMEOUT_SECONDS)
        kwargs.setdefault("verify", self.verify)
        return self.session.get(self._build_url(endpoint), **kwargs)

    def post(self, endpoint: str, **kwargs) -> requests.Response:
        kwargs.setdefault("timeout", REQUEST_TIMEOUT_SECONDS)
        kwargs.setdefault("verify", self.verify)
        return self.session.post(self._build_url(endpoint), **kwargs)

    def execute_sql(self, query: str, timeout: int = SQL_TIMEOUT_SECONDS) -> list[dict]:
        """Run a query as a Dremio job and return its rows. Raises if the job does not complete."""
        response = self.post("/sql", json={"sql": query})
        response.raise_for_status()
        job_id = response.json()["id"]
        self._wait_for_job(job_id, timeout)
        return list(self._iter_results(job_id))

    def _wait_for_job(self, job_id: str, timeout: int) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            response = self.get(f"/job/{job_id}")
            response.raise_for_status()
            job = response.json()
            state = job.get("jobState")
            if state == "COMPLETED":
                return
            if state in ("FAILED", "CANCELED"):
                raise DremioJobError(f"Dremio job {job_id} {state}: {job.get('errorMessage')}")
            time.sleep(JOB_POLL_SECONDS)
        raise DremioJobError(f"Dremio job {job_id} did not complete within {timeout} seconds")

    def _iter_results(self, job_id: str) -> Iterator[dict]:
        offset = 0
        while True:
            response = self.get(f"/job/{job_id}/results", params={"offset": offset, "limit": RESULTS_PAGE_SIZE})
            response.raise_for_status()
            rows = response.json().get("rows", [])
            yield from rows
            offset += len(rows)
            if len(rows) < RESULTS_PAGE_SIZE:
                return

    def close(self) -> None:
        self.session.close()
