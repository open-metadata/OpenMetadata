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
Test the object store stats used by the Datalake profiler
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from pydantic import BaseModel

from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.utils.datalake.object_stats import ObjectStats, get_object_stats

BUCKET = "my-bucket"
KEY = "profiler_test_.csv"

LAST_MODIFIED = datetime(2026, 8, 20, 10, 30, tzinfo=timezone.utc)


class TestObjectStatsModel:
    """UTC normalization is a property of the model, so no provider branch can forget it"""

    def test_aware_timestamp_is_converted_on_construction(self):
        aware = datetime(2026, 8, 20, 12, 30, tzinfo=timezone(timedelta(hours=2)))

        assert ObjectStats(create_date_time=aware).create_date_time == LAST_MODIFIED

    def test_naive_timestamp_is_labelled_utc_on_construction(self):
        assert ObjectStats(create_date_time=datetime(2026, 8, 20, 10, 30)).create_date_time == LAST_MODIFIED


class TestS3ObjectStats:
    """S3 (and S3-compatible stores) go through head_object"""

    def test_stats_from_head_object(self):
        client = MagicMock()
        client.head_object.return_value = {
            "ContentLength": 1024,
            "LastModified": LAST_MODIFIED,
        }

        stats = get_object_stats(S3Config(), client, BUCKET, KEY)

        client.head_object.assert_called_once_with(Bucket=BUCKET, Key=KEY)
        assert stats.size_in_bytes == 1024
        assert stats.create_date_time == LAST_MODIFIED

    def test_non_utc_timestamp_is_converted_not_relabelled(self):
        """A +02:00 timestamp must come back as the same instant in UTC, not the same clock time."""
        client = MagicMock()
        client.head_object.return_value = {
            "ContentLength": 1,
            "LastModified": datetime(2026, 8, 20, 12, 30, tzinfo=timezone(timedelta(hours=2))),
        }

        stats = get_object_stats(S3Config(), client, BUCKET, KEY)

        assert stats.create_date_time == LAST_MODIFIED
        assert stats.create_date_time.utcoffset() == timedelta(0)

    def test_naive_timestamp_is_labelled_utc(self):
        client = MagicMock()
        client.head_object.return_value = {
            "ContentLength": 1,
            "LastModified": datetime(2026, 8, 20, 10, 30),
        }

        stats = get_object_stats(S3Config(), client, BUCKET, KEY)

        assert stats.create_date_time == LAST_MODIFIED

    def test_empty_file_keeps_its_zero_size(self):
        client = MagicMock()
        client.head_object.return_value = {"ContentLength": 0, "LastModified": LAST_MODIFIED}

        assert get_object_stats(S3Config(), client, BUCKET, KEY).size_in_bytes == 0


class TestGCSObjectStats:
    """GCS exposes a real creation time on the blob"""

    def test_stats_from_blob(self):
        blob = MagicMock(size=2048, time_created=LAST_MODIFIED)
        client = MagicMock()
        client.bucket.return_value.get_blob.return_value = blob

        stats = get_object_stats(GCSConfig(), client, BUCKET, KEY)

        # `bucket()`, not `get_bucket()`: the latter would need `storage.buckets.get`
        client.get_bucket.assert_not_called()
        client.bucket.assert_called_once_with(BUCKET)
        client.bucket.return_value.get_blob.assert_called_once_with(KEY)
        assert stats.size_in_bytes == 2048
        assert stats.create_date_time == LAST_MODIFIED

    def test_missing_blob_returns_empty_stats(self):
        client = MagicMock()
        client.bucket.return_value.get_blob.return_value = None

        assert get_object_stats(GCSConfig(), client, BUCKET, KEY) == ObjectStats()


class TestAzureObjectStats:
    """Azure Blob exposes a creation time, with last_modified as the fallback"""

    def test_stats_from_blob_properties(self):
        client = MagicMock()
        props = MagicMock(size=512, creation_time=LAST_MODIFIED, last_modified=None)
        client.get_blob_client.return_value.get_blob_properties.return_value = props

        stats = get_object_stats(AzureConfig(), client, BUCKET, KEY)

        client.get_blob_client.assert_called_once_with(container=BUCKET, blob=KEY)
        assert stats.size_in_bytes == 512
        assert stats.create_date_time == LAST_MODIFIED

    def test_falls_back_to_last_modified(self):
        client = MagicMock()
        props = MagicMock(size=512, creation_time=None, last_modified=LAST_MODIFIED)
        client.get_blob_client.return_value.get_blob_properties.return_value = props

        assert get_object_stats(AzureConfig(), client, BUCKET, KEY).create_date_time == LAST_MODIFIED


class TestUnknownConfigSource:
    def test_unknown_source_returns_empty_stats(self):
        """Non object store sources (e.g. BurstIQ) get empty stats instead of an error."""

        class NotAnObjectStore(BaseModel):
            pass

        assert get_object_stats(NotAnObjectStore(), MagicMock(), BUCKET, KEY) == ObjectStats()
