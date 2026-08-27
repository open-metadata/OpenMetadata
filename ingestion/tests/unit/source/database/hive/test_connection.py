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
"""Unit tests for Hive connection handling."""

import ssl

from metadata.ingestion.source.database.hive.custom_hive_connection import (
    _get_http_ssl_context,
    _get_ssl_socket_kwargs,
)


def test_hive_ssl_requires_certificate_verification_by_default():
    assert _get_ssl_socket_kwargs()["cert_reqs"] == ssl.CERT_REQUIRED


def test_hive_http_ssl_requires_certificate_verification_by_default():
    assert _get_http_ssl_context().verify_mode == ssl.CERT_REQUIRED


def test_hive_http_ssl_preserves_explicit_verification_mode():
    assert _get_http_ssl_context(ssl_cert="none").verify_mode == ssl.CERT_NONE


def test_hive_ssl_preserves_explicit_certificate_requirement():
    socket_kwargs = _get_ssl_socket_kwargs(
        ssl_certfile="client.pem",
        ssl_keyfile="client.key",
        ssl_ca_certs="ca.pem",
        ssl_cert_reqs=ssl.CERT_OPTIONAL,
    )

    assert socket_kwargs == {
        "certfile": "client.pem",
        "keyfile": "client.key",
        "ca_certs": "ca.pem",
        "cert_reqs": ssl.CERT_OPTIONAL,
    }
