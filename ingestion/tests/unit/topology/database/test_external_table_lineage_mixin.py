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
Resolving an external table location to the container the storage connector recorded.

The container search matches fullPath exactly. The S3 and GCS connectors record it with no
trailing separator, while catalogs such as Glue usually report the location with one.
"""

from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.type.basic import Uuid
from metadata.ingestion.source.database.external_table_lineage_mixin import (
    ExternalTableLineageMixin,
    container_lookup_paths,
)


class TestContainerLookupPaths:
    @pytest.mark.parametrize(
        ("location", "expected"),
        [
            # The same location with and without one trailing separator searches the same paths
            ("s3://bucket/events/", ["s3://bucket/events", "s3://bucket/events/"]),
            ("s3://bucket/events", ["s3://bucket/events", "s3://bucket/events/"]),
            ("gs://bucket/data/", ["gs://bucket/data", "gs://bucket/data/"]),
            # A bucket root names the bucket container
            ("s3://bucket/", ["s3://bucket", "s3://bucket/"]),
            # The scheme is case insensitive and de-aliased, and the location as reported comes last
            ("s3a://bucket/events/", ["s3://bucket/events", "s3://bucket/events/", "s3a://bucket/events/"]),
            ("S3N://Bucket/Key", ["s3://Bucket/Key", "s3://Bucket/Key/", "S3N://Bucket/Key"]),
            # GCS storage connector records gs://, but Snowflake reports gcs://
            ("gcs://bucket/events/", ["gs://bucket/events", "gs://bucket/events/", "gcs://bucket/events/"]),
            ("GCS://Bucket/Key", ["gs://Bucket/Key", "gs://Bucket/Key/", "GCS://Bucket/Key"]),
            # Azure storage connector records abfss://, but Hadoop-era clients report abfs/wasb/wasbs
            (
                "abfs://acct.dfs.core.windows.net/key",
                [
                    "abfss://acct.dfs.core.windows.net/key",
                    "abfss://acct.dfs.core.windows.net/key/",
                    "abfs://acct.dfs.core.windows.net/key",
                ],
            ),
            (
                "wasbs://acct.blob.core.windows.net/key/",
                [
                    "abfss://acct.blob.core.windows.net/key",
                    "abfss://acct.blob.core.windows.net/key/",
                    "wasbs://acct.blob.core.windows.net/key/",
                ],
            ),
            # Only one separator goes, since a//b and a/b are different keys
            ("s3://bucket/events//", ["s3://bucket/events/", "s3://bucket/events//"]),
            # Only the leading scheme is rewritten
            ("s3://bucket/s3a://x", ["s3://bucket/s3a://x", "s3://bucket/s3a://x/"]),
            # Snowflake reports a stage rather than a URI
            ("@DB.SCHEMA.STAGE/path/", ["@DB.SCHEMA.STAGE/path", "@DB.SCHEMA.STAGE/path/"]),
        ],
    )
    def test_lookup_paths(self, location, expected):
        assert container_lookup_paths(location) == expected

    def test_the_object_key_keeps_its_case_and_spaces(self):
        """S3 keys are case sensitive and may end in a space, so folding either would merge distinct
        locations."""
        assert container_lookup_paths("s3://Bucket/Key /") == ["s3://Bucket/Key ", "s3://Bucket/Key /"]

    @pytest.mark.parametrize("location", ["s3://", "/", "file:///", None, "", "   "])
    def test_a_location_that_names_no_container_searches_nothing(self, location):
        assert container_lookup_paths(location) == []


class _Source(ExternalTableLineageMixin):
    """The attributes the mixin reads from a database source, with the search finding nothing."""

    def __init__(self, external_location_map: dict):
        self.external_location_map = external_location_map
        self.metadata = MagicMock()
        self.metadata.es_search_container_by_path.return_value = None


class TestYieldExternalTableLineage:
    def test_a_missing_location_issues_no_search(self):
        """Athena views and Databricks dbfs tables are recorded with no location."""
        source = _Source({("db", "schema", "view"): None})

        assert list(source.yield_external_table_lineage()) == []
        source.metadata.es_search_container_by_path.assert_not_called()
        source.metadata.es_search_from_fqn.assert_not_called()

    def test_an_unmatched_location_costs_no_table_search(self):
        """The edge starts at the container, so the table is looked up only once one is found."""
        source = _Source({("db", "schema", "events"): "@DB.SCHEMA.STAGE/events/"})

        assert list(source.yield_external_table_lineage()) == []
        searched = [call.kwargs["full_path"] for call in source.metadata.es_search_container_by_path.call_args_list]
        assert searched == ["@DB.SCHEMA.STAGE/events", "@DB.SCHEMA.STAGE/events/"]
        source.metadata.es_search_from_fqn.assert_not_called()

    def test_a_gcs_location_finds_a_container_indexed_as_gs(self):
        """The GCS storage connector records containers as gs://, but Snowflake reports gcs://.
        The de-aliasing must let the exact-match lookup find the container and emit the edge."""
        container = MagicMock()
        container.id = Uuid("44444444-4444-4444-4444-444444444444")
        container.dataModel = None
        table_entity = MagicMock()
        table_entity.columns = []
        table_entity.id = Uuid("33333333-3333-3333-3333-333333333333")

        def _search(full_path, fields="dataModel"):
            # The container was indexed as gs://bucket/events — only gs:// candidates match.
            if full_path.startswith("gs://"):
                return [container]
            return None

        source = _Source({("db", "schema", "events"): "gcs://bucket/events/"})
        source.metadata.es_search_container_by_path.side_effect = _search
        source.metadata.es_search_from_fqn.return_value = [table_entity]
        source.context = MagicMock()
        source.context.get().database_service = "test_service"

        edges = list(source.yield_external_table_lineage())

        assert len(edges) == 1
        searched = [call.kwargs["full_path"] for call in source.metadata.es_search_container_by_path.call_args_list]
        # The canonical gs:// candidate must be searched (proving gcs -> gs de-aliasing happened)
        assert "gs://bucket/events" in searched
        # The first candidate matched, so the raw gcs:// form was never reached
        assert all(not p.startswith("gcs://") for p in searched)
