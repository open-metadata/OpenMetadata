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
"""Metadata-source definitions and labels persisted through real workflows."""

from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import CreateDatabaseSchemaRequest
from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import CreateGlossaryTermRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceRequest
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.type.tagLabel import LabelType, State, TagLabel, TagSource
from metadata.ingestion.source.metadata.amundsen import metadata as amundsen
from metadata.ingestion.source.metadata.amundsen.connection import AmundsenConnection
from metadata.ingestion.source.metadata.amundsen.queries import NEO4J_AMUNDSEN_TABLE_QUERY
from metadata.ingestion.source.metadata.atlas import metadata as atlas
from metadata.ingestion.source.metadata.atlas.client import AtlasClient

from ..conftest import _safe_delete  # noqa: TID252
from .test_workflow import _assert_workflow, _tag_catalog  # noqa: TID252


@pytest.mark.parametrize("case", ["fresh", "existing", "denied", "invalid"])
def test_amundsen_table_tags_persist_through_workflow(metadata, request, monkeypatch, case):
    with _tag_catalog(metadata, request, "fresh" if case == "invalid" else case, DatabaseService) as (
        config,
        classification,
    ):
        monkeypatch.setattr(amundsen, "AMUNDSEN_TAG_CATEGORY", classification)
        service = config["source"]["serviceName"]
        monkeypatch.setitem(amundsen.SERVICE_TYPE_MAPPER, service, amundsen.SERVICE_TYPE_MAPPER["mysql"])
        native_table = {
            "database": service,
            "cluster": "my_catalog",
            "schema": "my_schema",
            "name": "my.table",
            "description": "Native table description",
            "column_names": ["id"],
            "column_types": ["int"],
            "column_descriptions": ["Identifier"],
            "tags": ["Shared", "New", ""],
        }
        if case == "invalid":
            native_table["tags"].insert(0, 'bad"tag')
        client = MagicMock()
        client.execute_query.side_effect = lambda query: iter(
            [native_table] if query == NEO4J_AMUNDSEN_TABLE_QUERY else []
        )
        monkeypatch.setattr(AmundsenConnection, "_get_client", lambda _: client)
        config["source"].update(
            {
                "type": "amundsen",
                "serviceConnection": {
                    "config": {
                        "type": "Amundsen",
                        "hostPort": "bolt://localhost:7687",
                        "username": "neo4j",
                        "password": "testing",
                        "encrypted": False,
                    }
                },
                "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
            }
        )
        table_fqn = f'{service}.default.my_schema."my.table"'
        names = ["Shared"] if case == "denied" else ["amundsen_table", "my_catalog", "Shared", "New"]
        _assert_workflow(
            metadata,
            config,
            Table,
            {table_fqn: [f"{classification}.{name}" for name in names]},
            expected_failures=4 if case == "denied" else 0,
            expected_source_failures=1 if case == "invalid" else 0,
        )
        table = metadata.get_by_name(entity=Table, fqn=table_fqn, fields=["tags"])
        assert table.description.root == "Native table description"
        assert table.columns[0].name.root == "id"
        assert all(label.source == TagSource.Classification for label in table.tags)


@pytest.mark.parametrize("case", ["fresh", "existing", "denied", "invalid"])
def test_atlas_adds_confirmed_tags_without_removing_glossary_labels(metadata, request, monkeypatch, case):
    with _tag_catalog(metadata, request, "fresh" if case == "invalid" else case, DatabaseService) as (
        config,
        classification,
    ):
        monkeypatch.setattr(atlas, "ATLAS_TAG_CATEGORY", classification)
        service = config["source"]["serviceName"]
        metadata.create_or_update(
            CreateDatabaseServiceRequest(
                name=service,
                serviceType="Mysql",
                connection={"config": {"type": "Mysql", "hostPort": "localhost:3306", "username": "testing"}},
            )
        )
        metadata.create_or_update(CreateDatabaseRequest(name="default", service=service))
        schema = metadata.create_or_update(CreateDatabaseSchemaRequest(name="my_schema", database=f"{service}.default"))
        glossary = metadata.create_or_update(
            CreateGlossaryRequest(name=f"glossary_{service}", description="Existing terms")
        )
        try:
            term = metadata.create_or_update(
                CreateGlossaryTermRequest(
                    name="Existing", glossary=glossary.fullyQualifiedName, description="Existing label"
                )
            )
            existing_label = TagLabel(
                tagFQN=term.fullyQualifiedName.root,
                source=TagSource.Glossary,
                labelType=LabelType.Manual,
                state=State.Confirmed,
            )
            table = metadata.create_or_update(
                CreateTableRequest(
                    name="my.table",
                    databaseSchema=schema.fullyQualifiedName,
                    columns=[{"name": "id", "dataType": "INT"}],
                    tags=[existing_label],
                )
            )
            native_table = {
                "guid": "table-guid",
                "attributes": {"name": "my.table", "description": "Native Atlas description"},
                "relationshipAttributes": {"db": {"displayText": "my_schema"}, "columns": []},
                "classifications": [{"typeName": "Shared"}, {"typeName": "New"}, {"typeName": ""}, {}],
            }
            if case == "invalid":
                native_table["classifications"].insert(0, {"typeName": 'bad"tag'})
            monkeypatch.setattr(AtlasClient, "list_entities", lambda _: ["table-guid"])
            monkeypatch.setattr(
                AtlasClient, "get_entity", lambda *_: {"entities": [native_table], "referredEntities": {}}
            )
            monkeypatch.setattr(
                AtlasClient, "get_lineage", lambda *_: {"baseEntityGuid": "table-guid", "relations": []}
            )
            config["source"].update(
                {
                    "type": "atlas",
                    "serviceConnection": {
                        "config": {
                            "type": "Atlas",
                            "hostPort": "http://localhost:21000",
                            "username": "admin",
                            "password": "testing",
                            "databaseServiceName": [service],
                            "entity_type": "hive_table",
                        }
                    },
                    "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
                }
            )
            names = ["Shared"] if case == "denied" else ["atlas_table", "Shared", "New"]
            _assert_workflow(
                metadata,
                config,
                Table,
                {
                    table.fullyQualifiedName.root: [
                        term.fullyQualifiedName.root,
                        *(f"{classification}.{name}" for name in names),
                    ]
                },
                expected_failures=3 if case == "denied" else 0,
                expected_source_failures=1 if case == "invalid" else 0,
            )
            table = metadata.get_by_name(entity=Table, fqn=table.fullyQualifiedName.root, fields=["tags"])
            assert table.description.root == "Native Atlas description"
            retained = next(label for label in table.tags if label.tagFQN.root == term.fullyQualifiedName.root)
            assert (retained.source, retained.labelType, retained.state) == (
                TagSource.Glossary,
                LabelType.Manual,
                State.Confirmed,
            )
        finally:
            _safe_delete(metadata, Glossary, glossary.id, recursive=True, hard_delete=True)
