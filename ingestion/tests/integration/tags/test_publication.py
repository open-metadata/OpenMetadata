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
"""Tag publication through source stages, worker queues and an in-memory REST catalog."""

import json
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from urllib.parse import unquote, urlsplit
from uuid import UUID

import pytest
from requests import Response

from metadata.domain.tags import TagDefinition
from metadata.generated.schema.api.data.createDatabaseSchema import CreateDatabaseSchemaRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.status import Status
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.topology import Queue, TopologyContextManager
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.sink.metadata_rest import MetadataRestSink, MetadataRestSinkConfig
from metadata.ingestion.source.database.database_service import DatabaseServiceTopology
from metadata.ingestion.source.database.mysql.metadata import MysqlSource
from metadata.utils.fqn import split


class CatalogHTTP:
    def __init__(self, fail_definition=None):
        self.tags = set()
        self.tables = {}
        self.tag_reads = []
        self.definition_writes = []
        self.persistence_order = []
        self.fail_definition = fail_definition

    def get_tag(self, tag_fqn):
        self.tag_reads.append(tag_fqn)
        if tag_fqn not in self.tags:
            return 404, {"message": "Tag not found"}
        classification, name = split(tag_fqn)
        return 200, {
            "id": str(UUID(int=2)),
            "name": name,
            "description": "Native tag",
            "fullyQualifiedName": tag_fqn,
            "classification": {"id": str(UUID(int=1)), "type": "classification", "name": classification},
        }

    def request(self, method, url, **kwargs):
        path = urlsplit(url).path
        status = 200
        payload = kwargs.get("json")
        if payload is None and kwargs.get("data"):
            payload = json.loads(kwargs["data"])

        if method.upper() == "GET" and path.endswith("/search/fieldQuery"):
            body = {"hits": {"hits": [], "total": {"value": 0}}}
        elif method.upper() == "GET" and "/tags/name/" in path:
            status, body = self.get_tag(unquote(path.split("/tags/name/", 1)[1]))
        elif path.endswith("/classifications"):
            self.definition_writes.append("classification")
            if self.fail_definition == "classification":
                status, body = 403, {"message": "Classification write denied"}
            else:
                body = {**payload, "id": str(UUID(int=1))}
        elif path.endswith("/tags"):
            self.definition_writes.append("tag")
            if self.fail_definition == "tag":
                status, body = 403, {"message": "Tag write denied"}
            else:
                self.tags.add(f"{payload['classification']}.{payload['name']}")
                self.persistence_order.append(("tag", f"{payload['classification']}.{payload['name']}"))
                body = {
                    **payload,
                    "id": str(UUID(int=2)),
                    "classification": {
                        "id": str(UUID(int=1)),
                        "type": "classification",
                        "name": payload["classification"],
                    },
                }
        elif path.endswith("/bulk"):
            missing = {label["tagFQN"] for entity in payload for label in entity.get("tags", [])} - self.tags
            if missing:
                status, body = 400, {"message": f"Unknown tags: {sorted(missing)}"}
            else:
                if path.endswith("/tables/bulk"):
                    for table in payload:
                        table_fqn = f"{table['databaseSchema']}.{table['name']}"
                        self.tables[table_fqn] = table
                        self.persistence_order.append(("table", table_fqn))
                body = {
                    "status": "success",
                    "numberOfRowsProcessed": len(payload),
                    "numberOfRowsFailed": 0,
                    "successRequest": [],
                    "failedRequest": [],
                }
        else:
            raise AssertionError(f"Unexpected HTTP request: {method} {path}")

        response = Response()
        response.status_code = status
        if status >= 400:
            response.reason = body["message"]
        response._content = json.dumps(body).encode()
        response.headers["Content-Type"] = "application/json"
        response.url = url
        return response


class PausingQueue(Queue):
    def __init__(self, fail_publication):
        super().__init__()
        self.publication_paused = Event()
        self.release_publication = Event()
        self.fail_publication = fail_publication

    def put(self, record):
        if isinstance(record.right, OMetaTagAndClassification) and not self.publication_paused.is_set():
            self.publication_paused.set()
            assert self.release_publication.wait(timeout=10)
            if self.fail_publication:
                raise RuntimeError("publication failed")
        super().put(record)


class TaggedDatabaseSource(MysqlSource):
    def __init__(self, metadata, shared_tag, fail_publication):
        self.metadata = metadata
        self.source_config = DatabaseServiceMetadataPipeline(
            includeTags=True,
            markDeletedSchemas=False,
            markDeletedTables=False,
            markDeletedStoredProcedures=False,
        )
        self.status = Status()
        self.topology = DatabaseServiceTopology()
        self.topology.databaseSchema.children = ["table"]
        self.topology.table.stages = self.topology.table.stages[:2]
        self.queue = PausingQueue(fail_publication)
        self.second_discovered = Event()
        self.shared_tag = shared_tag

    def declare_progress_totals(self, totals):
        pass

    def get_database_schema_names(self):
        yield from ("schema_a", "schema_b")

    def yield_tag(self, schema_name):
        if schema_name == "schema_b":
            assert self.queue.publication_paused.wait(timeout=10)
        names = ["Shared"] if self.shared_tag else (["A", "B"] if schema_name == "schema_a" else ["B"])
        definitions = [
            self.define_tag(
                classification_name="Class", tag_name=name, classification_description="", tag_description=""
            )
            for name in names
        ]
        self.attach_tag(entity_fqn=f"svc.db.{schema_name}.my_table", tag=definitions[0])
        if schema_name == "schema_b":
            self.second_discovered.set()
        return []

    def yield_database_schema(self, schema_name):
        yield Either(right=CreateDatabaseSchemaRequest(name=schema_name, database="svc.db"))

    def get_tables_name_and_type(self):
        yield "my_table", TableType.Regular

    def yield_table(self, table_name_and_type):
        yield Either(
            right=CreateTableRequest(
                name=table_name_and_type[0],
                databaseSchema=f"svc.db.{self.context.get().database_schema}",
                columns=[{"name": "my_column", "dataType": "INT"}],
                tags=self.get_tag_labels(table_name_and_type[0]),
            )
        )


@pytest.mark.parametrize("already_present", [False, True])
@pytest.mark.parametrize("shared_tag", [False, True])
@pytest.mark.parametrize("fail_publication", [False, True])
def test_parallel_schema_tables_reach_sink_after_their_definitions(
    monkeypatch, shared_tag, fail_publication, already_present
):
    catalog = CatalogHTTP()
    if already_present:
        catalog.tags = {"Class.Shared"} if shared_tag else {"Class.A", "Class.B"}
    monkeypatch.setattr("requests.Session.request", lambda _, *args, **kwargs: catalog.request(*args, **kwargs))
    metadata = OpenMetadata(
        OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="basic",
            securityConfig={"jwtToken": "test-token"},
            enableVersionValidation=False,
        ),
        additional_client_config_arguments={"retry": 0, "retry_wait": 0},
    )
    source = TaggedDatabaseSource(metadata, shared_tag, fail_publication)
    sink = MetadataRestSink(MetadataRestSinkConfig(bulk_sink_batch_size=1), metadata)

    def ingest():
        source.context = TopologyContextManager(source.topology)
        source.context.set_threads(2)
        source.context.get().upsert("database_service", "svc")
        source.context.get().upsert("database", "db")
        for record in source.process_nodes([source.topology.databaseSchema]):
            assert record.left is None
            sink.run(record.right)

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            ingestion = pool.submit(ingest)
            try:
                discovered = source.second_discovered.wait(timeout=10)
                if not discovered:
                    ingestion.result(timeout=1)
                assert discovered
            finally:
                source.queue.release_publication.set()
            if fail_publication:
                with pytest.raises(RuntimeError, match="publication failed"):
                    ingestion.result(timeout=10)
            else:
                ingestion.result(timeout=10)

        for record in source.queue.process():
            sink.run(record.right)

        assert source.status.failures == sink.status.failures == []
        expected = ("Class.Shared", "Class.Shared") if shared_tag else ("Class.A", "Class.B")
        expected_tables = {
            f"svc.db.{schema}.my_table": [tag] for schema, tag in zip(("schema_a", "schema_b"), expected, strict=True)
        }
        if fail_publication:
            del expected_tables["svc.db.schema_a.my_table"]
        assert set(catalog.tables) == set(expected_tables)
        for table_fqn, tags in expected_tables.items():
            table_index = catalog.persistence_order.index(("table", table_fqn))
            assert catalog.persistence_order.index(("tag", tags[0])) < table_index
            actual_tags = [label["tagFQN"] for label in catalog.tables[table_fqn].get("tags", [])]
            if already_present:
                assert actual_tags == tags
            else:
                assert actual_tags in ([], tags)
        assert catalog.tags == set(expected)
        assert catalog.definition_writes.count("tag") == len(set(expected))
        assert source.tags_registry.stats()["pending"] == 0
        assert source.tags_registry.stats()["live_entities"] == int(fail_publication)
        assert len(source.context.contexts) == 1
    finally:
        metadata.close()


@pytest.mark.parametrize("fail_definition", [None, "classification", "tag"])
@pytest.mark.parametrize("already_present", [True, False])
def test_assets_survive_definition_failures_with_only_existing_labels(monkeypatch, fail_definition, already_present):
    catalog = CatalogHTTP(fail_definition=fail_definition)
    if already_present:
        catalog.tags.add("Class.Shared")
    monkeypatch.setattr("requests.Session.request", lambda _, *args, **kwargs: catalog.request(*args, **kwargs))
    metadata = OpenMetadata(
        OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="basic",
            securityConfig={"jwtToken": "test-token"},
            enableVersionValidation=False,
        ),
        additional_client_config_arguments={"retry": 0, "retry_wait": 0},
    )
    sink = MetadataRestSink(MetadataRestSinkConfig(bulk_sink_batch_size=1), metadata)
    try:
        source = TaggedDatabaseSource(metadata, shared_tag=True, fail_publication=False)
        source.context = TopologyContextManager(source.topology)
        for key, value in (("database_service", "svc"), ("database", "db"), ("database_schema", "schema_a")):
            source.context.get().upsert(key, value)
        for record in source.yield_database_schema_tag_details("schema_a"):
            sink.run(record.right)
        source.attach_tag(entity_fqn="svc.db.schema_a.other_table", tag=TagDefinition("Class", "Shared", "", ""))
        for name in ("my_table", "other_table"):
            for record in source.yield_table((name, TableType.Regular)):
                sink.run(record.right)
        assets = catalog.tables

        assert len(assets) == 2
        expected = ["Class.Shared"] if already_present or fail_definition is None else []
        assert [[label["tagFQN"] for label in asset.get("tags", [])] for asset in assets.values()] == [
            expected,
            expected,
        ]
        assert catalog.tag_reads == ["Class.Shared"]
        assert catalog.definition_writes.count("classification") == 1
        assert catalog.definition_writes.count("tag") == int(fail_definition != "classification")
        assert len(sink.status.failures) == int(fail_definition is not None)
    finally:
        metadata.close()


def test_worker_cached_miss_survives_later_definition_persistence(monkeypatch):
    catalog = CatalogHTTP()
    monkeypatch.setattr("requests.Session.request", lambda _, *args, **kwargs: catalog.request(*args, **kwargs))
    metadata = OpenMetadata(
        OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="basic",
            securityConfig={"jwtToken": "test-token"},
            enableVersionValidation=False,
        ),
        additional_client_config_arguments={"retry": 0, "retry_wait": 0},
    )
    sink = MetadataRestSink(MetadataRestSinkConfig(bulk_sink_batch_size=1), metadata)
    source = TaggedDatabaseSource(metadata, shared_tag=True, fail_publication=False)
    source.context = TopologyContextManager(source.topology)
    for key, value in (("database_service", "svc"), ("database", "db"), ("database_schema", "schema_a")):
        source.context.get().upsert(key, value)

    def produce():
        source.context.copy_from(source.context.main_thread)
        try:
            definitions = list(source.yield_database_schema_tag_details("schema_a"))
            assets = list(source.yield_table(("my_table", TableType.Regular)))
            return definitions + assets
        finally:
            source.context.pop()

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            records = pool.submit(produce).result(timeout=10)
        for record in records:
            sink.run(record.right)
        assert catalog.tags == {"Class.Shared"}
        assert [label["tagFQN"] for label in catalog.tables["svc.db.schema_a.my_table"].get("tags", [])] == []
        assert source.get_tag_labels("my_table") is None
        assert catalog.tag_reads == ["Class.Shared"]
        assert sink.status.failures == []
    finally:
        metadata.close()
