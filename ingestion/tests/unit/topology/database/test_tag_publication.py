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
"""Concurrent database tag publication through the topology, queue and REST sink."""

import json
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from urllib.parse import urlsplit
from uuid import UUID

import pytest
from requests import Response

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


class CatalogHTTP:
    def __init__(self):
        self.tags = set()
        self.tables = {}

    def request(self, method, url, **kwargs):
        path = urlsplit(url).path
        status = 200
        payload = kwargs.get("json")
        if payload is None and kwargs.get("data"):
            payload = json.loads(kwargs["data"])

        if method.upper() == "GET" and path.endswith("/search/fieldQuery"):
            body = {"hits": {"hits": [], "total": {"value": 0}}}
        elif path.endswith("/classifications"):
            body = {**payload, "id": str(UUID(int=1))}
        elif path.endswith("/tags"):
            self.tags.add(f"{payload['classification']}.{payload['name']}")
            body = {
                **payload,
                "id": str(UUID(int=2)),
                "classification": {"id": str(UUID(int=1)), "type": "classification", "name": payload["classification"]},
            }
        elif path.endswith("/bulk"):
            missing = {label["tagFQN"] for entity in payload for label in entity.get("tags", [])} - self.tags
            if missing:
                status, body = 400, {"message": f"Unknown tags: {sorted(missing)}"}
            else:
                if path.endswith("/tables/bulk"):
                    for table in payload:
                        self.tables[f"{table['databaseSchema']}.{table['name']}"] = table
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
        self.second_table_queued = Event()
        self.fail_publication = fail_publication

    def put(self, record):
        if isinstance(record.right, OMetaTagAndClassification) and not self.publication_paused.is_set():
            self.publication_paused.set()
            assert self.release_publication.wait(timeout=10)
            if self.fail_publication:
                raise RuntimeError("publication failed")
        super().put(record)
        if isinstance(record.right, CreateTableRequest) and record.right.databaseSchema.root.endswith("schema_b"):
            self.second_table_queued.set()


class TaggedDatabaseSource(MysqlSource):
    def __init__(self, metadata, shared_tag, fail_publication):
        self.metadata = metadata
        self.source_config = DatabaseServiceMetadataPipeline(includeTags=True)
        self.status = Status()
        self.topology = DatabaseServiceTopology()
        self.topology.databaseSchema.children = ["table"]
        self.topology.databaseSchema.post_process = []
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


@pytest.mark.parametrize("shared_tag", [False, True])
@pytest.mark.parametrize("fail_publication", [False, True])
def test_parallel_schema_tables_reach_sink_after_their_definitions(monkeypatch, shared_tag, fail_publication):
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
                # Let the competing worker reach its drain while the first definition is still unpublished.
                source.queue.second_table_queued.wait(timeout=0.2)
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
        assert {
            fqn: [label["tagFQN"] for label in table["tags"]] for fqn, table in catalog.tables.items()
        } == expected_tables
        assert catalog.tags == set(expected)
        assert source.tags_registry.stats()["pending"] == source.tags_registry.stats()["active_scopes"] == 0
        assert len(source.context.contexts) == 1
    finally:
        metadata.close()
