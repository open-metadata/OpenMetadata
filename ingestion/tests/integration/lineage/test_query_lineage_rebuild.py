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
Query lineage is rebuilt once the tables a processed query connected are deleted and
ingested again, while the queries of untouched tables are not processed again.
"""

import uuid

import pytest
from tenacity import Retrying, retry_if_exception_type, stop_after_delay, wait_fixed

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import (
    QueryParserType,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.lineage import sql_lineage
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.models.topology import Queue as TopologyQueue
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.sink.metadata_rest import MetadataRestSink, MetadataRestSinkConfig
from metadata.ingestion.source.database.lineage_processors import query_lineage_processor
from metadata.utils.fqn import get_query_checksum

from ..integration_base import generate_name  # noqa: TID252

DATABASE = "analytics"
# Query checksums are unique across services, so the SQL must be unique to this run
SCHEMA = f"sales_{uuid.uuid4().hex[:8]}"
COPY_ORDERS = f"INSERT INTO {SCHEMA}.orders_copy SELECT * FROM {SCHEMA}.orders"
COPY_ITEMS = f"INSERT INTO {SCHEMA}.items_copy SELECT * FROM {SCHEMA}.items"


def _wait_until(condition) -> None:
    for attempt in Retrying(
        stop=stop_after_delay(60),
        wait=wait_fixed(0.5),
        retry=retry_if_exception_type(AssertionError),
        reraise=True,
    ):
        with attempt:
            assert condition()


@pytest.fixture(scope="module")
def service(metadata):
    service = metadata.create_or_update(
        CreateDatabaseServiceRequest(
            name=generate_name(),
            serviceType=DatabaseServiceType.Athena,
            connection=DatabaseConnection(
                config=AthenaConnection(
                    awsConfig=AWSCredentials(awsRegion="us-east-1"),
                    s3StagingDir="s3://bucket/staging/",
                    workgroup="primary",
                )
            ),
        )
    )
    metadata.create_or_update(CreateDatabaseRequest(name=DATABASE, service=service.fullyQualifiedName))
    metadata.create_or_update(
        CreateDatabaseSchemaRequest(name=SCHEMA, database=f"{model_str(service.fullyQualifiedName)}.{DATABASE}")
    )

    yield service

    metadata.delete(entity=DatabaseService, entity_id=service.id, recursive=True, hard_delete=True)


def _ingest_table(metadata, service, name: str) -> Table:
    table = metadata.create_or_update(
        CreateTableRequest(
            name=name,
            databaseSchema=f"{model_str(service.fullyQualifiedName)}.{DATABASE}.{SCHEMA}",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )
    )
    _wait_until(lambda: metadata.es_get_indexed_ids(Table, [model_str(table.id)]))
    return table


def _run_query_lineage(service_name: str) -> list:
    """One lineage run over the query log: the shared processor feeding the REST sink"""
    # Each workflow run is a new process, so it starts without any resolved tables
    sql_lineage.search_cache.clear()
    metadata = int_admin_ometa()
    queue = TopologyQueue()
    query_lineage_processor(
        table_queries=[
            TableQuery(query=query, serviceName=service_name, databaseName=DATABASE, databaseSchema=SCHEMA)
            for query in (COPY_ORDERS, COPY_ITEMS)
        ],
        queue=queue,
        metadata=metadata,
        dialect=Dialect.ATHENA,
        graph=None,
        processCrossDatabaseLineage=False,
        crossDatabaseServiceNames=[],
        parsingTimeoutLimit=60,
        serviceName=service_name,
        parser_type=QueryParserType.Auto,
    )
    records = [either.right for either in queue.process() if either.right is not None]
    sink = MetadataRestSink(MetadataRestSinkConfig(), metadata)
    for record in records:
        sink.run(record)
    sink.close()
    return records


def _processed_queries(records: list) -> list[str]:
    return [model_str(record.query) for record in records if isinstance(record, CreateQueryRequest)]


def _upstream_ids(metadata, table: Table) -> set[str]:
    lineage = metadata.get_lineage_by_name(
        entity=Table, fqn=model_str(table.fullyQualifiedName), up_depth=1, down_depth=0
    )
    return {edge["fromEntity"] for edge in lineage["upstreamEdges"]}


def _recorded_tables(metadata, service_name: str, query: str) -> set[str] | None:
    checksum = get_query_checksum(query)
    return metadata.es_get_lineage_processed_queries(service_name, [checksum]).get(checksum)


def _ids(*tables: Table) -> set[str]:
    return {model_str(table.id) for table in tables}


def test_query_lineage_is_rebuilt_after_its_tables_are_ingested_again(metadata, service):
    service_name = model_str(service.name)
    tables = {name: _ingest_table(metadata, service, name) for name in ("orders", "orders_copy", "items", "items_copy")}

    first_run = _run_query_lineage(service_name)

    assert sorted(_processed_queries(first_run)) == sorted([COPY_ORDERS, COPY_ITEMS])
    assert _upstream_ids(metadata, tables["orders_copy"]) == _ids(tables["orders"])
    assert _upstream_ids(metadata, tables["items_copy"]) == _ids(tables["items"])
    _wait_until(
        lambda: _recorded_tables(metadata, service_name, COPY_ORDERS) == _ids(tables["orders"], tables["orders_copy"])
    )
    _wait_until(
        lambda: _recorded_tables(metadata, service_name, COPY_ITEMS) == _ids(tables["items"], tables["items_copy"])
    )

    for name in ("orders", "orders_copy"):
        metadata.delete(entity=Table, entity_id=tables[name].id, hard_delete=True)
        tables[name] = _ingest_table(metadata, service, name)

    assert _upstream_ids(metadata, tables["orders_copy"]) == set()

    second_run = _run_query_lineage(service_name)

    assert _processed_queries(second_run) == [COPY_ORDERS]
    assert _upstream_ids(metadata, tables["orders_copy"]) == _ids(tables["orders"])
    assert _upstream_ids(metadata, tables["items_copy"]) == _ids(tables["items"])
    _wait_until(
        lambda: _recorded_tables(metadata, service_name, COPY_ORDERS) == _ids(tables["orders"], tables["orders_copy"])
    )

    assert _run_query_lineage(service_name) == []
