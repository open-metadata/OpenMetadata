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
"""Timescale continuous aggregate discovery respects lineage scope."""

import re
import uuid
from queue import Queue
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.timescaleConnection import TimescaleConnection
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.api.status import Status
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.ingestion.source.database.lineage_processors import view_lineage_processor
from metadata.ingestion.source.database.timescale.lineage import TimescaleLineageSource
from metadata.ingestion.source.models import TableView


@pytest.fixture
def lineage_source():
    # Discovery needs no connection setup; SQL and catalog access are the boundaries.
    source = TimescaleLineageSource.__new__(TimescaleLineageSource)
    source.config = SimpleNamespace(serviceName="svc")
    source.service_connection = TimescaleConnection(username="user", hostPort="localhost:5432", database="db")
    source.source_config = DatabaseServiceQueryLineagePipeline()
    source.status = Status()
    source.timescaledb_installed = True
    source.metadata = MagicMock()
    source.engine = MagicMock()
    return source


@pytest.mark.parametrize("dimension", ["database", "schema", "table"])
@pytest.mark.parametrize(
    "names",
    [
        ("db", "public", "daily"),
        ("db.prod", "schema.one", "daily.orders"),
        ('"db.prod"', '"schema.one"', '"daily.orders"'),
    ],
)
@pytest.mark.parametrize("pattern_kind", ["excludes", "includes"])
@pytest.mark.parametrize("excluded", [False, True])
def test_direct_aggregates_follow_catalog_lineage_filters(lineage_source, dimension, names, pattern_kind, excluded):
    source = lineage_source
    database, schema, table = names
    source.service_connection.database = database
    match = names[["database", "schema", "table"].index(dimension)].strip('"')
    pattern = "^" + re.escape(match) + "$"
    should_match = excluded if pattern_kind == "excludes" else not excluded
    setattr(
        source.source_config,
        f"{dimension}FilterPattern",
        FilterPattern.model_validate({pattern_kind: [pattern if should_match else "^other$"]}),
    )
    catalog = TableView(
        db_name=database, schema_name=schema, table_name=table, view_definition="SELECT id FROM catalog_src"
    )
    aggregate = TableView(
        db_name=database, schema_name=schema, table_name=table, view_definition="SELECT id FROM sensor_data"
    )
    source.metadata.yield_es_view_def.return_value = iter([catalog])
    source.engine.connect.return_value.__enter__.return_value.execute.return_value.all.return_value = [
        SimpleNamespace(view_schema=schema, view_name=table, view_definition=aggregate.view_definition)
    ]

    views = list(source.view_lineage_producer())

    assert views == ([] if excluded else [catalog, aggregate])
    assert source.status.filtered == ([{table: "View Filtered Out"}] * 2 if excluded else [])


def test_parent_catalog_views_remain_when_timescale_extension_is_absent(lineage_source):
    source = lineage_source
    source.timescaledb_installed = False
    catalog = TableView(db_name="db", schema_name="public", table_name="ordinary", view_definition="SELECT id FROM src")
    source.metadata.yield_es_view_def.return_value = iter([catalog])

    assert list(source.view_lineage_producer()) == [catalog]
    assert source.status.filtered == []
    source.engine.connect.assert_not_called()


def test_excluded_aggregate_never_reaches_processor_but_in_scope_missing_view_fails(lineage_source):
    source = lineage_source
    source.source_config.tableFilterPattern = FilterPattern(excludes=["^excluded$"])
    source.metadata.yield_es_view_def.return_value = iter([])
    source.engine.connect.return_value.__enter__.return_value.execute.return_value.all.return_value = [
        SimpleNamespace(view_schema="public", view_name=name, view_definition="SELECT id FROM src")
        for name in ("excluded", "missing", "daily")
    ]
    entities = {
        name: Table(
            id=uuid.uuid4(),
            name=name,
            fullyQualifiedName=f"svc.db.public.{name}",
            columns=[Column(name="id", dataType=DataType.INT, fullyQualifiedName=f"svc.db.public.{name}.id")],
        )
        for name in ("src", "daily")
    }
    source.metadata.get_by_name.side_effect = lambda entity, fqn, **_: entities.get(fqn.split(".")[-1])
    source.metadata.es_search_from_fqn.side_effect = lambda entity_type, fqn_search_string, **_: (
        [entities["src"]] if fqn_search_string.endswith(".src") else []
    )
    queue = Queue()
    search_cache.clear()
    try:
        view_lineage_processor(
            views=list(source.view_lineage_producer()),
            queue=queue,
            metadata=source.metadata,
            service_name="svc",
            connectionType="Timescale",
            processCrossDatabaseLineage=False,
            crossDatabaseServiceNames=[],
            parsingTimeoutLimit=10,
            overrideViewLineage=False,
            parser_type="Auto",
        )
        failure, success = list(queue.queue)
        assert failure.right is None
        assert failure.left.name == "svc.db.public.missing"
        assert "View entity not found in the catalog" in failure.left.error
        assert success.left is None
        edge = success.right.lineage_request
        assert (edge.from_entity_fqn, edge.to_entity_fqn) == ("svc.db.public.src", "svc.db.public.daily")
        assert source.status.filtered == [{"excluded": "View Filtered Out"}]
    finally:
        search_cache.clear()
