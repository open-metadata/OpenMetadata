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
Shared diagnoses for the AWS-backed connectors (boto3 / botocore).

Authentication codes come from SigV4 and STS, not from Glue, S3 or Athena, so
they are service-agnostic and live here. A connector still owns its authorization
diagnosis - an ``AccessDenied`` fix must name that service's IAM actions - plus
its own not-found and configuration errors.

Fold this in with ``ErrorPack.including(AWS_ERRORS)``; the connector's own rules
still match first. ``NETWORK_ERRORS`` is already folded in here.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from botocore.exceptions import (
    ClientError,
    EndpointConnectionError,
    NoCredentialsError,
    NoRegionError,
)

from metadata.core.connections.test_connection.classifier import (
    ErrorPack,
    Matchers,
    exception_chain,
    when,
)
from metadata.core.connections.test_connection.network import NETWORK_ERRORS

if TYPE_CHECKING:
    from metadata.core.connections.test_connection.classifier import Matcher


def aws_error_code(error: BaseException) -> str | None:
    """The botocore ``ClientError`` code anywhere in the cause chain, if any.

    A driver may wrap the ``ClientError`` (pyathena wraps it, SQLAlchemy wraps that
    again), so the code only survives by walking the chain."""
    code = None
    for current in exception_chain(error):
        if isinstance(current, ClientError):
            code = current.response.get("Error", {}).get("Code")
            break
    return code


def aws_code(*codes: str) -> Matcher:
    """Match a botocore ``ClientError`` by its structured AWS error code - the
    stable signal, where the rendered message text varies."""
    wanted = frozenset(codes)
    return lambda error: aws_error_code(error) in wanted


# One root cause, three codes: the wire protocol decides which one comes back.
# InvalidAccessKeyId is rest-xml (S3), UnrecognizedClientException is json (Glue,
# Athena), InvalidClientTokenId is query (STS) - and a connector that assumes a
# role hits the STS leg before its own service, so all three stay reachable.
# InvalidClientTokenId's message says "security token", but it means the access
# key ID is unknown; an actually-expired token is ExpiredToken(Exception).
_UNKNOWN_KEY = ("InvalidAccessKeyId", "UnrecognizedClientException", "InvalidClientTokenId")
# rest-xml/query say SignatureDoesNotMatch, json says InvalidSignatureException.
_BAD_SIGNATURE = ("SignatureDoesNotMatch", "InvalidSignatureException")
_EXPIRED_TOKEN = ("ExpiredToken", "ExpiredTokenException")

# Clock skew fails signature verification, so it arrives under the same codes as a
# wrong secret and is told apart only by message. Ordered first for that reason.
_SKEW_MESSAGES = ("signature expired", "signature not yet current")

# Every code meaning "AWS rejected this identity", for connectors that also match
# authorization failures by message text and must not confuse the two.
AWS_AUTHENTICATION_CODES = frozenset(_UNKNOWN_KEY + _BAD_SIGNATURE + _EXPIRED_TOKEN)


def _clock_skew(error: BaseException) -> bool:
    if aws_error_code(error) not in _BAD_SIGNATURE:
        return False
    text = " ".join(str(current) for current in exception_chain(error)).lower()
    return any(message in text for message in _SKEW_MESSAGES)


# Split by cause rather than one "Authentication failed": an unknown key, a wrong
# secret, a skewed clock and an expired token each send the user somewhere different.
AWS_ERRORS = ErrorPack(
    when(_clock_skew).diagnose(
        "Request signature expired",
        fix="The clock where ingestion runs is too far from AWS's (tolerance is about 5 minutes); sync it with NTP.",
    ),
    when(aws_code(*_UNKNOWN_KEY)).diagnose(
        "AWS access key not recognized",
        fix="AWS does not know this awsAccessKeyId - it may be deleted, inactive, or from another "
        "account or partition. With temporary credentials, the awsSessionToken may also be invalid.",
    ),
    when(aws_code(*_BAD_SIGNATURE)).diagnose(
        "AWS secret key does not match",
        fix="The awsSecretAccessKey is wrong for this awsAccessKeyId; re-enter the credential pair.",
    ),
    when(aws_code(*_EXPIRED_TOKEN)).diagnose(
        "AWS session token expired",
        fix="Temporary credentials have expired; refresh the awsSessionToken.",
    ),
    when(Matchers.exception(NoCredentialsError)).diagnose(
        "No AWS credentials found",
        fix="No credentials were configured or resolvable; set awsAccessKeyId/awsSecretAccessKey "
        "or make an IAM role available where ingestion runs.",
    ),
    when(Matchers.exception(NoRegionError)).diagnose(
        "No AWS region configured",
        fix="Set awsRegion; the client cannot resolve a service endpoint without it.",
    ),
    when(Matchers.exception(EndpointConnectionError)).diagnose(
        "Cannot reach the AWS endpoint",
        fix="Check awsRegion (and endPointURL when overridden), and that the network allows "
        "access to the service endpoint from where ingestion runs.",
    ),
).including(NETWORK_ERRORS)
