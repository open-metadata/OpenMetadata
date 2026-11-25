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
The Dremio REST client, with the HTTP session mocked
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.database.dremioConnection import (
    DremioConnection,
)
from metadata.ingestion.source.database.dremio.client import (
    RESULTS_PAGE_SIZE,
    DremioClient,
    DremioJobError,
)
from metadata.ingestion.source.database.dremio.connection import DremioConnection as DremioRestConnection
from metadata.utils.ssl_registry import InvalidSSLVerificationException

from ._fixtures import FakeResponse  # noqa: TID252

SOFTWARE = {"authType": {"hostPort": "https://dremio:9047/", "username": "u", "password": "p"}}
CLOUD = {"authType": {"region": "EU", "personalAccessToken": "pat", "projectId": "proj_1"}}


def client_for(config: dict, session: MagicMock | None = None) -> tuple[DremioClient, MagicMock]:
    session = session or MagicMock(headers={})
    session.post.return_value = FakeResponse(200, {"token": "tok"})
    with patch("metadata.ingestion.source.database.dremio.client.requests.Session", return_value=session):
        return DremioClient(DremioConnection.model_validate(config)), session


def connection_for(auth: dict) -> tuple[DremioRestConnection, MagicMock]:
    """The connection resolves verifySSL and sslConfig, the session records what each request was sent with"""
    session = MagicMock(headers={})
    session.post.return_value = FakeResponse(200, {"token": "tok"})
    session.get.return_value = FakeResponse(200, {"data": []})
    connection = DremioRestConnection(DremioConnection.model_validate({"authType": {**SOFTWARE["authType"], **auth}}))
    with patch("metadata.ingestion.source.database.dremio.client.requests.Session", return_value=session):
        connection.client.get("/catalog")
    return connection, session


class TestAuthentication:
    def test_cloud_uses_the_region_and_the_token(self):
        client, session = client_for(CLOUD)

        assert client.is_cloud
        assert client._build_url("/catalog") == "https://api.eu.dremio.cloud/v0/projects/proj_1/catalog"
        assert session.headers["Authorization"] == "Bearer pat"
        session.post.assert_not_called()

    def test_software_logs_in_through_the_session(self):
        client, session = client_for(SOFTWARE)

        assert session.post.call_args.args[0] == "https://dremio:9047/apiv2/login"
        assert session.headers["Authorization"] == "_dremiotok"
        assert client._build_url("/sql") == "https://dremio:9047/api/v3/sql"
        assert client._build_url("/api/v3/catalog") == "https://dremio:9047/api/v3/catalog"

    def test_a_login_without_token_fails(self):
        session = MagicMock(headers={})
        session.post.return_value = FakeResponse(200, {})
        with (
            patch("metadata.ingestion.source.database.dremio.client.requests.Session", return_value=session),
            pytest.raises(ValueError, match="no token"),
        ):
            DremioClient(DremioConnection.model_validate(SOFTWARE))


class TestCertificate:
    @pytest.mark.parametrize(("verify_ssl", "expected"), [("no-ssl", True), ("ignore", False)])
    def test_login_and_api_requests_get_the_resolved_verify(self, verify_ssl, expected):
        _, session = connection_for({"verifySSL": verify_ssl})

        assert session.post.call_args.kwargs["verify"] is expected
        assert session.get.call_args.kwargs["verify"] is expected

    def test_validate_checks_both_requests_against_the_inline_ca_removed_on_close(self):
        connection, session = connection_for({"verifySSL": "validate", "sslConfig": {"caCertificate": "PEM"}})

        ca_file = session.post.call_args.kwargs["verify"]
        assert session.get.call_args.kwargs["verify"] == ca_file
        assert Path(ca_file).read_text(encoding="utf-8") == "PEM"
        connection.close()
        assert not Path(ca_file).exists()

    @pytest.mark.parametrize("ssl_config", [{}, {"sslConfig": {}}])
    def test_validate_without_a_ca_is_a_configuration_error(self, ssl_config):
        session = MagicMock(headers={})
        connection = DremioRestConnection(
            DremioConnection.model_validate(
                {"authType": {**SOFTWARE["authType"], "verifySSL": "validate", **ssl_config}}
            )
        )

        with (
            patch("metadata.ingestion.source.database.dremio.client.requests.Session", return_value=session),
            pytest.raises(InvalidSSLVerificationException, match="SSL Config is missing"),
        ):
            _ = connection.client
        session.post.assert_not_called()


class TestSql:
    def run(self, *job_answers: FakeResponse, pages: list[list[dict]] = ()) -> list[dict]:
        client, session = client_for(SOFTWARE)
        session.post.return_value = FakeResponse(200, {"id": "job_1"})
        session.get.side_effect = [*job_answers, *(FakeResponse(200, {"rows": page}) for page in pages)]
        with patch("metadata.ingestion.source.database.dremio.client.time.sleep"):
            return client.execute_sql("SELECT 1", timeout=60)

    def test_the_rows_of_every_page(self):
        first = [{"n": n} for n in range(RESULTS_PAGE_SIZE)]

        rows = self.run(
            FakeResponse(200, {"jobState": "RUNNING"}),
            FakeResponse(200, {"jobState": "COMPLETED"}),
            pages=[first, [{"n": "last"}]],
        )

        assert rows == [*first, {"n": "last"}]

    def test_a_failed_job_raises(self):
        with pytest.raises(DremioJobError, match="FAILED: Table not found"):
            self.run(FakeResponse(200, {"jobState": "FAILED", "errorMessage": "Table not found"}))

    def test_a_job_that_does_not_finish_raises(self):
        with (
            patch("metadata.ingestion.source.database.dremio.client.time.monotonic", side_effect=[0, 0, 120]),
            pytest.raises(DremioJobError, match="did not complete"),
        ):
            self.run(FakeResponse(200, {"jobState": "RUNNING"}))
