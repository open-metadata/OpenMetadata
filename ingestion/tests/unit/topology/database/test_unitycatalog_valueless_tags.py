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

"""Unity Catalog key-only tags retain their public classification and tag names."""

from threading import RLock
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource


def emit(rows):
    instance = object.__new__(UnitycatalogSource)
    instance.metadata = MagicMock()
    instance.metadata.es_search_from_fqn.return_value = []
    instance.source_config = DatabaseServiceMetadataPipeline(includeTags=True)
    instance.context = TopologyContextManager(instance.topology)
    instance.context.get().upsert("database_service", "svc")
    instance.context.get().upsert("database", "db")
    instance._state_lock = RLock()
    instance._sql_connection_map = {}
    instance.engine = MagicMock()
    instance.engine.connect.return_value.execute.side_effect = [
        [SimpleNamespace(tag_name=name, tag_value=value) for name, value in rows],
        [],
    ]
    records = list(instance._process_stage(instance.topology.database.stages[0], "db"))
    assert not any(record.left for record in records)
    return instance, [record.right for record in records]


def test_valued_tag_uses_key_as_classification():
    source, records = emit([("pii", "ssn")])
    assert len(records) == 1
    record = records[0]
    assert record.classification_request.name.root == "pii"
    assert record.classification_request.description.root == "UNITY CATALOG TAG CLASSIFICATION"
    assert record.tag_request.name.root == "ssn"
    assert record.tag_request.description.root == "UNITY CATALOG TAG"
    assert [label.tagFQN.root for label in source.get_database_tag_labels("db")] == ["pii.ssn"]


@pytest.mark.parametrize("value", [None, "", "   "])
@pytest.mark.parametrize(
    "name, expected",
    [("class.us_ssn", 'UNITY_CATALOG_TAGS."class.us_ssn"'), ("plain_tag", "UNITY_CATALOG_TAGS.plain_tag")],
)
def test_key_only_tags_keep_names_and_descriptions(value, name, expected):
    source, records = emit([(name, value)])
    assert len(records) == 1
    record = records[0]
    assert record.classification_request.name.root == "UNITY_CATALOG_TAGS"
    assert record.tag_request.name.root == name
    description = "Unity Catalog tags ingested as key-only (no associated value)."
    assert record.classification_request.description.root == description
    assert record.tag_request.description.root == description
    assert [label.tagFQN.root for label in source.get_database_tag_labels("db")] == [expected]


def test_empty_tag_names_do_not_discard_later_valid_tags():
    source, records = emit([("", "value"), (None, None), ("real_tag", None)])
    assert len(records) == 1
    assert records[0].tag_request.name.root == "real_tag"
    assert [label.tagFQN.root for label in source.get_database_tag_labels("db")] == ["UNITY_CATALOG_TAGS.real_tag"]
