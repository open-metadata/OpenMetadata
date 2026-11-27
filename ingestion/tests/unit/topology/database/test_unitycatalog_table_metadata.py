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
"""Unity Catalog column constraints, foreign keys and metric view definitions."""

import json
import logging
from threading import RLock
from unittest.mock import Mock
from uuid import uuid4

from databricks.sdk.service.catalog import ColumnInfo, TableInfo

from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    ConstraintType,
    DataType,
    Table,
    TableConstraint,
    TableType,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.patch_request import build_patch
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource
from metadata.ingestion.source.database.unitycatalog.models import ForeignConstrains

CHILD_FQN = "svc.demo.sales.fk_child"
PARENT_FQN = "svc.demo.ref.fk_parent"
FOREIGN_KEY = ForeignConstrains(
    child_columns=["parent_id"], parent_columns=["parent_id"], parent_table="demo.ref.fk_parent"
)
RESOLVED_FOREIGN_KEY = TableConstraint(
    constraintType=ConstraintType.FOREIGN_KEY,
    columns=["parent_id"],
    referredColumns=[FullyQualifiedEntityName(f"{PARENT_FQN}.parent_id")],
)
PRIMARY_KEY = TableConstraint(constraintType=ConstraintType.PRIMARY_KEY, columns=["child_id"])


def _column(name: str, nullable: bool) -> ColumnInfo:
    return ColumnInfo(
        name=name,
        type_text="int",
        type_json=json.dumps({"name": name, "type": "integer", "nullable": nullable, "metadata": {}}),
        position=0,
        nullable=nullable,
    )


def test_not_null_columns_carry_the_not_null_constraint():
    source = Mock()
    source.get_column_tag_labels.return_value = None
    columns = UnitycatalogSource.get_columns(source, "customers", [_column("id", False), _column("email", True)])
    assert [(column.name.root, column.constraint) for column in columns] == [
        ("id", Constraint.NOT_NULL),
        ("email", None),
    ]


def _stored(tables: dict, fqn: str, fields: list | None = None):
    """What OpenMetadata returns for ``fqn``. As on the server, a table's
    tableConstraints come back only when the caller asks for them."""
    entity = tables.get(fqn)
    if isinstance(entity, Table) and "tableConstraints" not in (fields or []):
        return entity.model_copy(update={"tableConstraints": None})
    return entity


def _foreign_key_source(tables: dict) -> Mock:
    """``tables`` stands for what OpenMetadata holds: a test adds to it to write a table."""
    source = Mock()
    source._state_lock = RLock()
    source.deferred_foreign_keys = []
    source.context.get().database_service = "svc"
    source.context.get().database = "demo"
    source.context.get().database_schema = "sales"
    source.normalize_table_constraints = UnitycatalogSource.normalize_table_constraints
    source.metadata.es_search_from_fqn.return_value = []
    source.metadata.get_by_name.side_effect = lambda entity, fqn, fields=None: _stored(tables, fqn, fields)
    return source


def _child_table() -> Table:
    # Unity Catalog column positions start at 0.
    return Table(
        id=uuid4(),
        name="fk_child",
        fullyQualifiedName=CHILD_FQN,
        columns=[
            Column(name="child_id", dataType=DataType.INT, ordinalPosition=0),
            Column(name="parent_id", dataType=DataType.INT, ordinalPosition=1),
        ],
        tableConstraints=[PRIMARY_KEY],
    )


def _patches(source: Mock) -> list[tuple[Table, Table]]:
    """(stored table, patched table) for each PATCH sent to OpenMetadata."""
    return [(call.kwargs["source"], call.kwargs["destination"]) for call in source.metadata.patch.call_args_list]


def test_foreign_key_to_an_ingested_table_stays_on_the_table():
    source = _foreign_key_source({PARENT_FQN: Mock()})
    assert UnitycatalogSource._get_foreign_constraints(source, [FOREIGN_KEY], "fk_child") == [RESOLVED_FOREIGN_KEY]
    assert list(UnitycatalogSource.yield_table_constraints(source)) == []


def test_foreign_key_to_a_table_written_later_in_the_run_is_patched_after_the_flush():
    # The parent sits in a schema the walk reaches later, so it is not in OpenMetadata
    # when fk_child is written.
    tables = {}
    source = _foreign_key_source(tables)
    assert UnitycatalogSource._get_foreign_constraints(source, [FOREIGN_KEY], "fk_child") == []

    results = UnitycatalogSource.yield_table_constraints(source)
    assert isinstance(next(results).right, Barrier)
    # Both tables still sit in the sink's bulk buffer until that flush runs.
    child = _child_table()
    tables.update({PARENT_FQN: Mock(), CHILD_FQN: child})
    assert list(results) == []

    [(stored, patched)] = _patches(source)
    assert stored == child
    assert patched.tableConstraints == [PRIMARY_KEY, RESOLVED_FOREIGN_KEY]
    # The JSON patch the client builds from those same arguments changes only the
    # constraints: the 0-based column positions are not renumbered.
    patch_args = {
        k: v for k, v in source.metadata.patch.call_args.kwargs.items() if k not in ("entity", "skip_on_failure")
    }
    assert {op["path"].split("/")[1] for op in build_patch(**patch_args).patch} == {"tableConstraints"}


def test_one_failed_lookup_does_not_stop_the_other_tables_foreign_keys():
    flaky_key = ForeignConstrains(child_columns=["flaky_id"], parent_columns=["id"], parent_table="demo.ref.flaky")
    tables = {}
    source = _foreign_key_source(tables)
    UnitycatalogSource._get_foreign_constraints(source, [flaky_key], "orders")
    UnitycatalogSource._get_foreign_constraints(source, [FOREIGN_KEY], "never_written")
    UnitycatalogSource._get_foreign_constraints(source, [FOREIGN_KEY], "fk_child")
    child = _child_table()
    tables.update({PARENT_FQN: Mock(), CHILD_FQN: child})

    def get_by_name(entity, fqn, fields=None):
        if fqn == "svc.demo.ref.flaky":
            raise RuntimeError("server unavailable")
        return _stored(tables, fqn, fields)

    source.metadata.get_by_name.side_effect = get_by_name
    _, failure = list(UnitycatalogSource.yield_table_constraints(source))

    assert "svc.demo.sales.orders" in failure.left.error
    assert "server unavailable" in failure.left.error
    [(_, patched)] = _patches(source)
    assert patched.tableConstraints == [PRIMARY_KEY, RESOLVED_FOREIGN_KEY]


def test_a_held_foreign_key_takes_the_column_names_as_ingested():
    # Inline keys go through normalize_table_constraints in yield_table; a held key
    # must too, or a casing difference makes the server reject the PATCH.
    mixed_case_key = ForeignConstrains(
        child_columns=["Parent_Id"], parent_columns=["parent_id"], parent_table="demo.ref.fk_parent"
    )
    tables = {}
    source = _foreign_key_source(tables)
    UnitycatalogSource._get_foreign_constraints(source, [mixed_case_key], "fk_child")
    tables.update({PARENT_FQN: Mock(), CHILD_FQN: _child_table()})

    list(UnitycatalogSource.yield_table_constraints(source))

    [(_, patched)] = _patches(source)
    assert patched.tableConstraints == [PRIMARY_KEY, RESOLVED_FOREIGN_KEY]


def test_a_failed_patch_is_reported_as_a_failure():
    tables = {}
    source = _foreign_key_source(tables)
    UnitycatalogSource._get_foreign_constraints(source, [FOREIGN_KEY], "fk_child")
    tables.update({PARENT_FQN: Mock(), CHILD_FQN: _child_table()})
    source.metadata.patch.side_effect = RuntimeError("Failed to update Table: 400")

    _, failure = list(UnitycatalogSource.yield_table_constraints(source))

    assert "Failed to update Table: 400" in failure.left.error


def test_foreign_key_to_a_table_never_ingested_is_logged_and_dropped(caplog):
    source = _foreign_key_source({CHILD_FQN: _child_table()})
    UnitycatalogSource._get_foreign_constraints(source, [FOREIGN_KEY], "fk_child")
    with caplog.at_level(logging.WARNING):
        results = list(UnitycatalogSource.yield_table_constraints(source))
    assert [type(result.right) for result in results] == [Barrier]
    assert _patches(source) == []
    assert CHILD_FQN in caplog.text
    assert PARENT_FQN in caplog.text


def test_metric_view_definition_is_its_create_view_with_metrics_statement():
    yaml_body = "version: 1.1\nsource: demo.sales.orders\nmeasures:\n  - name: total\n    expr: SUM(amount)"
    table = TableInfo.from_dict(
        {
            "catalog_name": "demo",
            "schema_name": "sales",
            "name": "orders_metrics",
            "table_type": "METRIC_VIEW",
            "view_definition": yaml_body,
        }
    )
    definition = UnitycatalogSource.get_schema_definition(Mock(), "orders_metrics", TableType.View, table)
    assert (
        definition == f"CREATE VIEW `demo`.`sales`.`orders_metrics` WITH METRICS LANGUAGE YAML AS $$\n{yaml_body}\n$$"
    )
