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
"""S3 test-connection: its checks match its shipped definition."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError, EndpointConnectionError, NoCredentialsError

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.storage import list_buckets
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.storage.s3.connection import (
    S3_ERRORS,
    S3Checks,
    S3Connection,
)

CONNECTION_MODULE = "metadata.ingestion.source.storage.s3.connection"

_SEED = (
    Path(__file__).parents[6] / "openmetadata-service/src/main/resources/json/data" / "testConnections/storage/s3.json"
)


def _checks(client=None, bucket_names=None):
    return S3Checks(store=Borrowed.of(client), bucket_names=bucket_names)


def _check_names():
    return {step.value for step in collect_checks(_checks())}


def test_s3_connection_is_base_connection():
    assert issubclass(S3Connection, BaseConnection)


def test_get_client_delegates_to_get_connection():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        conn = S3Connection(MagicMock())
        client = conn.client

    assert client is mock_get.return_value
    mock_get.assert_called_once_with(conn.service_connection)


def test_s3_checks_cover_expected_steps():
    assert _check_names() == {"ListBuckets", "GetMetrics"}


def test_s3_checks_match_definition_seed():
    definition_steps = {step["name"] for step in json.loads(_SEED.read_text())["steps"]}
    assert _check_names() == definition_steps


def test_building_checks_does_not_build_the_client():
    with patch.object(S3Connection, "_get_client") as mock_build:
        S3Connection(MagicMock()).checks()

    mock_build.assert_not_called()


def test_check_buckets_lists_all_buckets_when_none_configured():
    client = MagicMock()
    client.s3_client.list_buckets.return_value = {"Buckets": [{"Name": "a"}, {"Name": "b"}]}

    evidence = _checks(client).check_buckets()

    assert evidence.summary == "2 buckets enumerated"
    assert evidence.command == "s3:ListBuckets"
    assert evidence.caveat is None
    client.s3_client.list_buckets.assert_called_once_with()
    client.s3_client.list_objects.assert_not_called()


def test_list_buckets_caps_reported_count_and_flags_more():
    client = MagicMock()
    client.list_buckets.return_value = {"Buckets": [{"Name": "a"}, {"Name": "b"}, {"Name": "c"}]}

    evidence = list_buckets(client, limit=2)

    assert evidence.summary == "2 buckets enumerated (showing first 2; more exist)"
    client.list_buckets.assert_called_once_with()


def test_check_buckets_warns_when_no_buckets_visible():
    client = MagicMock()
    client.s3_client.list_buckets.return_value = {"Buckets": []}

    evidence = _checks(client).check_buckets()

    assert evidence.caveat is not None
    assert "No buckets visible" in evidence.caveat.title


def test_check_buckets_probes_each_configured_bucket():
    client = MagicMock()

    evidence = _checks(client, bucket_names=["one", "two"]).check_buckets()

    assert evidence.summary == "2 configured buckets accessible"
    client.s3_client.list_objects.assert_any_call(Bucket="one", MaxKeys=1)
    client.s3_client.list_objects.assert_any_call(Bucket="two", MaxKeys=1)
    client.s3_client.list_buckets.assert_not_called()


def test_check_buckets_failure_reports_the_bucket_it_probed():
    client = MagicMock()
    cause = _client_error("NoSuchBucket", "ListObjects")
    client.s3_client.list_objects.side_effect = cause

    with pytest.raises(CheckError) as failure:
        _checks(client, bucket_names=["missing"]).check_buckets()

    assert failure.value.cause is cause
    assert failure.value.evidence.command == "s3:ListBucket (missing)"


def test_get_metrics_lists_the_s3_namespace():
    client = MagicMock()
    client.cloudwatch_client.list_metrics.return_value = {"Metrics": [{}]}

    evidence = _checks(client).get_metrics()

    assert evidence.summary == "1 metric visible in namespace 'AWS/S3'"
    client.cloudwatch_client.list_metrics.assert_called_once_with(Namespace="AWS/S3")


def test_get_metrics_flags_truncated_results():
    client = MagicMock()
    client.cloudwatch_client.list_metrics.return_value = {"Metrics": [{}], "NextToken": "more"}

    evidence = _checks(client).get_metrics()

    assert "more exist" in evidence.summary


def _client_error(code: str, operation: str) -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": "denied"}}, operation)


def test_error_pack_invalid_access_key():
    diagnosis = S3_ERRORS.classify(_client_error("InvalidAccessKeyId", "ListBuckets"))
    assert diagnosis is not None
    assert "access key" in diagnosis.title.lower()


def test_error_pack_signature_mismatch():
    diagnosis = S3_ERRORS.classify(_client_error("SignatureDoesNotMatch", "ListBuckets"))
    assert diagnosis is not None
    assert "secret key" in diagnosis.title.lower()


def test_error_pack_unrecognized_client():
    diagnosis = S3_ERRORS.classify(_client_error("UnrecognizedClientException", "ListMetrics"))
    assert diagnosis is not None
    assert diagnosis.title == "AWS access key not recognized"


def test_error_pack_invalid_client_token():
    # STS's code for an unknown access key ID.
    diagnosis = S3_ERRORS.classify(_client_error("InvalidClientTokenId", "ListBuckets"))
    assert diagnosis is not None
    assert diagnosis.title == "AWS access key not recognized"


def test_error_pack_expired_token():
    diagnosis = S3_ERRORS.classify(_client_error("ExpiredToken", "ListBuckets"))
    assert diagnosis is not None
    assert "expired" in diagnosis.title.lower()


def test_error_pack_bucket_not_found():
    diagnosis = S3_ERRORS.classify(_client_error("NoSuchBucket", "ListObjects"))
    assert diagnosis is not None
    assert "not found" in diagnosis.title.lower()


def test_error_pack_access_denied():
    diagnosis = S3_ERRORS.classify(
        ClientError(
            {
                "Error": {
                    "Code": "AccessDenied",
                    "Message": "User is not authorized to perform: s3:ListAllMyBuckets",
                }
            },
            "ListBuckets",
        )
    )
    assert diagnosis is not None
    assert "authorized" in diagnosis.title.lower()


def test_error_pack_access_denied_exception_variant():
    diagnosis = S3_ERRORS.classify(_client_error("AccessDeniedException", "ListMetrics"))
    assert diagnosis is not None
    assert "authorized" in diagnosis.title.lower()


def test_error_pack_no_credentials():
    diagnosis = S3_ERRORS.classify(NoCredentialsError())
    assert diagnosis is not None
    assert "credentials" in diagnosis.title.lower()


def test_error_pack_endpoint_unreachable():
    diagnosis = S3_ERRORS.classify(EndpointConnectionError(endpoint_url="https://s3.bad-region.amazonaws.com"))
    assert diagnosis is not None
    assert "endpoint" in diagnosis.title.lower()


def test_error_pack_matches_structured_code_not_message_text():
    # The structured code is NoSuchBucket; the message echoes "AccessDenied".
    # Matching the code (not the text) must classify it as the bucket error.
    error = ClientError(
        {"Error": {"Code": "NoSuchBucket", "Message": "bucket 'AccessDenied-logs' does not exist"}},
        "ListObjects",
    )
    diagnosis = S3_ERRORS.classify(error)
    assert diagnosis is not None
    assert "not found" in diagnosis.title.lower()


def test_error_pack_unmatched_returns_none():
    assert S3_ERRORS.classify(Exception("novel error")) is None
