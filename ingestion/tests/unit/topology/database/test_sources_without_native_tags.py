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
"""Connectors without native tags preserve their empty extraction contract."""

from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.database.datalake.metadata import DatalakeSource
from metadata.ingestion.source.database.glue.metadata import GlueSource
from metadata.ingestion.source.database.mongodb.metadata import MongodbSource
from metadata.ingestion.source.database.mysql.metadata import MysqlSource


@pytest.fixture(params=[MysqlSource, MongodbSource, GlueSource, DatalakeSource])
def default_source(request):
    instance = object.__new__(request.param)
    instance.source_config = DatabaseServiceMetadataPipeline(includeTags=True)
    instance.context = TopologyContextManager(instance.topology)
    for key, value in (("database_service", "svc"), ("database", "db"), ("database_schema", "schema")):
        instance.context.get().upsert(key, value)
    instance.metadata = MagicMock()
    instance.metadata.es_search_from_fqn.side_effect = AssertionError("Empty tags must not query search")
    instance.metadata.get_by_name.side_effect = AssertionError("Label lookup must not access the server")
    return instance


@pytest.mark.parametrize("include_tags", [True, False])
def test_default_sources_emit_no_tags_and_keep_empty_lookups(default_source, include_tags):
    source = default_source
    source.source_config.includeTags = include_tags
    source.context.get().upsert("database", "db")
    source.context.get().upsert("database_schema", "schema")
    for node, item in (
        (source.topology.database, "db"),
        (source.topology.databaseSchema, "schema"),
        (source.topology.table, ("table", "Regular")),
    ):
        assert list(source._process_stage(node.stages[0], item)) == []
    assert source.get_database_tag_labels("db") is None
    assert source.get_schema_tag_labels("schema") is None
    assert source.get_tag_labels("table") is None
    assert source.get_column_tag_labels("table", {"name": "column"}) is None
    list(source.clear_schema_tag_scope())
    list(source.clear_database_tag_scope())
    assert source.tags_registry.stats()["live_entities"] == 0
    assert source.tags_registry.stats()["pending"] == 0
    assert getattr(source.context.get(), "tags", None) is None
