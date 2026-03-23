#  Copyright 2024 Collate
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
Unit tests for GCS test connection - Tester.list_buckets() bucket filtering
"""
from collections import namedtuple
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.services.connections.storage.gcsConnection import (
    GcsConnection,
)
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.storage.gcs.connection import (
    GcsObjectStoreClient,
    MultiProjectClient,
    Tester,
)

MockBucket = namedtuple("MockBucket", ["name"])

MOCK_BUCKETS = [
    MockBucket("allowed-bucket"),
    MockBucket("restricted-bucket"),
    MockBucket("another-allowed-bucket"),
]


def _make_tester(container_filter_pattern=None, bucket_names=None):
    connection = MagicMock(spec=GcsConnection)
    connection.containerFilterPattern = container_filter_pattern
    connection.bucketNames = bucket_names

    mock_client = MagicMock()
    mock_client.list_buckets.return_value = iter(MOCK_BUCKETS)

    storage_client = MagicMock(spec=MultiProjectClient)
    storage_client.clients = {"project-1": mock_client}

    client = MagicMock(spec=GcsObjectStoreClient)
    client.storage_client = storage_client

    return Tester(client, connection)


class TestTesterListBuckets:
    def test_no_filter_picks_first_bucket(self):
        tester = _make_tester(container_filter_pattern=None)
        tester.list_buckets()

        assert len(tester.bucket_tests) == 1
        assert tester.bucket_tests[0].bucket_name == "allowed-bucket"
        assert tester.bucket_tests[0].project_id == "project-1"

    def test_include_filter_picks_matching_bucket(self):
        tester = _make_tester(
            container_filter_pattern=FilterPattern(includes=["another-.*"])
        )
        tester.list_buckets()

        assert len(tester.bucket_tests) == 1
        assert tester.bucket_tests[0].bucket_name == "another-allowed-bucket"

    def test_exclude_filter_skips_excluded_bucket(self):
        tester = _make_tester(
            container_filter_pattern=FilterPattern(excludes=["allowed-bucket"])
        )
        tester.list_buckets()

        assert len(tester.bucket_tests) == 1
        assert tester.bucket_tests[0].bucket_name == "restricted-bucket"

    def test_all_filtered_out_raises_with_filter_message(self):
        tester = _make_tester(
            container_filter_pattern=FilterPattern(includes=["nonexistent-.*"])
        )

        with pytest.raises(SourceConnectionException, match="containerFilterPattern"):
            tester.list_buckets()

    def test_no_buckets_no_filter_raises_generic_message(self):
        tester = _make_tester(container_filter_pattern=None)
        mock_client = tester.client.storage_client.clients["project-1"]
        mock_client.list_buckets.return_value = iter([])

        with pytest.raises(SourceConnectionException, match="No buckets found"):
            tester.list_buckets()
