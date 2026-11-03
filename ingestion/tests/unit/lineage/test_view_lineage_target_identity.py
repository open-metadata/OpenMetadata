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
"""View lineage for a view whose definition only reads (no target table in the query)."""

import uuid
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import get_lineage_via_table_entity
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.db_utils import get_view_lineage


def _table(table_fqn: str) -> Table:
    return Table(
        id=uuid.uuid4(),
        name=fqn.split(table_fqn)[-1].strip('"'),
        fullyQualifiedName=table_fqn,
        columns=[Column(name="id", dataType=DataType.INT)],
        serviceType=DatabaseServiceType.Mssql,
    )


@pytest.mark.parametrize(
    ("view", "view_fqn", "lookalike_fqn"),
    [
        (
            TableView(db_name="db", schema_name="dbo.reporting", table_name="orders"),
            'svc.db."dbo.reporting".orders',
            "svc.dbo.reporting.orders",
        ),
        (
            TableView(db_name="db", schema_name="reporting", table_name="warehouse.orders"),
            'svc.db.reporting."warehouse.orders"',
            "svc.reporting.warehouse.orders",
        ),
    ],
)
def test_select_only_view_lineage_targets_the_view(view, view_fqn, lookalike_fqn):
    """The edge goes to the view that was looked up, not to a table whose name looks the same once the dots are joined."""
    view = view.model_copy(update={"view_definition": "SELECT * FROM src"})
    view_entity = _table(view_fqn)
    source = _table("svc.db.reporting.src")
    lookalike = _table(lookalike_fqn)

    metadata = MagicMock()
    metadata.get_by_name.side_effect = lambda entity, fqn, **_: view_entity if fqn == view_fqn else None

    def es_search_from_fqn(entity_type, fqn_search_string, **_):
        found = {view_fqn: [view_entity], lookalike_fqn: [lookalike]}
        if fqn_search_string.endswith(".src"):
            return [source]
        return found.get(fqn_search_string, [])

    metadata.es_search_from_fqn.side_effect = es_search_from_fqn

    results = list(
        get_view_lineage(
            view=view,
            metadata=metadata,
            service_names="svc",
            connection_type="Mssql",
            timeout_seconds=10,
            parser_type="Auto",
        )
    )

    edges = [(result.right.from_entity_fqn, result.right.to_entity_fqn) for result in results if result.right]
    assert edges == [("svc.db.reporting.src", view_fqn)]


def test_table_entity_lineage_uses_the_given_entity_as_target():
    """`get_lineage_via_table_entity` does not resolve its target again by name."""
    view_entity = _table('svc.db."dbo.reporting".orders')
    source = _table("svc.db.reporting.src")
    metadata = MagicMock()
    metadata.es_search_from_fqn.side_effect = lambda entity_type, fqn_search_string, **_: (
        [source] if fqn_search_string.endswith(".src") else []
    )
    query = "SELECT * FROM src"

    results = list(
        get_lineage_via_table_entity(
            metadata,
            table_entity=view_entity,
            database_name="db",
            schema_name="dbo.reporting",
            service_names="svc",
            query=query,
            dialect=Dialect.TSQL,
            lineage_parser=LineageParser(query, Dialect.TSQL),
        )
    )

    (result,) = results
    assert result.right.to_entity_fqn == 'svc.db."dbo.reporting".orders'
