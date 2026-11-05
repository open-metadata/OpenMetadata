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
Canonicalising the storage URIs Unity Catalog reports.

Databricks names one location several ways: `system.access.table_lineage` and
`system.information_schema.tables` disagree about the trailing slash for the
same table, and the Hadoop scheme aliases address the same object store.
"""

import pytest

from metadata.ingestion.source.database.unitycatalog.path_utils import (
    container_path_candidates,
    normalize_storage_path,
)


class TestNormalizeStoragePath:
    @pytest.mark.parametrize(
        ("path", "expected"),
        [
            # Observed live in one metastore, for the same location, in one week:
            # the lineage row carries the slash and storage_path does not.
            ("s3://awsdatalake-testing/test.csv", "s3://awsdatalake-testing/test.csv"),
            ("s3://awsdatalake-testing/test.csv/", "s3://awsdatalake-testing/test.csv"),
            ("s3://bucket/data///", "s3://bucket/data"),
            # Scheme is case insensitive and de-aliased
            ("S3://bucket/data", "s3://bucket/data"),
            ("s3a://bucket/data", "s3://bucket/data"),
            ("s3n://bucket/data", "s3://bucket/data"),
            ("ABFSS://raw@acct.dfs.core.windows.net/t", "abfss://raw@acct.dfs.core.windows.net/t"),
            ("abfs://raw@acct.dfs.core.windows.net/t", "abfss://raw@acct.dfs.core.windows.net/t"),
            ("wasbs://raw@acct.blob.core.windows.net/t", "abfss://raw@acct.blob.core.windows.net/t"),
            ("gcs://bucket/data", "gs://bucket/data"),
            # A bare mount point has no scheme to normalize
            ("/mnt/data/", "/mnt/data"),
            ("dbfs:/mnt/data/", "dbfs:/mnt/data"),
            # Nothing to canonicalise
            (None, None),
            ("", None),
            ("   ", None),
            ("/", None),
        ],
    )
    def test_normalization(self, path, expected):
        assert normalize_storage_path(path) == expected

    def test_the_object_key_keeps_its_case(self):
        """S3 keys are case sensitive; folding them would merge distinct locations."""
        assert normalize_storage_path("s3://Bucket/Key/File.CSV") == "s3://Bucket/Key/File.CSV"

    def test_whitespace_is_trimmed(self):
        assert normalize_storage_path("  s3://bucket/data  ") == "s3://bucket/data"


class TestContainerPathCandidates:
    def test_raw_form_is_tried_before_the_normalized_one(self):
        """A container's fullPath is whatever its storage connector recorded."""
        assert container_path_candidates("s3a://bucket/data/") == [
            "s3a://bucket/data",
            "s3://bucket/data",
        ]

    def test_an_already_canonical_path_is_offered_once(self):
        assert container_path_candidates("s3://bucket/data") == ["s3://bucket/data"]

    @pytest.mark.parametrize("path", [None, "", "   "])
    def test_nothing_to_look_up(self, path):
        assert container_path_candidates(path) == []
