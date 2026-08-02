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
Shared authentication diagnoses for the boto3/botocore connectors.

Fold in with ``ErrorPack.including(AWS_ERRORS)``; the connector keeps its own
authorization rule, whose fix must name that service's IAM actions.
``NETWORK_ERRORS`` is already folded in here.
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
    chain_text,
    exception_chain,
    when,
)
from metadata.core.connections.test_connection.network import NETWORK_ERRORS

if TYPE_CHECKING:
    from metadata.core.connections.test_connection.classifier import Matcher


def aws_error_code(error: BaseException) -> str | None:
    """The botocore ``ClientError`` code anywhere in the cause chain, if any."""
    code = None
    for current in exception_chain(error):
        if isinstance(current, ClientError):
            code = current.response.get("Error", {}).get("Code")
            break
    return code


def aws_code(*codes: str) -> Matcher:
    """Match a botocore ``ClientError`` by its structured AWS error code."""
    wanted = frozenset(codes)
    return lambda error: aws_error_code(error) in wanted


# Each cause below has one code per wire protocol: rest-xml (S3), json (Glue,
# Athena), query (STS). An assume-role config hits the STS leg first, so every
# code stays reachable from every connector.
# InvalidClientTokenId reads "security token" but means the key ID is unknown.
_UNKNOWN_KEY = ("InvalidAccessKeyId", "UnrecognizedClientException", "InvalidClientTokenId")
_BAD_SIGNATURE = ("SignatureDoesNotMatch", "InvalidSignatureException")
_EXPIRED_TOKEN = ("ExpiredToken", "ExpiredTokenException")

_SKEW_MESSAGES = ("signature expired", "signature not yet current")

# For connectors that also match authorization failures by message text.
AWS_AUTHENTICATION_CODES = frozenset(_UNKNOWN_KEY + _BAD_SIGNATURE + _EXPIRED_TOKEN)


def _clock_skew(error: BaseException) -> bool:
    """Skew fails signature verification, so it shares the wrong-secret codes and
    is told apart only by message."""
    if aws_error_code(error) not in _BAD_SIGNATURE:
        return False
    text = chain_text(error)
    return any(message in text for message in _SKEW_MESSAGES)


# Split by cause: each one sends the user somewhere different. Skew first - it
# shares the codes of the wrong-secret rule below.
AWS_ERRORS = ErrorPack(
    when(_clock_skew).diagnose(
        "Request signature expired",
        fix="The clock on the machine ingestion runs on is more than about five minutes away from "
        "AWS's, so AWS rejected the request as too old. Sync that machine's clock, usually with NTP.",
    ),
    when(aws_code(*_UNKNOWN_KEY)).diagnose(
        "AWS access key not recognized",
        fix="AWS does not recognise the AWS Access Key ID. It may have been deleted or made "
        "inactive, or it may belong to a different AWS account. If you are using temporary "
        "credentials, the AWS Session Token may be invalid too.",
    ),
    when(aws_code(*_BAD_SIGNATURE)).diagnose(
        "AWS secret key does not match",
        fix="The AWS Secret Access Key does not go with the AWS Access Key ID. They are issued as a "
        "pair - re-enter both together.",
    ),
    when(aws_code(*_EXPIRED_TOKEN)).diagnose(
        "AWS session token expired",
        fix="These are temporary credentials and they have expired. Generate a new AWS Session "
        "Token and update the connection.",
    ),
    when(Matchers.exception(NoCredentialsError)).diagnose(
        "No AWS credentials found",
        fix="No AWS credentials were found at all. Either fill in AWS Access Key ID and AWS Secret "
        "Access Key, or attach an IAM role to the machine ingestion runs on.",
    ),
    when(Matchers.exception(NoRegionError)).diagnose(
        "No AWS region configured",
        fix="AWS Region is empty, and it is required - without it there is no way to work out which "
        "regional AWS endpoint to call.",
    ),
    when(Matchers.exception(EndpointConnectionError)).diagnose(
        "Cannot reach the AWS endpoint",
        fix="Could not reach the AWS service endpoint. Check AWS Region (and Endpoint URL if you "
        "overrode it), and that the network lets the machine ingestion runs on reach AWS.",
    ),
).including(NETWORK_ERRORS)
