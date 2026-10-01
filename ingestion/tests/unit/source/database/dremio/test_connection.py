#  Copyright 2026 Collate
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
Unit tests for the Dremio connection
"""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from pyarrow.lib import ArrowInvalid
from sqlalchemy.engine import Engine, make_url

from metadata.generated.schema.entity.services.connections.database.dremioConnection import (
    DremioConnection as DremioConnectionConfig,
)
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.dremio.connection import (
    DremioConnection,
    get_connection_url,
    get_jobs_table,
)
from metadata.ingestion.source.database.dremio.metadata import DremioSource
from metadata.ingestion.source.database.dremio.queries import DREMIO_JOBS_TABLES
from metadata.ingestion.source.database.dremio.service_spec import ServiceSpec

TEST_CONNECTION_DEFINITION = (
    Path(__file__).parents[6] / "openmetadata-service/src/main/resources/json/data/testConnections/database/dremio.json"
)


def software_config(host_port: str = "http://dremio:9047", password: str = "secret") -> DremioConnectionConfig:
    return DremioConnectionConfig.model_validate(
        {"authType": {"hostPort": host_port, "username": "svc", "password": password}}
    )


def cloud_config(region: str) -> DremioConnectionConfig:
    return DremioConnectionConfig.model_validate(
        {"authType": {"region": region, "personalAccessToken": "pat-value", "projectId": "project"}}
    )


class TestSoftwareConnectionUrl:
    def test_uses_the_flight_port_of_the_rest_host(self):
        url = get_connection_url(software_config("http://dremio.internal:9047"))

        assert url.drivername == "dremio+flight"
        assert url.host == "dremio.internal"
        assert url.port == 32010
        assert url.username == "svc"
        assert url.password == "secret"

    def test_plain_http_disables_encryption(self):
        url = get_connection_url(software_config("http://dremio:9047"))

        assert url.query["UseEncryption"] == "False"

    def test_https_enables_encryption(self):
        url = get_connection_url(software_config("https://dremio:9047"))

        assert url.query["UseEncryption"] == "True"

    def test_special_characters_in_password_are_escaped(self):
        password = "p@ss/w:rd?#&="
        url = get_connection_url(software_config(password=password))

        rendered = url.render_as_string(hide_password=False)

        assert password not in rendered
        # Parsed back from the rendered string, the credentials and host survive
        parsed = make_url(rendered)
        assert parsed.password == password
        assert parsed.host == "dremio"

    def test_no_token_is_sent(self):
        assert "Token" not in get_connection_url(software_config()).query


class TestSoftwareTls:
    CA_CERTIFICATE = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----"

    @staticmethod
    def with_tls(verify_ssl: str, host_port: str = "https://dremio:9047", ssl_config: dict | None = None):
        auth = {"hostPort": host_port, "username": "svc", "password": "secret", "verifySSL": verify_ssl}
        if ssl_config:
            auth["sslConfig"] = ssl_config
        return DremioConnectionConfig.model_validate({"authType": auth})

    def test_the_certificate_is_checked_by_the_system_by_default(self):
        query = get_connection_url(software_config("https://dremio:9047")).query

        assert "DisableCertificateVerification" not in query
        assert "TrustedCerts" not in query

    def test_a_self_signed_certificate_can_be_accepted(self):
        url = get_connection_url(self.with_tls("ignore"))

        assert url.query["UseEncryption"] == "True"
        assert url.query["DisableCertificateVerification"] == "True"

    def test_verifying_is_left_out_without_tls(self):
        query = get_connection_url(self.with_tls("ignore", host_port="http://dremio:9047")).query

        assert query["UseEncryption"] == "False"
        assert "DisableCertificateVerification" not in query

    def test_the_certificate_can_be_checked_against_a_ca(self):
        url = get_connection_url(self.with_tls("validate"), ca_file="/tmp/ca.pem")

        assert url.query["TrustedCerts"] == "/tmp/ca.pem"
        assert "DisableCertificateVerification" not in url.query

    def test_validating_without_a_ca_uses_the_system_authorities(self):
        with patch("metadata.ingestion.source.database.dremio.connection.logger") as logger:
            assert "TrustedCerts" not in get_connection_url(self.with_tls("validate")).query

        logger.warning.assert_called_once()
        assert "without a CA certificate" in logger.warning.call_args.args[0]

    def test_the_ca_certificate_is_a_file_for_as_long_as_the_connection_is_open(self):
        connection = DremioConnection(self.with_tls("validate", ssl_config={"caCertificate": self.CA_CERTIFICATE}))

        with patch("metadata.ingestion.source.database.dremio.connection.create_generic_db_connection") as create:
            create.return_value = MagicMock(spec=Engine)
            connection.client  # noqa: B018
            path = Path(
                create.call_args.kwargs["get_connection_url_fn"](connection.service_connection).query["TrustedCerts"]
            )

            assert path.read_text() == self.CA_CERTIFICATE
            connection.close()

        assert not path.exists()

    def test_no_file_is_written_without_a_ca_certificate(self):
        assert DremioConnection(software_config("https://dremio:9047"))._write_ca_certificate() is None
        assert DremioConnection(self.with_tls("validate"))._write_ca_certificate() is None
        assert DremioConnection(cloud_config("EU"))._write_ca_certificate() is None


class TestCloudConnectionUrl:
    @pytest.mark.parametrize(
        "region,host",
        [("US", "data.dremio.cloud"), ("EU", "data.eu.dremio.cloud")],
    )
    def test_regional_endpoint_over_tls(self, region, host):
        url = get_connection_url(cloud_config(region))

        assert url.host == host
        assert url.port == 443
        assert url.query["UseEncryption"] == "True"

    def test_token_is_sent_without_username_or_password(self):
        url = get_connection_url(cloud_config("EU"))

        assert url.query["Token"] == "pat-value"
        assert url.username is None
        assert url.password is None

    def test_project_is_sent_to_choose_it_over_the_default_one_of_the_token(self):
        assert get_connection_url(cloud_config("EU")).query["project_id"] == "project"


def test_unsupported_authentication_is_rejected():
    connection = MagicMock()
    connection.authType = object()

    with pytest.raises(ValueError, match="Unsupported Dremio authentication"):
        get_connection_url(connection)


class TestJobsTable:
    @staticmethod
    def engine_failing_on(*unreadable_tables: str) -> MagicMock:
        engine = MagicMock()
        connection = engine.connect.return_value.__enter__.return_value

        def execute(statement):
            if any(table in str(statement) for table in unreadable_tables):
                # The driver lets the raw pyarrow error through, not a SQLAlchemy one
                raise ArrowInvalid("Object 'project' not found within 'sys'")
            return MagicMock()

        connection.execute.side_effect = execute
        return engine

    def test_dremio_cloud_table(self):
        assert get_jobs_table(self.engine_failing_on("sys.jobs_recent")) == "sys.project.jobs_recent"

    def test_dremio_software_table(self):
        assert get_jobs_table(self.engine_failing_on("sys.project.jobs_recent")) == "sys.jobs_recent"

    def test_raises_when_no_table_is_readable(self):
        with pytest.raises(RuntimeError, match="None of the Dremio job history tables"):
            get_jobs_table(self.engine_failing_on(*DREMIO_JOBS_TABLES))


class TestTestConnection:
    def test_every_step_of_the_definition_has_a_function(self):
        definition = json.loads(TEST_CONNECTION_DEFINITION.read_text())
        expected_steps = {step["name"] for step in definition["steps"]}

        connection = DremioConnection(software_config())
        connection._client = MagicMock()

        with (
            patch("metadata.ingestion.source.database.dremio.connection.test_connection_steps") as run_steps,
            patch("metadata.ingestion.source.database.dremio.connection.kill_active_connections"),
        ):
            connection.test_connection(metadata=MagicMock())

        assert set(run_steps.call_args.kwargs["test_fn"]) == expected_steps
        assert run_steps.call_args.kwargs["service_type"] == "Dremio"

    def test_job_history_is_not_a_mandatory_step(self):
        definition = json.loads(TEST_CONNECTION_DEFINITION.read_text())
        steps = {step["name"]: step for step in definition["steps"]}

        assert steps["GetQueries"]["mandatory"] is False
        assert all(steps[name]["mandatory"] for name in ("CheckAccess", "GetDatabases", "GetSchemas", "GetTables"))


class TestServiceSpec:
    def test_spec_registers_the_connection_class(self):
        assert ServiceSpec.connection_class.endswith("dremio.connection.DremioConnection")

    def test_source_reuses_the_base_test_connection(self):
        assert DremioSource.test_connection is DatabaseServiceSource.test_connection
        assert "test_connection" not in DremioSource.__dict__


class TestEngine:
    def test_the_engine_is_built_from_the_connection_without_connecting(self):
        connection = DremioConnection(software_config("http://dremio.internal:9047"))

        engine = connection.client

        assert engine.url.host == "dremio.internal"
        assert engine.url.port == 32010
        connection.close()

    def test_the_engine_is_released_when_the_connection_is_closed(self):
        with patch.object(Engine, "dispose") as dispose:
            connection = DremioConnection(software_config())
            connection.client  # noqa: B018 - builds the engine
            connection.close()

        dispose.assert_called_once()
