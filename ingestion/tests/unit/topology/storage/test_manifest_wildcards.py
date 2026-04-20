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
        # Bracket character classes are not implemented by
        # pattern_to_regex; a path containing '[' is treated literally.
        assert has_glob("foo/[abc]bar") is False

    def test_wildcards(self):
        assert has_glob("data/*") is True
        assert has_glob("data/**/*.json") is True
        assert has_glob("foo/?ar") is True


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


class TestContainerFilterAppliesToManifestEntries:
    """Issue #24823: containerFilterPattern at the pipeline level is
    documented to filter containers. Today it only filters top-level
    buckets. It SHOULD also filter nested containers coming from a
    bucket manifest (``openmetadata.json``) or from ``defaultManifest``.

    These tests drive the filter through the manifest-entry resolution
    path so users can exclude paths like ``_SUCCESS`` / ``_temporary`` /
    Spark metadata directories without editing every manifest file."""

    def _stub(self, container_filter_pattern=None):
        """Build a resolver with the expand_entries / filter pipeline,
        configured with an optional container filter."""
        from types import SimpleNamespace

        resolver = SimpleNamespace()
        resolver.source_config = SimpleNamespace(
            defaultManifest=None,
            containerFilterPattern=container_filter_pattern,
        )
        resolver.list_keys = lambda *a, **kw: iter(())  # no globs here
        resolver.expand_entry = StorageServiceSource.expand_entry.__get__(resolver)
        resolver.expand_entries = StorageServiceSource.expand_entries.__get__(resolver)
        resolver.filter_manifest_entries = (
            StorageServiceSource.filter_manifest_entries.__get__(resolver)
        )
        resolver.status = SimpleNamespace(filter=lambda *a, **kw: None)
        return resolver

    def test_exclude_matches_dataPath(self):
        """Entries whose dataPath matches the exclude pattern must be
        dropped before any sample-file fetch happens. containerFilter
        patterns are left-anchored regex (``re.match``), so ``.*_SUCCESS``
        matches any path ending with _SUCCESS."""
        from metadata.generated.schema.type.filterPattern import FilterPattern

        resolver = self._stub(
            container_filter_pattern=FilterPattern(excludes=[".*_SUCCESS"])
        )
        entries = [
            MetadataEntry(dataPath="data/events", structureFormat="parquet"),
            # These would match the user-provided exclude but also hit
            # the default Spark-artifact skip list — either way, dropped.
            MetadataEntry(dataPath="data/_SUCCESS", structureFormat="parquet"),
            MetadataEntry(dataPath="data/dt=2024/_SUCCESS", structureFormat="parquet"),
        ]
        filtered = resolver.filter_manifest_entries("bucket", entries)
        paths = [e.dataPath for e in filtered]
        assert "data/events" in paths
        assert all("_SUCCESS" not in p for p in paths)

    def test_include_takes_precedence(self):
        from metadata.generated.schema.type.filterPattern import FilterPattern

        resolver = self._stub(
            container_filter_pattern=FilterPattern(includes=["data/events"])
        )
        entries = [
            MetadataEntry(dataPath="data/events", structureFormat="parquet"),
            MetadataEntry(dataPath="data/other", structureFormat="parquet"),
        ]
        filtered = resolver.filter_manifest_entries("bucket", entries)
        assert [e.dataPath for e in filtered] == ["data/events"]

    def test_no_filter_pattern_passes_through(self):
        resolver = self._stub(container_filter_pattern=None)
        entries = [
            MetadataEntry(dataPath="a", structureFormat="parquet"),
            MetadataEntry(dataPath="b", structureFormat="parquet"),
        ]
        assert resolver.filter_manifest_entries("bucket", entries) == entries

    def test_excludes_default_spark_artifacts(self):
        """Common Spark/Delta leftover segments must be dropped even
        without an explicit exclude pattern — they are never valid
        data containers."""
        resolver = self._stub(container_filter_pattern=None)
        entries = [
            MetadataEntry(dataPath="data/events", structureFormat="parquet"),
            MetadataEntry(dataPath="data/_SUCCESS", structureFormat="parquet"),
            MetadataEntry(dataPath="data/_temporary/x", structureFormat="parquet"),
            MetadataEntry(dataPath="data/_spark_metadata/x", structureFormat="parquet"),
            MetadataEntry(dataPath="data/_delta_log/00000", structureFormat="parquet"),
            MetadataEntry(dataPath="data/.tmp/x", structureFormat="parquet"),
        ]
        paths = [
            e.dataPath for e in resolver.filter_manifest_entries("bucket", entries)
        ]
        assert paths == ["data/events"]

    def test_multiple_exclude_patterns(self):
        """Each entry in ``excludes`` is evaluated independently."""
        from metadata.generated.schema.type.filterPattern import FilterPattern

        resolver = self._stub(
            container_filter_pattern=FilterPattern(excludes=[".*staging", ".*archive"])
        )
        entries = [
            MetadataEntry(dataPath="data/events", structureFormat="parquet"),
            MetadataEntry(dataPath="data/staging", structureFormat="parquet"),
            MetadataEntry(dataPath="data/archive", structureFormat="parquet"),
            MetadataEntry(dataPath="data/orders", structureFormat="parquet"),
        ]
        paths = [
            e.dataPath for e in resolver.filter_manifest_entries("bucket", entries)
        ]
        assert sorted(paths) == ["data/events", "data/orders"]

    def test_multiple_include_patterns(self):
        """Any include match keeps the entry."""
        from metadata.generated.schema.type.filterPattern import FilterPattern

        resolver = self._stub(
            container_filter_pattern=FilterPattern(
                includes=["data/events", "data/orders"]
            )
        )
        entries = [
            MetadataEntry(dataPath="data/events", structureFormat="parquet"),
            MetadataEntry(dataPath="data/orders", structureFormat="parquet"),
            MetadataEntry(dataPath="data/other", structureFormat="parquet"),
        ]
        paths = sorted(
            e.dataPath for e in resolver.filter_manifest_entries("bucket", entries)
        )
        assert paths == ["data/events", "data/orders"]

    def test_includes_and_excludes_together(self):
        """When both are set, include must match AND exclude must not.
        Exclude takes precedence when a path matches both."""
        from metadata.generated.schema.type.filterPattern import FilterPattern

        resolver = self._stub(
            container_filter_pattern=FilterPattern(
                includes=["data/.*"],  # include all under data/
                excludes=[".*staging"],  # but drop staging
            )
        )
        entries = [
            MetadataEntry(dataPath="data/events", structureFormat="parquet"),
            MetadataEntry(dataPath="data/staging", structureFormat="parquet"),
            MetadataEntry(dataPath="other/x", structureFormat="parquet"),
        ]
        paths = sorted(
            e.dataPath for e in resolver.filter_manifest_entries("bucket", entries)
        )
        assert paths == ["data/events"]

    def test_filter_is_case_insensitive(self):
        """``filter_by_container`` uses ``re.IGNORECASE``."""
        from metadata.generated.schema.type.filterPattern import FilterPattern

        resolver = self._stub(
            container_filter_pattern=FilterPattern(excludes=[".*STAGING"])
        )
        entries = [
            MetadataEntry(dataPath="data/staging", structureFormat="parquet"),
            MetadataEntry(dataPath="data/events", structureFormat="parquet"),
        ]
        paths = [
            e.dataPath for e in resolver.filter_manifest_entries("bucket", entries)
        ]
        assert paths == ["data/events"]

    def test_empty_includes_and_excludes_lists_are_noops(self):
        """Empty lists must NOT drop everything — they should be treated
        as 'no pattern'."""
        from metadata.generated.schema.type.filterPattern import FilterPattern

        resolver = self._stub(
            container_filter_pattern=FilterPattern(includes=[], excludes=[])
        )
        entries = [
            MetadataEntry(dataPath="data/events", structureFormat="parquet"),
            MetadataEntry(dataPath="data/orders", structureFormat="parquet"),
        ]
        assert len(resolver.filter_manifest_entries("bucket", entries)) == 2


class TestIsExcludedArtifact:
    """Per-artifact unit coverage for ``is_excluded_artifact`` in
    ``metadata.utils.storage_utils``. A sentinel file matched by this
    helper must never be picked for schema inference or used as a
    depth-scan candidate."""

    @staticmethod
    def _excluded(key):
        from metadata.utils.storage_utils import is_excluded_artifact

        return is_excluded_artifact(key)

    def test_regular_parquet_is_not_excluded(self):
        assert not self._excluded("data/events/part-00000.parquet")
        assert not self._excluded("data/events/State=AL/f.parquet")
        assert not self._excluded("logs/year=2024/file.json")

    def test_success_sentinel(self):
        assert self._excluded("data/_SUCCESS")
        assert self._excluded("data/events/dt=2024/_SUCCESS")

    def test_success_crc_sentinel(self):
        assert self._excluded("data/_SUCCESS.crc")
        assert self._excluded("data/events/_SUCCESS.gz")

    def test_crc_sidecar_files(self):
        assert self._excluded("data/events/part-00000.parquet.crc")
        assert self._excluded("data/events/.part-00000.parquet.crc")

    def test_delta_log_segment(self):
        assert self._excluded("data/events/_delta_log/00000000000000000000.json")
        assert self._excluded("data/_delta_log/commit.json")

    def test_temporary_segment(self):
        assert self._excluded("data/_temporary/0/task.parquet")

    def test_spark_metadata_segment(self):
        assert self._excluded("data/_spark_metadata/0")

    def test_tmp_segment(self):
        assert self._excluded("data/.tmp/scratch.parquet")

    def test_committed_and_started_markers(self):
        assert self._excluded("data/_committed_0")
        assert self._excluded("data/_started_1234")

    def test_does_not_false_positive_on_similar_names(self):
        """A directory or file that only *contains* '_SUCCESS' as a
        substring (e.g., a legit column named 'is_SUCCESS') must not be
        excluded — only exact sentinel names are matched."""
        assert not self._excluded("data/is_SUCCESS_table/part.parquet")
        assert not self._excluded("data/events/SUCCESS.parquet")
        # Note: `.crc` suffix excludes any file — this is intentional,
        # Hadoop .crc files are always sidecars and never the real data.


class TestFilterAppliesToExpandedGlobEntries:
    """Regression: the filter must run AFTER glob expansion, so paths
    derived from a wildcard ``dataPath`` are filtered just like literal
    paths. Otherwise a user writing ``dataPath: "**/*"`` could pull in
    _SUCCESS / excluded folders via the glob."""

    def _stub(self, keys, container_filter_pattern=None):
        from types import SimpleNamespace

        resolver = SimpleNamespace()
        resolver.source_config = SimpleNamespace(
            defaultManifest=None,
            containerFilterPattern=container_filter_pattern,
        )
        resolver.list_keys = lambda bucket, prefix: iter(
            (k, s) for k, s in keys if k.startswith(prefix or "")
        )
        resolver.expand_entry = StorageServiceSource.expand_entry.__get__(resolver)
        resolver.expand_entries = StorageServiceSource.expand_entries.__get__(resolver)
        resolver.filter_manifest_entries = (
            StorageServiceSource.filter_manifest_entries.__get__(resolver)
        )
        resolver.status = SimpleNamespace(
            filter=lambda *a, **kw: None, warning=lambda *a, **kw: None
        )
        return resolver

    def test_glob_expansion_then_filter_drops_excluded(self):
        from metadata.generated.schema.type.filterPattern import FilterPattern

        resolver = self._stub(
            keys=[
                ("data/events/f1.parquet", 10),
                ("data/staging/f1.parquet", 20),
                ("data/orders/f1.parquet", 30),
            ],
            container_filter_pattern=FilterPattern(excludes=[".*staging"]),
        )
        entry = MetadataEntry(dataPath="data/*/*.parquet", structureFormat="parquet")
        expanded = resolver.expand_entries("bucket", [entry])
        # All three globs expanded before filter runs.
        assert {e.dataPath for e in expanded} == {
            "data/events",
            "data/staging",
            "data/orders",
        }
        filtered = resolver.filter_manifest_entries("bucket", expanded)
        assert {e.dataPath for e in filtered} == {"data/events", "data/orders"}


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


class TestManifestEntryPartitionColumnConversion:
    """Regression tests for the cross-class PartitionColumn conversion at
    ``_manifest_entries_to_metadata_entries_by_container``.

    ``ManifestMetadataEntry.partitionColumns`` and
    ``MetadataEntry.partitionColumns`` are declared by two generated
    Pydantic models that happen to share the class name ``PartitionColumn``
    but live in different modules. Pydantic v2 rejects cross-class
    substitution, so the converter must dump to a dict so the target model
    re-constructs its own instance.
    """

    @staticmethod
    def _manifest_with_partition_cols(partition_cols):
        from metadata.generated.schema.metadataIngestion.storage.manifestMetadataConfig import (
            ManifestMetadataConfig,
            ManifestMetadataEntry,
        )
        from metadata.generated.schema.metadataIngestion.storage.manifestMetadataConfig import (
            PartitionColumn as ManifestPartitionColumn,
        )

        pc_objects = [ManifestPartitionColumn(**kwargs) for kwargs in partition_cols]
        return ManifestMetadataConfig(
            entries=[
                ManifestMetadataEntry(
                    containerName="bucket-a",
                    dataPath="data/events/dt=*/*.parquet",
                    structureFormat="parquet",
                    partitionColumns=pc_objects or None,
                )
            ]
        )

    def test_explicit_partition_columns_converted_to_metadata_entry(self):
        manifest = self._manifest_with_partition_cols(
            [{"name": "dt", "dataType": DataType.DATE}]
        )

        entries = (
            StorageServiceSource._manifest_entries_to_metadata_entries_by_container(
                container_name="bucket-a", manifest=manifest
            )
        )

        assert len(entries) == 1
        cols = entries[0].partitionColumns
        assert cols is not None
        assert len(cols) == 1
        assert cols[0].name == "dt"
        assert cols[0].dataType == DataType.DATE
        assert type(cols[0]).__module__ == (
            "metadata.generated.schema.metadataIngestion.storage."
            "containerMetadataConfig"
        )

    def test_partition_columns_none_stays_none(self):
        manifest = self._manifest_with_partition_cols([])

        entries = (
            StorageServiceSource._manifest_entries_to_metadata_entries_by_container(
                container_name="bucket-a", manifest=manifest
            )
        )

        assert entries[0].partitionColumns is None

    def test_partition_columns_optional_fields_preserved(self):
        manifest = self._manifest_with_partition_cols(
            [
                {
                    "name": "region",
                    "dataType": DataType.STRING,
                    "dataTypeDisplay": "Region",
                    "description": "Geographic region",
                },
                {"name": "year", "dataType": DataType.INT},
            ]
        )

        entries = (
            StorageServiceSource._manifest_entries_to_metadata_entries_by_container(
                container_name="bucket-a", manifest=manifest
            )
        )

        cols = entries[0].partitionColumns
        assert len(cols) == 2
        assert cols[0].name == "region"
        assert cols[0].dataType == DataType.STRING
        assert cols[0].dataTypeDisplay == "Region"
        assert cols[0].description == "Geographic region"
        assert cols[1].name == "year"
        assert cols[1].dataType == DataType.INT
        assert cols[1].dataTypeDisplay is None
        assert cols[1].description is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
