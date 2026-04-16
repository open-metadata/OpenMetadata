#  Copyright 2026 Collate
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
Unit tests for wildcard expansion in storage manifest entries.

Covers the ``expand_entry`` / ``expand_entries`` helpers on
``StorageServiceSource`` which turn a manifest entry with a glob
``dataPath`` into one or more concrete entries. Literal paths must
pass through unchanged for backwards compatibility.
"""
from typing import List, Tuple

import pytest

from metadata.generated.schema.entity.data.table import DataType
from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
    MetadataEntry,
    PartitionColumn,
)
from metadata.ingestion.source.storage.storage_service import (
    DEFAULT_EXCLUDE_PATHS,
    StorageServiceSource,
    has_glob,
)


class _Stub:
    """Minimal stub that exposes ``expand_entry`` from the base class
    without needing to instantiate the full Source, which requires a
    live workflow config and connection."""

    def __init__(self, keys: List[Tuple[str, int]]):
        self._keys = keys

    def list_keys(self, bucket, prefix):  # noqa: ARG002 — test stub
        for key, size in self._keys:
            if key.startswith(prefix):
                yield key, size

    expand_entry = StorageServiceSource.expand_entry
    expand_entries = StorageServiceSource.expand_entries


def _names(entries: List[MetadataEntry]) -> List[str]:
    return [e.dataPath for e in entries]


class TestHasGlob:
    def test_literal_paths(self):
        assert has_glob("data/events") is False
        assert has_glob("") is False
        assert has_glob("foo/bar/baz.parquet") is False

    def test_wildcards(self):
        assert has_glob("data/*") is True
        assert has_glob("data/**/*.json") is True
        assert has_glob("foo/?ar") is True
        assert has_glob("foo/[abc]bar") is True


class TestLiteralPassthrough:
    def test_literal_entry_passes_through(self):
        stub = _Stub([])
        entry = MetadataEntry(dataPath="data/events", structureFormat="parquet")
        expanded = list(stub.expand_entry("bucket", entry))
        assert len(expanded) == 1
        assert expanded[0] is entry

    def test_mixed_literal_and_glob(self):
        stub = _Stub(
            [
                ("data/a/f1.parquet", 10),
                ("data/b/f1.parquet", 20),
            ]
        )
        entries = [
            MetadataEntry(dataPath="legacy", structureFormat="csv"),
            MetadataEntry(dataPath="data/*/f1.parquet", structureFormat="parquet"),
        ]
        expanded = stub.expand_entries("bucket", entries)
        # literal + 2 glob matches
        paths = _names(expanded)
        assert "legacy" in paths
        assert any(p.startswith("data/a") for p in paths)
        assert any(p.startswith("data/b") for p in paths)


class TestGlobExpansion:
    def test_glob_produces_one_entry_per_table(self):
        stub = _Stub(
            [
                ("data/us/events/f1.parquet", 100),
                ("data/us/events/f2.parquet", 200),
                ("data/eu/events/f1.parquet", 150),
            ]
        )
        entry = MetadataEntry(
            dataPath="data/*/events/*.parquet", structureFormat="parquet"
        )
        expanded = list(stub.expand_entry("bucket", entry))
        paths = _names(expanded)
        assert len(paths) == 2
        assert "data/us/events" in paths
        assert "data/eu/events" in paths

    def test_glob_no_matches_yields_nothing(self):
        stub = _Stub([("other/file.parquet", 1)])
        entry = MetadataEntry(dataPath="data/*/*.parquet", structureFormat="parquet")
        assert list(stub.expand_entry("bucket", entry)) == []

    def test_structure_format_auto_detected_from_extension(self):
        stub = _Stub([("data/us/file.csv", 10)])
        entry = MetadataEntry(dataPath="data/*/*.csv")
        expanded = list(stub.expand_entry("bucket", entry))
        assert len(expanded) == 1
        assert expanded[0].structureFormat == "csv"


class TestAutoPartitionDetection:
    def test_hive_partitions_detected(self):
        stub = _Stub(
            [
                ("data/events/year=2024/month=01/f.parquet", 10),
                ("data/events/year=2024/month=02/f.parquet", 20),
                ("data/events/year=2025/month=01/f.parquet", 30),
            ]
        )
        entry = MetadataEntry(
            dataPath="data/events/**/*.parquet",
            structureFormat="parquet",
            autoPartitionDetection=True,
        )
        expanded = list(stub.expand_entry("bucket", entry))
        assert len(expanded) == 1
        cols = expanded[0].partitionColumns or []
        names = [c.name for c in cols]
        assert "year" in names
        assert "month" in names

    def test_autopartition_off_leaves_no_partitions(self):
        stub = _Stub(
            [
                ("data/events/year=2024/month=01/f.parquet", 10),
            ]
        )
        entry = MetadataEntry(
            dataPath="data/events/**/*.parquet",
            structureFormat="parquet",
            autoPartitionDetection=False,
        )
        expanded = list(stub.expand_entry("bucket", entry))
        assert all(not e.partitionColumns for e in expanded)

    def test_explicit_partition_columns_override_detection(self):
        stub = _Stub(
            [
                ("data/events/year=2024/month=01/f.parquet", 10),
                ("data/events/year=2024/month=02/f.parquet", 20),
            ]
        )
        entry = MetadataEntry(
            dataPath="data/events/**/*.parquet",
            structureFormat="parquet",
            autoPartitionDetection=True,
            partitionColumns=[
                PartitionColumn(name="explicit_year", dataType=DataType.INT)
            ],
        )
        expanded = list(stub.expand_entry("bucket", entry))
        assert len(expanded) == 1
        cols = expanded[0].partitionColumns or []
        assert len(cols) == 1
        assert cols[0].name == "explicit_year"
        assert expanded[0].isPartitioned is True


class TestExcludes:
    def test_exclude_paths_default_skips_delta_log(self):
        stub = _Stub(
            [
                ("data/events/_delta_log/00000.json", 1),
                ("data/events/real.parquet", 10),
            ]
        )
        entry = MetadataEntry(dataPath="data/**/*", structureFormat="parquet")
        expanded = list(stub.expand_entry("bucket", entry))
        # Default excludes should drop the _delta_log file
        paths = _names(expanded)
        assert all("_delta_log" not in p for p in paths)

    def test_exclude_paths_custom(self):
        stub = _Stub(
            [
                ("data/events/archive/old.parquet", 10),
                ("data/events/current.parquet", 20),
            ]
        )
        entry = MetadataEntry(
            dataPath="data/**/*.parquet",
            structureFormat="parquet",
            excludePaths=["archive"],
        )
        expanded = list(stub.expand_entry("bucket", entry))
        paths = _names(expanded)
        assert not any("archive" in p for p in paths)

    def test_exclude_patterns(self):
        stub = _Stub(
            [
                ("data/tmp_01/f.parquet", 1),
                ("data/real/f.parquet", 2),
            ]
        )
        entry = MetadataEntry(
            dataPath="data/**/*.parquet",
            structureFormat="parquet",
            excludePatterns=["data/tmp_*/**"],
        )
        expanded = list(stub.expand_entry("bucket", entry))
        paths = _names(expanded)
        assert not any("tmp_" in p for p in paths)


class TestUnstructuredData:
    def test_each_file_yields_own_entry(self):
        stub = _Stub(
            [
                ("images/a.png", 10),
                ("images/nested/b.png", 20),
                ("docs/note.pdf", 30),  # does not match
            ]
        )
        entry = MetadataEntry(
            dataPath="images/**/*.png",
            unstructuredData=True,
        )
        expanded = list(stub.expand_entry("bucket", entry))
        paths = _names(expanded)
        assert sorted(paths) == ["images/a.png", "images/nested/b.png"]
        # Unstructured entries should have no structureFormat so downstream
        # routing goes through the unstructured path.
        assert all(e.structureFormat is None for e in expanded)
        assert all(e.unstructuredData is True for e in expanded)


class TestDefaultExcludeConstants:
    def test_defaults_are_reasonable(self):
        assert "_delta_log" in DEFAULT_EXCLUDE_PATHS
        assert "_SUCCESS" in DEFAULT_EXCLUDE_PATHS
        assert "_temporary" in DEFAULT_EXCLUDE_PATHS


class TestResolveManifestEntriesPrecedence:
    """_resolve_manifest_entries must honor:
    global_manifest > bucket manifest file > defaultManifest."""

    def _resolver(
        self,
        *,
        global_manifest=None,
        bucket_config=None,
        default_manifest=None,
    ):
        """Build a minimal stub that exposes _resolve_manifest_entries
        without instantiating the full Source. ``default_manifest`` is a
        JSON string matching the ManifestMetadataConfig schema (or None)."""
        from types import SimpleNamespace

        resolver = SimpleNamespace()
        resolver.global_manifest = global_manifest
        resolver.source_config = SimpleNamespace(defaultManifest=default_manifest)
        resolver._load_metadata_file = lambda bucket_name: bucket_config
        resolver._manifest_entries_to_metadata_entries_by_container = (
            StorageServiceSource._manifest_entries_to_metadata_entries_by_container
        )
        resolver._parsed_default_manifest = (
            StorageServiceSource._parsed_default_manifest.__get__(resolver)
        )
        resolver._resolve_manifest_entries = (
            StorageServiceSource._resolve_manifest_entries.__get__(resolver)
        )
        return resolver

    def test_bucket_manifest_wins_over_default(self):
        import json as _json

        from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
            StorageContainerConfig,
        )

        bucket_cfg = StorageContainerConfig(
            entries=[MetadataEntry(dataPath="from/bucket", structureFormat="parquet")]
        )
        default_json = _json.dumps(
            {
                "entries": [
                    {
                        "containerName": "b",
                        "dataPath": "from/default",
                        "structureFormat": "csv",
                    }
                ]
            }
        )
        r = self._resolver(bucket_config=bucket_cfg, default_manifest=default_json)
        entries = r._resolve_manifest_entries("b")
        assert [e.dataPath for e in entries] == ["from/bucket"]

    def test_default_used_when_no_bucket_file(self):
        import json as _json

        default_json = _json.dumps(
            {
                "entries": [
                    {
                        "containerName": "b",
                        "dataPath": "from/default",
                        "structureFormat": "csv",
                    },
                    {
                        "containerName": "other",
                        "dataPath": "not/this",
                        "structureFormat": "csv",
                    },
                ]
            }
        )
        r = self._resolver(default_manifest=default_json)
        entries = r._resolve_manifest_entries("b")
        # Only entries whose containerName matches our bucket are returned.
        assert [e.dataPath for e in entries] == ["from/default"]

    def test_returns_empty_when_no_source(self):
        r = self._resolver()
        assert r._resolve_manifest_entries("b") == []

    def test_invalid_default_manifest_json_is_ignored(self):
        r = self._resolver(default_manifest="not valid json {")
        # Must not raise; just returns empty.
        assert r._resolve_manifest_entries("b") == []


class TestParsedDefaultManifest:
    """Direct unit coverage for StorageServiceSource._parsed_default_manifest.
    The caching and error-differentiation logic is easier to verify here
    than through a full workflow run."""

    def _resolver(self, raw_manifest, with_status=True):
        from types import SimpleNamespace

        resolver = SimpleNamespace()
        resolver.source_config = SimpleNamespace(defaultManifest=raw_manifest)
        if with_status:
            resolver.status = SimpleNamespace(
                warning=lambda *a, **kw: resolver._warnings.append((a, kw))
            )
            resolver._warnings = []
        resolver._parsed_default_manifest = (
            StorageServiceSource._parsed_default_manifest.__get__(resolver)
        )
        return resolver

    def test_returns_none_when_unset(self):
        r = self._resolver(None)
        assert r._parsed_default_manifest() is None
        assert r._warnings == []

    def test_returns_none_for_empty_string(self):
        r = self._resolver("   ")
        assert r._parsed_default_manifest() is None
        assert r._warnings == []

    def test_parses_valid_json(self):
        import json as _json

        raw = _json.dumps(
            {
                "entries": [
                    {
                        "containerName": "b",
                        "dataPath": "data/events",
                        "structureFormat": "parquet",
                    }
                ]
            }
        )
        r = self._resolver(raw)
        result = r._parsed_default_manifest()
        assert result is not None
        assert len(result.entries) == 1
        assert result.entries[0].dataPath == "data/events"
        assert r._warnings == []

    def test_invalid_json_logs_warning_and_returns_none(self):
        r = self._resolver("{ not valid json")
        assert r._parsed_default_manifest() is None
        # Warning fired, keyed by "defaultManifest".
        assert len(r._warnings) == 1
        args, _ = r._warnings[0]
        assert args[0] == "defaultManifest"
        assert "not valid JSON" in args[1]

    def test_schema_violation_logs_warning_and_returns_none(self):
        import json as _json

        # Valid JSON but entry missing required containerName + dataPath.
        raw = _json.dumps({"entries": [{"structureFormat": "parquet"}]})
        r = self._resolver(raw)
        assert r._parsed_default_manifest() is None
        assert len(r._warnings) == 1
        args, _ = r._warnings[0]
        assert args[0] == "defaultManifest"
        assert "schema" in args[1].lower()

    def test_result_is_cached(self):
        import json as _json

        raw = _json.dumps(
            {
                "entries": [
                    {
                        "containerName": "b",
                        "dataPath": "data",
                        "structureFormat": "parquet",
                    }
                ]
            }
        )
        r = self._resolver(raw)
        first = r._parsed_default_manifest()
        second = r._parsed_default_manifest()
        # Same object — indicates the cached value was returned.
        assert first is second


class TestPartitionColumnsToTableColumns:
    """Conversion from lightweight PartitionColumn → full table Column."""

    def test_empty_returns_empty_list(self):
        result = StorageServiceSource._partition_columns_to_table_columns(None)
        assert result == []

        result = StorageServiceSource._partition_columns_to_table_columns([])
        assert result == []

    def test_converts_fields(self):
        from metadata.generated.schema.entity.data.table import DataType
        from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
            PartitionColumn,
        )

        columns = [
            PartitionColumn(
                name="year",
                dataType=DataType.INT,
                dataTypeDisplay="Year",
                description="Year of the event",
            ),
            PartitionColumn(name="state", dataType=DataType.VARCHAR),
        ]
        result = StorageServiceSource._partition_columns_to_table_columns(columns)

        assert len(result) == 2
        assert result[0].name.root == "year"
        assert result[0].dataType == DataType.INT
        assert result[0].dataTypeDisplay == "Year"
        assert result[1].name.root == "state"
        assert result[1].dataType == DataType.VARCHAR
        # Optional fields default to None when not provided.
        assert result[1].dataTypeDisplay is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
