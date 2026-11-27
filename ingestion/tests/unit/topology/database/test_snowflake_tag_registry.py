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
"""Snowflake native tag extraction and asset mapping."""

from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import SnowflakeConnection
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline
from metadata.ingestion.api.status import Status
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource
from metadata.utils.logger import StatusWarningHandler


@pytest.fixture
def source(existing_tag_lookup):
    # These tests exercise source stages without opening an external database connection.
    instance = object.__new__(SnowflakeSource)
    instance.source_config = DatabaseServiceMetadataPipeline(includeTags=True)
    instance.context = TopologyContextManager(instance.topology)
    instance.context.get().upsert("database_service", "svc")
    instance.context.get().upsert("database", "db")
    instance.context.get().upsert("database_schema", "schema")
    instance.metadata = MagicMock()
    instance.metadata.es_search_from_fqn.return_value = []
    instance.metadata.get_by_name.side_effect = existing_tag_lookup
    return instance


@pytest.fixture
def status(source):
    # Counts logged warnings in the run status, the way a running workflow step does.
    source.status = Status()
    source._warning_handler = StatusWarningHandler(source.status)
    source._activate_handler()
    yield source.status
    source._deactivate_handler()


def _warning_messages(status: Status) -> list[str]:
    return [message for warning in status.warnings for message in warning.values()]


def test_snowflake_stage_emits_and_attaches_without_tag_context(source):
    source.database_tags_map = {"db": [{"tag_name": "Class", "tag_value": "Value"}]}
    stage = source.topology.database.stages[0]
    source.context.get().upsert("database", "db")
    records = list(source._process_stage(stage, "db"))
    assert len(records) == 1
    assert records[0].right.tag_request.name.root == "Value"
    assert [label.tagFQN.root for label in source.get_database_tag_labels("db")] == ["Class.Value"]
    assert getattr(source.context.get(), "tags", None) is None
    assert source.get_tag_by_fqn("svc.db.schema.untagged") is None
    list(source.clear_database_tag_scope())
    assert source.tags_registry.stats()["live_entities"] == 0
    assert source.get_database_tag_labels("db") is None


def test_snowflake_stage_skips_unnameable_value_and_emits_valid_one(source, status):
    source.database_tags_map = {
        "db": [
            {"tag_name": "Class", "tag_value": '{"invalid": "name"}'},
            {"tag_name": "Class", "tag_value": "Valid"},
        ]
    }
    records = list(source._process_stage(source.topology.database.stages[0], "db"))
    definitions = [record.right for record in records if record.right]
    assert [record.left for record in records if record.left] == []
    assert [record.tag_request.name.root for record in definitions] == ["Valid"]
    assert [label.tagFQN.root for label in source.get_database_tag_labels("db")] == ["Class.Valid"]
    assert [message.split(":")[0] for message in _warning_messages(status)] == ["svc.db"]


def test_disabled_tags_do_not_register_or_emit(source):
    source.source_config.includeTags = False
    source.database_tags_map = {"db": [{"tag_name": "Class", "tag_value": "Value"}]}
    assert list(source._process_stage(source.topology.database.stages[0], "db")) == []
    assert source.get_database_tag_labels("db") is None
    assert source.tags_registry.stats()["pending"] == 0
    assert source.tags_registry.stats()["live_entities"] == 0


def test_snowflake_schema_stage_skips_feature_store_json_tags(source, status):
    source.service_connection = SnowflakeConnection(username="user", account="account", warehouse="warehouse")
    feature_view = "SOME_FEATURES$v1"
    object_json = '{"type": "EXTERNAL_FEATURE_VIEW", "pkg_version": "1.16.0"}'
    metadata_json = '{"entities": ["MY_ENTITY"], "timestamp_col": "NULL"}'
    connection = MagicMock()
    # TAG_NAME, TAG_VALUE, OBJECT_DATABASE, OBJECT_SCHEMA, OBJECT_NAME, COLUMN_NAME, as TAG_REFERENCES returns them
    connection.execute.return_value = [
        ("SNOWML_FEATURE_STORE_ENTITY_MY_ENTITY", "COL_A,COL_B", "db", "schema", feature_view, None),
        ("SNOWML_FEATURE_STORE_OBJECT", object_json, "db", "schema", feature_view, None),
        ("SNOWML_FEATURE_VIEW_METADATA", metadata_json, "db", "schema", feature_view, None),
        ("SNOWML_FEATURE_VIEW_METADATA", '{"col": "COL_A"}', "db", "schema", "SRC", "COL_A"),
        ("PLAIN_TAG", "gold", "db", "schema", "SRC", "COL_B"),
    ]
    source._connection_map = {source.context.get_current_thread_id(): connection}
    source.schema_tags_map = {
        "schema": [
            {"tag_name": "SNOWML_FEATURE_STORE_OBJECT", "tag_value": '{"type": "FEATURE_STORE"}'},
            {"tag_name": "PLAIN_TAG", "tag_value": "silver"},
        ]
    }

    records = list(source._process_stage(source.topology.databaseSchema.stages[0], "schema"))

    assert [record.left for record in records if record.left] == []
    assert sorted(
        f"{record.right.classification_request.name.root}.{record.right.tag_request.name.root}"
        for record in records
        if record.right
    ) == ["PLAIN_TAG.gold", "PLAIN_TAG.silver", "SNOWML_FEATURE_STORE_ENTITY_MY_ENTITY.COL_A,COL_B"]
    assert [label.tagFQN.root for label in source.get_tag_by_fqn(f"svc.db.schema.{feature_view}")] == [
        "SNOWML_FEATURE_STORE_ENTITY_MY_ENTITY.COL_A,COL_B"
    ]
    assert status.failures == []
    assert sorted(message.split(": ")[0] for message in _warning_messages(status)) == [
        "svc.db.schema",
        f"svc.db.schema.{feature_view}",
        f"svc.db.schema.{feature_view}",
        "svc.db.schema.SRC.COL_A",
    ]
