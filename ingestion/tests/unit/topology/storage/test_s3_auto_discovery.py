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
Tests for S3 storage connector auto-discovery via manifest_entries.
"""
from unittest.mock import Mock

from metadata.generated.schema.entity.data.table import DataType
from metadata.generated.schema.metadataIngestion.storage.manifestEntry import (
    ManifestEntry,
)
from metadata.ingestion.source.storage.storage_service import StorageServiceSource


def _make_source_with_list_keys(keys):
    """Create a mock StorageServiceSource with list_keys returning given keys."""
    source = Mock(spec=StorageServiceSource)
    source.list_keys = Mock(return_value=iter(keys))
    source.source_config = Mock()
    source.discover_containers_from_manifest_entries = (
        StorageServiceSource.discover_containers_from_manifest_entries.__get__(source)
    )
    return source


class TestAutoDiscoveryBasic:
    """Basic auto-discovery from manifest_entries."""

    def test_discovers_containers_from_pattern(self):
        keys = [
            ("data/events/file1.parquet", 1000),
            ("data/events/file2.parquet", 2000),
            ("data/users/file1.parquet", 500),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(pathPattern="data/*/*.parquet", structureFormat="parquet")
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        names = {r["name"] for r in results}
        assert "data/events" in names
        assert "data/users" in names
        assert len(results) == 2

    def test_no_match_yields_nothing(self):
        keys = [
            ("data/events/file.csv", 100),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(pathPattern="data/*/*.parquet", structureFormat="parquet")
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )
        assert results == []

    def test_empty_bucket_yields_nothing(self):
        source = _make_source_with_list_keys([])

        manifest_entries = [
            ManifestEntry(pathPattern="**/*.parquet", structureFormat="parquet")
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )
        assert results == []


class TestAutoDiscoveryManifestPriority:
    """Manifest entries should take priority over auto-discovery."""

    def test_already_discovered_paths_skipped(self):
        keys = [
            ("data/events/file.parquet", 1000),
            ("data/users/file.parquet", 500),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(pathPattern="data/*/*.parquet", structureFormat="parquet")
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered={"data/events"},
                config_source=Mock(),
                client=Mock(),
            )
        )

        assert len(results) == 1
        assert results[0]["name"] == "data/users"


class TestAutoDiscoveryPartitions:
    """Hive-style partition auto-detection."""

    def test_detects_hive_partitions(self):
        keys = [
            ("data/events/year=2024/month=01/part.parquet", 1000),
            ("data/events/year=2024/month=02/part.parquet", 1000),
            ("data/events/year=2023/month=12/part.parquet", 1000),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(
                pathPattern="data/**/*.parquet",
                structureFormat="parquet",
                autoPartitionDetection=True,
            )
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        assert len(results) == 1
        entry = results[0]["metadata_entry"]
        assert entry.isPartitioned is True
        assert entry.partitionColumns is not None
        assert len(entry.partitionColumns) == 2
        assert entry.partitionColumns[0].name.root == "year"
        assert entry.partitionColumns[0].dataType == DataType.INT
        assert entry.partitionColumns[1].name.root == "month"
        assert entry.partitionColumns[1].dataType == DataType.INT

    def test_partition_detection_disabled(self):
        keys = [
            ("data/events/year=2024/part.parquet", 1000),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(
                pathPattern="data/**/*.parquet",
                structureFormat="parquet",
                autoPartitionDetection=False,
            )
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        assert len(results) == 1
        assert results[0]["metadata_entry"].isPartitioned is False
        assert results[0]["metadata_entry"].partitionColumns is None

    def test_no_partitions_detected_for_flat_structure(self):
        keys = [
            ("data/events/file1.parquet", 1000),
            ("data/events/file2.parquet", 2000),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(pathPattern="data/*/*.parquet", structureFormat="parquet")
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        assert len(results) == 1
        assert results[0]["metadata_entry"].isPartitioned is False


class TestAutoDiscoveryTableGrouping:
    """File grouping into logical tables."""

    def test_groups_partitioned_files_into_one_table(self):
        keys = [
            ("lake/orders/year=2024/month=01/p1.parquet", 100),
            ("lake/orders/year=2024/month=02/p1.parquet", 200),
            ("lake/orders/year=2023/month=12/p1.parquet", 300),
            ("lake/users/profile.parquet", 400),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(pathPattern="lake/**/*.parquet", structureFormat="parquet")
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        names = {r["name"] for r in results}
        assert "lake/orders" in names
        assert "lake/users" in names
        assert len(results) == 2

        orders = next(r for r in results if r["name"] == "lake/orders")
        assert len(orders["files"]) == 3

    def test_container_name_matches_manifest_datapath(self):
        """Auto-discovered container names must match manifest dataPath
        format for FQN compatibility during migration."""
        keys = [
            ("data/events/year=2024/month=01/f.parquet", 1000),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(pathPattern="data/**/*.parquet", structureFormat="parquet")
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        # This must match what a user would put in manifest: dataPath="data/events"
        assert results[0]["name"] == "data/events"


class TestAutoDiscoveryMultipleManifestEntries:
    """Multiple manifest_entries in the same config."""

    def test_multiple_patterns_different_formats(self):
        all_keys = [
            ("data/events/f.parquet", 1000),
            ("data/logs/f.csv", 500),
        ]
        source = _make_source_with_list_keys([])
        # list_keys is called once per manifestEntry; return all keys each time
        source.list_keys = Mock(side_effect=lambda *a, **kw: iter(all_keys))

        manifest_entries = [
            ManifestEntry(pathPattern="data/*/*.parquet", structureFormat="parquet"),
            ManifestEntry(pathPattern="data/*/*.csv", structureFormat="csv"),
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        names = {r["name"] for r in results}
        assert "data/events" in names
        assert "data/logs" in names

        events = next(r for r in results if r["name"] == "data/events")
        assert events["metadata_entry"].structureFormat == "parquet"

        logs = next(r for r in results if r["name"] == "data/logs")
        assert logs["metadata_entry"].structureFormat == "csv"


class TestAutoDiscoveryFormatDetection:
    """Structure format auto-detected from file extension."""

    def test_format_inferred_from_extension(self):
        """When structureFormat is omitted, detect from file extension."""
        keys = [
            ("data/events/file.parquet", 1000),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(pathPattern="data/*/*.parquet")
        ]  # No structureFormat
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        assert len(results) == 1
        assert results[0]["metadata_entry"].structureFormat == "parquet"

    def test_format_override_takes_priority(self):
        """Explicit structureFormat overrides auto-detection."""
        keys = [
            ("data/events/file.pq", 1000),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(pathPattern="data/*/*.pq", structureFormat="parquet")
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        assert len(results) == 1
        assert results[0]["metadata_entry"].structureFormat == "parquet"

    def test_unknown_format_skipped(self):
        """Files with unknown extensions are skipped with a warning."""
        keys = [
            ("data/events/file.xyz", 1000),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(pathPattern="data/*/*.xyz")  # No structureFormat, unknown ext
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        assert results == []


class TestExcludePaths:
    """Configurable path exclusions via ManifestEntry.excludePaths."""

    def test_default_excludes_delta_log(self):
        """Default excludePaths skips _delta_log and _temporary files."""
        keys = [
            ("data/events/file.parquet", 1000),
            ("data/events/_delta_log/00001.json", 500),
            ("data/events/_temporary/staging.parquet", 300),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [ManifestEntry(pathPattern="data/**/*.*")]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        names = {r["name"] for r in results}
        assert "data/events" in names
        assert not any("_delta_log" in n for n in names)
        assert not any("_temporary" in n for n in names)

    def test_custom_exclude_paths(self):
        """User-configured excludePaths replaces defaults."""
        keys = [
            ("data/events/file.parquet", 1000),
            ("data/staging/file.parquet", 500),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(
                pathPattern="data/*/*.parquet",
                excludePaths=["staging"],
            )
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        names = {r["name"] for r in results}
        assert "data/events" in names
        assert "data/staging" not in names

    def test_empty_exclude_paths_disables_filtering(self):
        """Empty excludePaths list disables all exclusions."""
        keys = [
            ("data/events/file.parquet", 1000),
            ("data/events/_temporary/file.parquet", 500),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(
                pathPattern="data/**/*.parquet",
                excludePaths=[],
            )
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        names = {r["name"] for r in results}
        assert "data/events" in names
        assert "data/events/_temporary" in names


class TestExcludePatterns:
    """Glob-based exclude patterns to skip entire path trees."""

    def test_exclude_entire_directory_tree(self):
        """excludePatterns can skip an entire directory."""
        keys = [
            ("data/events/file.parquet", 1000),
            ("data/archive/old.parquet", 500),
            ("data/archive/older.parquet", 300),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(
                pathPattern="data/**/*.parquet",
                excludePatterns=["data/archive/**"],
            )
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        names = {r["name"] for r in results}
        assert "data/events" in names
        assert "data/archive" not in names

    def test_exclude_pattern_with_wildcard_prefix(self):
        """Exclude any directory starting with tmp_."""
        keys = [
            ("data/sales/file.parquet", 1000),
            ("data/tmp_staging/file.parquet", 500),
            ("data/tmp_test/file.parquet", 300),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(
                pathPattern="data/*/*.parquet",
                excludePatterns=["data/tmp_*/*.parquet"],
            )
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        names = {r["name"] for r in results}
        assert "data/sales" in names
        assert "data/tmp_staging" not in names
        assert "data/tmp_test" not in names

    def test_multiple_exclude_patterns(self):
        """Multiple exclude patterns all applied."""
        keys = [
            ("data/prod/file.parquet", 1000),
            ("data/staging/file.parquet", 500),
            ("data/test/file.parquet", 300),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(
                pathPattern="data/*/*.parquet",
                excludePatterns=["data/staging/*", "data/test/*"],
            )
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        names = {r["name"] for r in results}
        assert names == {"data/prod"}

    def test_exclude_patterns_with_exclude_paths_combined(self):
        """Both excludePatterns and excludePaths applied together."""
        keys = [
            ("data/events/file.parquet", 1000),
            ("data/events/_delta_log/log.json", 200),
            ("data/archive/old.parquet", 500),
        ]
        source = _make_source_with_list_keys(keys)

        manifest_entries = [
            ManifestEntry(
                pathPattern="data/**/*.*",
                excludePaths=["_delta_log"],
                excludePatterns=["data/archive/**"],
            )
        ]
        results = list(
            source.discover_containers_from_manifest_entries(
                bucket_name="bucket",
                manifest_entries=manifest_entries,
                already_discovered=set(),
                config_source=Mock(),
                client=Mock(),
            )
        )

        names = {r["name"] for r in results}
        assert "data/events" in names
        assert "data/archive" not in names
        assert not any("_delta_log" in n for n in names)
