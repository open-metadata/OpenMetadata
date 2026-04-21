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
Unit tests for S3Source individual methods — list_keys, _fetch_metric,
_get_full_path, _get_sample_file_path, get_aws_bucket_region, etc.

These tests mock the S3Source instance to test methods in isolation
without needing a running OpenMetadata server.
"""
import datetime
from unittest.mock import Mock, patch

from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
    MetadataEntry,
)
from metadata.ingestion.source.storage.s3.metadata import (
    S3BucketResponse,
    S3ContainerDetails,
    S3Metric,
    S3Source,
)


def _make_s3_source():
    """Create a minimal mock S3Source with key methods bound."""
    source = Mock(spec=S3Source)
    source.s3_client = Mock()
    source.cloudwatch_client = Mock()
    source.service_connection = Mock()
    source.service_connection.awsConfig.awsRegion = "us-east-1"
    source.service_connection.awsConfig.endPointURL = None
    source.source_config = Mock()
    source.source_config.containerFilterPattern = None

    # Bind real methods to the mock
    source.list_keys = S3Source.list_keys.__get__(source)
    source._fetch_metric = S3Source._fetch_metric.__get__(source)
    source._get_full_path = S3Source._get_full_path.__get__(source)
    source._clean_path = S3Source._clean_path.__get__(source)
    source._get_sample_file_path = S3Source._get_sample_file_path.__get__(source)
    source._get_sample_file_prefix = S3Source._get_sample_file_prefix
    # is_excluded_artifact is now a module-level function in
    # metadata.utils.storage_utils, called directly (not via self).
    # No instance binding needed.
    source.get_aws_bucket_region = S3Source.get_aws_bucket_region.__get__(source)
    source.fetch_buckets = S3Source.fetch_buckets.__get__(source)
    source._generate_unstructured_container = (
        S3Source._generate_unstructured_container.__get__(source)
    )
    source.is_valid_unstructured_file = S3Source.is_valid_unstructured_file.__get__(
        source
    )
    return source


class TestListKeys:
    """S3Source.list_keys — listing with cold storage filtering."""

    @patch("metadata.ingestion.source.storage.s3.metadata.list_s3_objects")
    def test_returns_key_and_size(self, mock_list):
        source = _make_s3_source()
        mock_list.return_value = [
            {"Key": "data/file.parquet", "Size": 1000, "StorageClass": "STANDARD"},
        ]

        results = list(source.list_keys("bucket", "data/"))

        assert results == [("data/file.parquet", 1000)]

    @patch("metadata.ingestion.source.storage.s3.metadata.list_s3_objects")
    def test_filters_directories(self, mock_list):
        source = _make_s3_source()
        mock_list.return_value = [
            {"Key": "data/", "Size": 0, "StorageClass": "STANDARD"},
            {"Key": "data/file.parquet", "Size": 500, "StorageClass": "STANDARD"},
        ]

        results = list(source.list_keys("bucket", "data/"))

        assert len(results) == 1
        assert results[0][0] == "data/file.parquet"

    @patch("metadata.ingestion.source.storage.s3.metadata.list_s3_objects")
    def test_filters_glacier_objects(self, mock_list):
        source = _make_s3_source()
        mock_list.return_value = [
            {"Key": "data/hot.parquet", "Size": 100, "StorageClass": "STANDARD"},
            {"Key": "data/cold.parquet", "Size": 200, "StorageClass": "GLACIER"},
            {"Key": "data/deep.parquet", "Size": 300, "StorageClass": "DEEP_ARCHIVE"},
            {"Key": "data/ir.parquet", "Size": 400, "StorageClass": "GLACIER_IR"},
            {"Key": "data/ia.parquet", "Size": 500, "StorageClass": "STANDARD_IA"},
        ]

        results = list(source.list_keys("bucket", "data/"))

        keys = [k for k, _ in results]
        assert "data/hot.parquet" in keys
        assert "data/ia.parquet" in keys
        assert "data/cold.parquet" not in keys
        assert "data/deep.parquet" not in keys
        assert "data/ir.parquet" not in keys

    @patch("metadata.ingestion.source.storage.s3.metadata.list_s3_objects")
    def test_empty_key_skipped(self, mock_list):
        source = _make_s3_source()
        mock_list.return_value = [
            {"Key": "", "Size": 0},
            {"Key": "data/file.csv", "Size": 100},
        ]

        results = list(source.list_keys("bucket", ""))

        assert len(results) == 1

    @patch("metadata.ingestion.source.storage.s3.metadata.list_s3_objects")
    def test_missing_size_defaults_to_zero(self, mock_list):
        source = _make_s3_source()
        mock_list.return_value = [
            {"Key": "data/file.parquet"},
        ]

        results = list(source.list_keys("bucket", "data/"))

        assert results == [("data/file.parquet", 0)]


class TestFetchMetric:
    """S3Source._fetch_metric — CloudWatch metric retrieval."""

    def test_returns_metric_value(self):
        source = _make_s3_source()
        source.cloudwatch_client.get_metric_data.return_value = {
            "MetricDataResults": [{"StatusCode": "Complete", "Values": [42000.0]}]
        }

        result = source._fetch_metric("test-bucket", S3Metric.NUMBER_OF_OBJECTS)

        assert result == 42000

    def test_returns_zero_on_empty_values(self):
        source = _make_s3_source()
        source.cloudwatch_client.get_metric_data.return_value = {
            "MetricDataResults": [{"StatusCode": "Complete", "Values": []}]
        }

        result = source._fetch_metric("test-bucket", S3Metric.BUCKET_SIZE_BYTES)

        assert result == 0

    def test_returns_zero_on_error(self):
        source = _make_s3_source()
        source.cloudwatch_client.get_metric_data.side_effect = Exception("Denied")

        result = source._fetch_metric("test-bucket", S3Metric.NUMBER_OF_OBJECTS)

        assert result == 0

    def test_returns_zero_on_incomplete_status(self):
        source = _make_s3_source()
        source.cloudwatch_client.get_metric_data.return_value = {
            "MetricDataResults": [{"StatusCode": "InternalError", "Values": [100.0]}]
        }

        result = source._fetch_metric("test-bucket", S3Metric.NUMBER_OF_OBJECTS)

        assert result == 0


class TestGetFullPath:
    """S3Source._get_full_path — S3 URI construction."""

    def test_bucket_only(self):
        source = _make_s3_source()
        assert source._get_full_path("my-bucket") == "s3://my-bucket"

    def test_bucket_with_prefix(self):
        source = _make_s3_source()
        assert (
            source._get_full_path("my-bucket", "data/events")
            == "s3://my-bucket/data/events"
        )

    def test_strips_slashes(self):
        source = _make_s3_source()
        assert source._get_full_path("/bucket/", "/prefix/") == "s3://bucket/prefix"

    def test_none_bucket_returns_none(self):
        source = _make_s3_source()
        assert source._get_full_path(None) is None


class TestGetSampleFilePath:
    """S3Source._get_sample_file_path — random sample file selection."""

    def test_picks_from_candidates(self):
        source = _make_s3_source()
        source.s3_client.list_objects_v2.return_value = {
            "Contents": [
                {"Key": "data/file1.parquet"},
                {"Key": "data/file2.parquet"},
            ]
        }
        entry = MetadataEntry(dataPath="data", structureFormat="parquet")

        result = source._get_sample_file_path("bucket", entry)

        assert result in ("data/file1.parquet", "data/file2.parquet")

    def test_filters_directories(self):
        source = _make_s3_source()
        source.s3_client.list_objects_v2.return_value = {
            "Contents": [
                {"Key": "data/"},
                {"Key": "data/file.parquet"},
            ]
        }
        entry = MetadataEntry(dataPath="data", structureFormat="parquet")

        result = source._get_sample_file_path("bucket", entry)

        assert result == "data/file.parquet"

    def test_filters_delta_log(self):
        source = _make_s3_source()
        source.s3_client.list_objects_v2.return_value = {
            "Contents": [
                {"Key": "data/_delta_log/00001.json"},
                {"Key": "data/file.parquet"},
            ]
        }
        entry = MetadataEntry(dataPath="data", structureFormat="parquet")

        result = source._get_sample_file_path("bucket", entry)

        assert result == "data/file.parquet"

    def test_filters_success_files(self):
        source = _make_s3_source()
        source.s3_client.list_objects_v2.return_value = {
            "Contents": [
                {"Key": "data/_SUCCESS"},
                {"Key": "data/file.parquet"},
            ]
        }
        entry = MetadataEntry(dataPath="data", structureFormat="parquet")

        result = source._get_sample_file_path("bucket", entry)

        assert result == "data/file.parquet"

    def test_returns_none_when_no_candidates(self):
        source = _make_s3_source()
        source.s3_client.list_objects_v2.return_value = {"Contents": [{"Key": "data/"}]}
        entry = MetadataEntry(dataPath="data", structureFormat="parquet")

        assert source._get_sample_file_path("bucket", entry) is None

    def test_returns_none_for_unstructured_entry(self):
        source = _make_s3_source()
        entry = MetadataEntry(dataPath="images")

        assert source._get_sample_file_path("bucket", entry) is None

    def test_returns_none_on_s3_error(self):
        source = _make_s3_source()
        source.s3_client.list_objects_v2.side_effect = Exception("Access Denied")
        entry = MetadataEntry(dataPath="data", structureFormat="parquet")

        assert source._get_sample_file_path("bucket", entry) is None


class TestGetBucketRegion:
    """S3Source.get_aws_bucket_region — region lookup with fallback."""

    def test_returns_location_constraint(self):
        source = _make_s3_source()
        source.s3_client.get_bucket_location.return_value = {
            "LocationConstraint": "eu-west-1"
        }

        assert source.get_aws_bucket_region("bucket") == "eu-west-1"

    def test_falls_back_to_config_region(self):
        source = _make_s3_source()
        source.s3_client.get_bucket_location.return_value = {"LocationConstraint": None}

        assert source.get_aws_bucket_region("bucket") == "us-east-1"

    def test_falls_back_on_error(self):
        source = _make_s3_source()
        source.s3_client.get_bucket_location.side_effect = Exception("Denied")

        assert source.get_aws_bucket_region("bucket") == "us-east-1"


class TestFetchBuckets:
    """S3Source.fetch_buckets — bucket listing and filtering."""

    def test_returns_configured_bucket_names(self):
        source = _make_s3_source()
        source.service_connection.bucketNames = ["bucket-a", "bucket-b"]

        results = source.fetch_buckets()

        assert len(results) == 2
        assert results[0].name == "bucket-a"
        assert results[1].name == "bucket-b"

    def test_lists_all_buckets_when_none_configured(self):
        source = _make_s3_source()
        source.service_connection.bucketNames = None
        source.status = Mock()
        source.s3_client.list_buckets.return_value = {
            "Buckets": [
                {"Name": "test_bucket", "CreationDate": datetime.datetime(2024, 1, 1)},
                {"Name": "other_bucket", "CreationDate": datetime.datetime(2024, 2, 1)},
            ]
        }

        results = source.fetch_buckets()

        assert len(results) == 2

    def test_filters_buckets_by_pattern(self):
        source = _make_s3_source()
        source.service_connection.bucketNames = None
        source.status = Mock()
        source.source_config.containerFilterPattern = Mock()
        source.source_config.containerFilterPattern.includes = ["^test_.*"]
        source.source_config.containerFilterPattern.excludes = None

        source.s3_client.list_buckets.return_value = {
            "Buckets": [
                {"Name": "test_bucket", "CreationDate": datetime.datetime(2024, 1, 1)},
                {"Name": "prod_bucket", "CreationDate": datetime.datetime(2024, 2, 1)},
            ]
        }

        results = source.fetch_buckets()

        names = [r.name for r in results]
        assert "test_bucket" in names

    def test_returns_empty_on_error(self):
        source = _make_s3_source()
        source.service_connection.bucketNames = None
        source.s3_client.list_buckets.side_effect = Exception("Denied")

        results = source.fetch_buckets()

        assert results == []


class TestIsValidUnstructuredFile:
    """S3Source.is_valid_unstructured_file — extension matching."""

    def test_wildcard_matches_all(self):
        source = _make_s3_source()
        assert source.is_valid_unstructured_file(["*"], "file.anything")

    def test_extension_match(self):
        source = _make_s3_source()
        assert source.is_valid_unstructured_file(["png", "jpg"], "photo.png")

    def test_extension_no_match(self):
        source = _make_s3_source()
        assert not source.is_valid_unstructured_file(["png", "jpg"], "doc.pdf")

    def test_empty_extensions_no_match(self):
        source = _make_s3_source()
        assert not source.is_valid_unstructured_file([], "file.csv")


class TestGenerateUnstructuredContainer:
    """S3Source._generate_unstructured_container — bucket-level container."""

    def test_creates_bucket_container(self):
        source = _make_s3_source()
        source._fetch_metric = Mock(return_value=0)
        source._get_bucket_source_url = Mock(return_value=None)

        bucket = S3BucketResponse(
            Name="test-bucket",
            CreationDate=datetime.datetime(2024, 1, 15),
        )

        result = source._generate_unstructured_container(bucket)

        assert result.name == "test-bucket"
        assert result.prefix == "/"
        assert result.data_model is None
        assert result.file_formats == []
        assert result.fullPath == "s3://test-bucket"
        assert result.creation_date == "2024-01-15T00:00:00"

    def test_bucket_without_creation_date(self):
        source = _make_s3_source()
        source._fetch_metric = Mock(return_value=0)
        source._get_bucket_source_url = Mock(return_value=None)

        bucket = S3BucketResponse(Name="bucket")

        result = source._generate_unstructured_container(bucket)

        assert result.creation_date is None


class TestGetBucketNameAndKey:
    """S3Source._get_bucket_name_and_key — path parsing."""

    def _bind(self):
        source = _make_s3_source()
        source._get_bucket_name_and_key = S3Source._get_bucket_name_and_key.__get__(
            source
        )
        return source

    def test_full_path(self):
        source = self._bind()
        bucket, key = source._get_bucket_name_and_key("s3://my-bucket/path/to/file.csv")
        assert bucket == "my-bucket"
        assert key == "path/to/file.csv"

    def test_none_path(self):
        source = self._bind()
        bucket, key = source._get_bucket_name_and_key(None)
        assert bucket is None
        assert key is None

    def test_empty_path(self):
        source = self._bind()
        bucket, key = source._get_bucket_name_and_key("")
        assert bucket is None
        assert key is None

    def test_bucket_only(self):
        source = self._bind()
        bucket, key = source._get_bucket_name_and_key("s3://my-bucket")
        assert bucket is None
        assert key is None


class TestGetSize:
    """S3Source.get_size — file size via HEAD."""

    def test_returns_content_length(self):
        source = _make_s3_source()
        source.get_size = S3Source.get_size.__get__(source)
        source.s3_client.head_object.return_value = {"ContentLength": 12345}

        assert source.get_size("bucket", "key.parquet") == 12345

    def test_returns_none_on_error(self):
        source = _make_s3_source()
        source.get_size = S3Source.get_size.__get__(source)
        source.s3_client.head_object.side_effect = Exception("AccessDenied")

        assert source.get_size("bucket", "key.parquet") is None


class TestGenerateContainerDetails:
    """S3Source._generate_container_details — structured container from metadata entry."""

    def _bind(self):
        # Use a plain Mock (not spec=S3Source) so we can override methods freely
        source = Mock()
        source.service_connection = Mock()
        source.service_connection.awsConfig = Mock()
        source.s3_client = Mock()
        source.status = Mock()
        source._generate_container_details = (
            S3Source._generate_container_details.__get__(source)
        )
        source._get_sample_file_prefix = S3Source._get_sample_file_prefix
        source._get_sample_file_path = Mock()
        source._get_columns = Mock()
        source._get_object_source_url = Mock(return_value=None)
        source._get_full_path = S3Source._get_full_path.__get__(source)
        source._clean_path = S3Source._clean_path.__get__(source)
        return source

    def test_returns_none_for_unstructured_entry(self):
        source = self._bind()
        entry = MetadataEntry(dataPath="images")
        bucket = S3BucketResponse(Name="bucket")

        assert source._generate_container_details(bucket, entry) is None

    def test_returns_none_when_no_sample_file(self):
        source = self._bind()
        source._get_sample_file_path.return_value = None
        entry = MetadataEntry(dataPath="data", structureFormat="parquet")
        bucket = S3BucketResponse(Name="bucket")

        assert source._generate_container_details(bucket, entry) is None

    @patch("metadata.ingestion.source.storage.s3.metadata.S3Config")
    def test_creates_container_with_columns(self, mock_s3_config):
        from metadata.generated.schema.entity.data.table import Column, DataType

        source = self._bind()
        source._get_sample_file_path.return_value = "data/file.parquet"
        source._get_columns.return_value = [
            Column(name="id", dataType=DataType.INT),
            Column(name="value", dataType=DataType.STRING),
        ]
        entry = MetadataEntry(
            dataPath="data", structureFormat="parquet", isPartitioned=False
        )
        bucket = S3BucketResponse(
            Name="bucket", CreationDate=datetime.datetime(2024, 1, 1)
        )

        result = source._generate_container_details(bucket, entry)

        assert result is not None
        assert result.name == "data"
        assert result.prefix == "/data"
        assert result.data_model.isPartitioned is False
        assert len(result.data_model.columns) == 2

    @patch("metadata.ingestion.source.storage.s3.metadata.S3Config")
    def test_returns_none_when_columns_extraction_fails(self, _):
        source = self._bind()
        source._get_sample_file_path.return_value = "data/file.parquet"
        source._get_columns.side_effect = Exception("Parse error")
        entry = MetadataEntry(dataPath="data", structureFormat="parquet")
        bucket = S3BucketResponse(Name="bucket")

        result = source._generate_container_details(bucket, entry)

        assert result is None
        source.status.failed.assert_called_once()

    @patch("metadata.ingestion.source.storage.s3.metadata.S3Config")
    def test_returns_none_when_no_columns(self, _):
        source = self._bind()
        source._get_sample_file_path.return_value = "data/file.parquet"
        source._get_columns.return_value = []
        entry = MetadataEntry(dataPath="data", structureFormat="parquet")
        bucket = S3BucketResponse(Name="bucket")

        result = source._generate_container_details(bucket, entry)

        assert result is None


class TestGenerateStructuredContainers:
    """S3Source._generate_structured_containers — dispatches by depth."""

    def _bind(self):
        source = _make_s3_source()
        source._generate_structured_containers = (
            S3Source._generate_structured_containers.__get__(source)
        )
        source._generate_container_details = Mock()
        source._generate_structured_containers_by_depth = Mock(return_value=[])
        return source

    def test_depth_zero_calls_generate_details(self):
        source = self._bind()
        source._generate_container_details.return_value = Mock()
        entry = MetadataEntry(dataPath="data", structureFormat="parquet", depth=0)
        bucket = S3BucketResponse(Name="bucket")

        results = list(source._generate_structured_containers(bucket, [entry]))

        source._generate_container_details.assert_called_once()
        source._generate_structured_containers_by_depth.assert_not_called()
        assert len(results) == 1

    def test_depth_nonzero_calls_depth_method(self):
        source = self._bind()
        entry = MetadataEntry(dataPath="data", structureFormat="parquet", depth=2)
        bucket = S3BucketResponse(Name="bucket")

        list(source._generate_structured_containers(bucket, [entry]))

        source._generate_structured_containers_by_depth.assert_called_once()
        source._generate_container_details.assert_not_called()

    def test_skips_none_results(self):
        source = self._bind()
        source._generate_container_details.return_value = None
        entry = MetadataEntry(dataPath="data", structureFormat="parquet", depth=0)
        bucket = S3BucketResponse(Name="bucket")

        results = list(source._generate_structured_containers(bucket, [entry]))

        assert results == []


class TestGenerateStructuredContainersByDepth:
    """S3Source._generate_structured_containers_by_depth — directory nesting."""

    @patch("metadata.ingestion.source.storage.s3.metadata.list_s3_objects")
    def test_discovers_nested_directories(self, mock_list):
        source = _make_s3_source()
        source._generate_structured_containers_by_depth = (
            S3Source._generate_structured_containers_by_depth.__get__(source)
        )
        source._generate_container_details = Mock(
            return_value=Mock(spec=S3ContainerDetails)
        )

        mock_list.return_value = [
            {"Key": "data/raw/users/part-00000.parquet"},
            {"Key": "data/raw/orders/part-00000.parquet"},
        ]

        entry = MetadataEntry(dataPath="data/raw", structureFormat="parquet", depth=1)
        bucket = S3BucketResponse(Name="bucket")

        results = list(source._generate_structured_containers_by_depth(bucket, entry))

        assert source._generate_container_details.call_count == 2

    @patch("metadata.ingestion.source.storage.s3.metadata.list_s3_objects")
    def test_filters_delta_log_in_depth_scan(self, mock_list):
        source = _make_s3_source()
        source._generate_structured_containers_by_depth = (
            S3Source._generate_structured_containers_by_depth.__get__(source)
        )
        source._generate_container_details = Mock(
            return_value=Mock(spec=S3ContainerDetails)
        )

        mock_list.return_value = [
            {"Key": "data/raw/users/part.parquet"},
            {"Key": "data/raw/_delta_log/00001.json"},
        ]

        entry = MetadataEntry(dataPath="data/raw", structureFormat="parquet", depth=1)
        bucket = S3BucketResponse(Name="bucket")

        results = list(source._generate_structured_containers_by_depth(bucket, entry))

        # Only users should be discovered, _delta_log filtered
        assert source._generate_container_details.call_count == 1


class TestGenerateUnstructuredContainers:
    """S3Source._generate_unstructured_containers — dispatches by format."""

    def _bind(self):
        source = _make_s3_source()
        source._generate_unstructured_containers = (
            S3Source._generate_unstructured_containers.__get__(source)
        )
        source._yield_nested_unstructured_containers = Mock(return_value=[])
        return source

    def test_skips_structured_entries(self):
        source = self._bind()
        entry = MetadataEntry(dataPath="data", structureFormat="parquet")
        bucket = S3BucketResponse(Name="bucket")

        results = list(
            source._generate_unstructured_containers(bucket, [entry], parent=None)
        )

        source._yield_nested_unstructured_containers.assert_not_called()

    def test_dispatches_unstructured_formats(self):
        source = self._bind()
        entry = MetadataEntry(dataPath="images", unstructuredFormats=["png", "jpg"])
        bucket = S3BucketResponse(Name="bucket")

        list(source._generate_unstructured_containers(bucket, [entry], parent=None))

        source._yield_nested_unstructured_containers.assert_called_once()

    def test_yields_simple_container_for_no_format(self):
        source = self._bind()
        source._get_object_source_url = Mock(return_value=None)
        source._get_full_path = S3Source._get_full_path.__get__(source)
        source._clean_path = S3Source._clean_path.__get__(source)
        source.get_size = Mock(return_value=0)
        entry = MetadataEntry(dataPath="docs")
        bucket = S3BucketResponse(
            Name="bucket", CreationDate=datetime.datetime(2024, 1, 1)
        )

        results = list(
            source._generate_unstructured_containers(bucket, [entry], parent=None)
        )

        assert len(results) == 1
        assert results[0].name == "docs"
        assert results[0].data_model is None


class TestSourceUrls:
    """S3Source URL generation methods."""

    def _bind(self):
        source = _make_s3_source()
        source._get_bucket_source_url = S3Source._get_bucket_source_url.__get__(source)
        source._get_object_source_url = S3Source._get_object_source_url.__get__(source)
        source.get_aws_bucket_region = Mock(return_value="us-east-1")
        return source

    def test_bucket_url_aws(self):
        source = self._bind()
        source.service_connection.awsConfig.endPointURL = None
        source.service_connection.consoleEndpointURL = None

        url = source._get_bucket_source_url("my-bucket")

        assert url is not None
        url_str = url.root if hasattr(url, "root") else str(url)
        assert "my-bucket" in url_str
        assert "us-east-1" in url_str

    def test_bucket_url_custom_endpoint(self):
        source = self._bind()
        source.service_connection.awsConfig.endPointURL = "http://minio:9000"
        source.service_connection.consoleEndpointURL = "http://minio-console:9001"

        url = source._get_bucket_source_url("my-bucket")

        assert url is not None
        url_str = url.root if hasattr(url, "root") else str(url)
        assert "minio-console" in url_str

    def test_object_url_aws(self):
        source = self._bind()
        source.service_connection.awsConfig.endPointURL = None
        source.service_connection.consoleEndpointURL = None

        url = source._get_object_source_url("my-bucket", "data/events")

        assert url is not None
        url_str = url.root if hasattr(url, "root") else str(url)
        assert "my-bucket" in url_str


class TestLoadMetadataFile:
    """Error-branch coverage for S3Source._load_metadata_file. The happy
    path + ReadException branch is already covered by integration tests;
    here we focus on JSON/schema errors the integration tests exercise
    but without the workflow overhead."""

    def _bind(self):
        """Build a minimal S3Source with _load_metadata_file bound and
        a stub s3_reader + status recorder."""
        source = Mock(spec=S3Source)
        source.s3_reader = Mock()
        source.status = Mock()
        source.status.warning = Mock()
        source._load_metadata_file = S3Source._load_metadata_file.__get__(source)
        return source

    def test_returns_none_when_file_missing(self):
        from metadata.readers.file.base import ReadException

        source = self._bind()
        source.s3_reader.read.side_effect = ReadException("not found")

        assert source._load_metadata_file(bucket_name="b") is None
        # Missing file is expected — must not be surfaced as a warning.
        source.status.warning.assert_not_called()

    def test_logs_and_warns_on_invalid_json(self):
        source = self._bind()
        source.s3_reader.read.return_value = b"{ not valid"

        result = source._load_metadata_file(bucket_name="bucket-bad-json")

        assert result is None
        # Status warning should carry the bucket name and mention JSON.
        assert source.status.warning.called
        call_args = source.status.warning.call_args[0]
        assert call_args[0] == "bucket-bad-json"
        assert "not valid JSON" in call_args[1]

    def test_logs_and_warns_on_schema_violation(self):
        import json as _json

        source = self._bind()
        # Valid JSON, but entry is missing required dataPath.
        source.s3_reader.read.return_value = _json.dumps(
            {"entries": [{"structureFormat": "parquet"}]}
        ).encode()

        result = source._load_metadata_file(bucket_name="bucket-bad-schema")

        assert result is None
        assert source.status.warning.called
        call_args = source.status.warning.call_args[0]
        assert call_args[0] == "bucket-bad-schema"
        assert "schema" in call_args[1].lower()
        # Pydantic field paths surface in the message.
        assert "dataPath" in call_args[1]

    def test_returns_parsed_config_on_happy_path(self):
        import json as _json

        source = self._bind()
        source.s3_reader.read.return_value = _json.dumps(
            {"entries": [{"dataPath": "data/events", "structureFormat": "parquet"}]}
        ).encode()

        result = source._load_metadata_file(bucket_name="bucket-ok")

        assert result is not None
        assert len(result.entries) == 1
        assert result.entries[0].dataPath == "data/events"
        # Happy path — no warnings.
        source.status.warning.assert_not_called()
