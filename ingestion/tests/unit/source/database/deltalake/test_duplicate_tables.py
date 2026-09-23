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
"""Delta tables sharing a name collapse onto one FQN - issue #24840."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.source.database.deltalake.clients.base import TableInfo
from metadata.ingestion.source.database.deltalake.metadata import DeltalakeSource

SERVICE_NAME = "deltalake_source"
DATABASE_NAME = "default"
SCHEMA_NAME = "my-bucket"

MOCK_CONFIG = {
    "type": "deltalake",
    "serviceName": SERVICE_NAME,
    "serviceConnection": {
        "config": {
            "type": "DeltaLake",
            "configSource": {
                "connection": {
                    "securityConfig": {
                        "awsAccessKeyId": "aws_access_key_id",
                        "awsSecretAccessKey": "aws_secret_access_key",
                        "awsRegion": "us-east-2",
                    }
                },
                "bucketName": SCHEMA_NAME,
                "prefix": "prefix",
            },
        }
    },
    "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
}


def table_info(name: str, location: str) -> TableInfo:
    return TableInfo(
        schema=SCHEMA_NAME,
        name=name,
        _type=TableType.Regular,
        location=location,
        description=f"delta table at {location}",
    )


@pytest.fixture
def source():
    metadata = MagicMock()
    # Keep fqn.build on its name-based branch instead of resolving against a mocked index.
    metadata.es_search_from_fqn.return_value = None

    with (
        patch("metadata.ingestion.source.database.deltalake.metadata.create_connection"),
        patch.object(DeltalakeSource, "test_connection"),
    ):
        delta_source = DeltalakeSource.create(MOCK_CONFIG, metadata)

    delta_source.context.get().__dict__["database_service"] = SERVICE_NAME
    delta_source.context.get().__dict__["database"] = DATABASE_NAME
    delta_source.context.get().__dict__["database_schema"] = SCHEMA_NAME
    return delta_source


def discover(source, table_infos: list[TableInfo]) -> list[str]:
    """Run the discovery step over `table_infos` and return the names handed to the topology."""
    source.client = MagicMock()
    source.client.get_table_info.return_value = iter(table_infos)
    source.client.update_table_info.side_effect = lambda info: info
    return [name for name, _ in source.get_tables_name_and_type()]


def test_duplicate_names_are_reported_and_never_ingested(source):
    names = discover(
        source,
        [
            table_info("deltatable-name", "prefix/a/deltatable-name/"),
            table_info("table_a", "prefix/a/table_a/"),
            table_info("deltatable-name", "prefix/b/deltatable-name/"),
            table_info("table_b", "prefix/b/table_b/"),
        ],
    )

    # Neither of the colliding tables is ingested: keeping one would silently drop the other.
    assert names == ["table_a", "table_b"]

    assert len(source.status.failures) == 1
    failure = source.status.failures[0]
    assert failure.name == f"{SERVICE_NAME}.{DATABASE_NAME}.{SCHEMA_NAME}.deltatable-name"
    assert "Found 2 Delta tables named 'deltatable-name'" in failure.error
    assert "prefix/a/deltatable-name/" in failure.error
    assert "prefix/b/deltatable-name/" in failure.error
    assert SERVICE_NAME in failure.error
    assert SCHEMA_NAME in failure.error


def test_detection_does_not_depend_on_discovery_order(source):
    reversed_names = discover(
        source,
        [
            table_info("deltatable-name", "prefix/b/deltatable-name/"),
            table_info("deltatable-name", "prefix/a/deltatable-name/"),
        ],
    )

    assert reversed_names == []
    assert len(source.status.failures) == 1
    assert "at: prefix/a/deltatable-name/, prefix/b/deltatable-name/." in source.status.failures[0].error


def test_more_than_two_duplicates_are_reported_together(source):
    names = discover(
        source,
        [
            table_info("deltatable-name", "prefix/a/deltatable-name/"),
            table_info("deltatable-name", "prefix/b/deltatable-name/"),
            table_info("deltatable-name", "prefix/c/deltatable-name/"),
        ],
    )

    assert names == []
    assert len(source.status.failures) == 1
    failure = source.status.failures[0]
    assert "Found 3 Delta tables named 'deltatable-name'" in failure.error
    assert "prefix/c/deltatable-name/" in failure.error


def test_unique_names_under_different_prefixes_are_ingested(source):
    names = discover(
        source,
        [
            table_info("table_a", "prefix/a/table_a/"),
            table_info("table_b", "prefix/b/table_b/"),
        ],
    )

    assert names == ["table_a", "table_b"]
    assert source.status.failures == []


def test_filtered_out_duplicates_do_not_fail_the_ingestion(source):
    source.source_config.tableFilterPattern = FilterPattern(excludes=["deltatable-name"])

    names = discover(
        source,
        [
            table_info("deltatable-name", "prefix/a/deltatable-name/"),
            table_info("deltatable-name", "prefix/b/deltatable-name/"),
            table_info("table_a", "prefix/a/table_a/"),
        ],
    )

    assert names == ["table_a"]
    assert source.status.failures == []
    assert len(source.status.filtered) == 2


def test_duplicates_keep_the_existing_entity_out_of_the_deletion_sweep(source):
    """The colliding tables exist, so a namesake ingested earlier must not be marked stale."""
    discover(
        source,
        [
            table_info("deltatable-name", "prefix/a/deltatable-name/"),
            table_info("deltatable-name", "prefix/b/deltatable-name/"),
        ],
    )

    assert source.database_source_state == {f"{SERVICE_NAME}.{DATABASE_NAME}.{SCHEMA_NAME}.deltatable-name"}


def test_a_listing_error_keeps_the_tables_already_discovered(source):
    """A failure partway through the S3 listing must not discard the tables found before it."""

    def failing_listing(*_, **__):
        yield table_info("table_a", "prefix/a/table_a/")
        yield table_info("table_b", "prefix/b/table_b/")
        raise ConnectionError("s3 pagination failed")

    source.client = MagicMock()
    source.client.get_table_info.side_effect = failing_listing
    source.client.update_table_info.side_effect = lambda info: info

    names = [name for name, _ in source.get_tables_name_and_type()]

    assert names == ["table_a", "table_b"]
    assert len(source.status.failures) == 1
    assert "s3 pagination failed" in source.status.failures[0].error
