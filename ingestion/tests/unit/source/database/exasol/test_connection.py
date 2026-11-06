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
"""Unit tests for Exasol connection handling."""

from metadata.generated.schema.entity.services.connections.database.exasolConnection import (
    ExasolConnection as ExasolConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.exasolConnection import (
    ExasolScheme,
    Tls,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.exasol.connection import ExasolConnection


def _config(tls: Tls) -> ExasolConnectionConfig:
    return ExasolConnectionConfig(
        scheme=ExasolScheme.exa_websocket,
        username="admin",
        password="password",
        hostPort="localhost:8563",
        tls=tls,
    )


def test_exasol_connection_is_base_connection():
    assert issubclass(ExasolConnection, BaseConnection)


def test_url_validate_certificate_has_no_tls_params():
    assert (
        ExasolConnection.get_connection_url(_config(Tls.validate_certificate))
        == "exa+websocket://admin:password@localhost:8563"
    )


def test_url_ignore_certificate():
    assert (
        ExasolConnection.get_connection_url(_config(Tls.ignore_certificate))
        == "exa+websocket://admin:password@localhost:8563?SSLCertificate=SSL_VERIFY_NONE"
    )


def test_url_disable_tls():
    assert (
        ExasolConnection.get_connection_url(_config(Tls.disable_tls)) == "exa+websocket://admin:password@localhost:8563"
        "?SSLCertificate=SSL_VERIFY_NONE&ENCRYPTION=no"
    )
