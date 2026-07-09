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
"""The shared AWS error pack and its structured-code matcher."""

import pytest
from botocore.exceptions import (
    ClientError,
    EndpointConnectionError,
    NoCredentialsError,
    NoRegionError,
)

from metadata.core.connections.test_connection.aws import (
    AWS_ERRORS,
    aws_code,
    aws_error_code,
)


def _client_error(code: str, message: str = "denied", operation: str = "GetDatabases") -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": message}}, operation)


def test_aws_error_code_reads_the_structured_code():
    assert aws_error_code(_client_error("AccessDeniedException")) == "AccessDeniedException"


def test_aws_error_code_walks_the_cause_chain():
    cause = _client_error("ExpiredToken")
    wrapper = RuntimeError("driver wrapped it")
    wrapper.__cause__ = cause

    assert aws_error_code(wrapper) == "ExpiredToken"


def test_aws_error_code_is_none_for_a_non_client_error():
    assert aws_error_code(RuntimeError("boom")) is None


def test_aws_code_matches_only_the_listed_codes():
    matcher = aws_code("ExpiredToken", "ExpiredTokenException")

    assert matcher(_client_error("ExpiredTokenException")) is True
    assert matcher(_client_error("AccessDenied")) is False


def test_aws_code_ignores_the_message_text():
    # The structured code is EntityNotFoundException; the message echoes "AccessDenied".
    error = _client_error("EntityNotFoundException", message="database 'AccessDenied-logs' not found")

    assert aws_code("AccessDenied")(error) is False


@pytest.mark.parametrize(
    ("code", "expected"),
    [
        ("InvalidAccessKeyId", "access key"),
        ("SignatureDoesNotMatch", "secret key"),
        ("InvalidSignatureException", "secret key"),
        ("UnrecognizedClientException", "not recognized"),
        ("AuthFailure", "not recognized"),
        ("InvalidClientTokenId", "security token"),
        ("ExpiredToken", "expired"),
        ("ExpiredTokenException", "expired"),
    ],
)
def test_aws_errors_classifies_every_authentication_code(code, expected):
    diagnosis = AWS_ERRORS.classify(_client_error(code))

    assert diagnosis is not None
    assert expected in diagnosis.title.lower()


def test_aws_errors_classifies_missing_credentials():
    diagnosis = AWS_ERRORS.classify(NoCredentialsError())

    assert diagnosis is not None
    assert "credentials" in diagnosis.title.lower()


def test_aws_errors_classifies_missing_region():
    diagnosis = AWS_ERRORS.classify(NoRegionError())

    assert diagnosis is not None
    assert "region" in diagnosis.title.lower()


def test_aws_errors_classifies_an_unreachable_endpoint():
    diagnosis = AWS_ERRORS.classify(EndpointConnectionError(endpoint_url="https://glue.bad-region.amazonaws.com"))

    assert diagnosis is not None
    assert "endpoint" in diagnosis.title.lower()


def test_aws_errors_folds_in_the_network_pack():
    diagnosis = AWS_ERRORS.classify(ConnectionRefusedError("refused"))

    assert diagnosis is not None
    assert "refused" in diagnosis.title.lower()


def test_aws_errors_leaves_authorization_to_the_connector():
    """AccessDenied's remedy names service-specific IAM actions, so the shared
    pack must not claim it - a connector's own rule has to win."""
    assert AWS_ERRORS.classify(_client_error("AccessDeniedException")) is None


def test_aws_errors_unmatched_returns_none():
    assert AWS_ERRORS.classify(Exception("novel error")) is None
