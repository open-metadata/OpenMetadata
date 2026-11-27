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
"""Unit tests for the Alation Sink source run loop."""

import uuid
from unittest.mock import MagicMock

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.metadata.alationSinkConnection import (
    AlationSinkConnection,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.metadata.alationsink.metadata import AlationsinkSource
from metadata.ingestion.source.metadata.alationsink.models import CreateColumnRequestList


def _ref(name: str, entity_type: str) -> EntityReference:
    return EntityReference(id=uuid.uuid4(), type=entity_type, name=name)


def _table(name: str) -> Table:
    return Table(
        id=uuid.uuid4(),
        name=name,
        fullyQualifiedName=f"svc.db.sch.{name}",
        columns=[Column(name="col", dataType=DataType.STRING)],
        databaseSchema=_ref("sch", "databaseSchema"),
    )


def _source(rejected_table: str | None = None) -> AlationsinkSource:
    """Source wired to one database, one schema and two tables, with Alation mocked out"""
    source = AlationsinkSource.__new__(AlationsinkSource)
    super(AlationsinkSource, source).__init__()
    source.service_connection = AlationSinkConnection(
        hostPort="http://alation",
        authType={"accessToken": "token"},
        datasourceLinks={"39": "svc.db"},
    )
    source.source_config = DatabaseServiceMetadataPipeline()
    source._connection = None

    schema = DatabaseSchema(
        id=uuid.uuid4(),
        name="sch",
        fullyQualifiedName="svc.db.sch",
        database=_ref("db", "database"),
        service=_ref("svc", "databaseService"),
    )
    tables = [_table("narrow"), _table("wide")]
    source.metadata = MagicMock()
    source.metadata.get_by_name.return_value = Database(
        id=uuid.uuid4(), name="db", fullyQualifiedName="svc.db", service=_ref("svc", "databaseService")
    )
    source.metadata.list_all_entities.side_effect = lambda entity, **_: iter(
        [schema] if entity is DatabaseSchema else tables
    )

    def write_entities(_ds_id, create_requests):
        is_rejected = isinstance(create_requests, CreateColumnRequestList) and any(
            request.key.endswith(f".{rejected_table}.col") for request in create_requests.root
        )
        return ["Alation job [1]: column rejected"] if is_rejected else []

    source.alation_sink_client = MagicMock()
    source.alation_sink_client.write_entities.side_effect = write_entities
    return source


def test_run_completes_without_unhandled_failure():
    source = _source()

    assert list(source.run()) == []
    assert source.status.failures == []
    # schemas, tables, then the columns of each table
    assert source.alation_sink_client.write_entities.call_count == 4


def test_rejected_column_write_is_recorded_as_failure():
    source = _source(rejected_table="wide")

    list(source.run())

    assert [failure.name for failure in source.status.failures] == ["table [wide]"]
    assert "column rejected" in source.status.failures[0].error
    assert source.alation_sink_client.write_entities.call_count == 4


def test_filtered_table_is_counted_once_and_gets_no_column_write():
    source = _source()
    source.source_config = DatabaseServiceMetadataPipeline(tableFilterPattern={"excludes": ["wide"]})

    list(source.run())

    assert source.status.filtered == [{"wide": "Table Filtered Out"}]
    column_writes = [
        call.args[1]
        for call in source.alation_sink_client.write_entities.call_args_list
        if isinstance(call.args[1], CreateColumnRequestList)
    ]
    assert [request.key for writes in column_writes for request in writes.root] == ["39.sch.narrow.col"]
