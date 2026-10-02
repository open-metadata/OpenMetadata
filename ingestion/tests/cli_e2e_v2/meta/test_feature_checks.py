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
"""Check generated SDK entities and graph direction, not assertion internals."""

from copy import deepcopy
from types import SimpleNamespace

import pytest

from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import ColumnProfile, Table, TableConstraint, TableProfile
from metadata.generated.schema.type.entityLineage import EntityLineage

from ..features.database.entities import (
    column_has_no_tag,
    column_has_tag,
    entity_exists,
    has_description,
    has_owner,
    has_tag,
    procedure_has_code,
    table_has_foreign_key,
    table_has_schema_definition,
    table_is_deleted,
    table_query,
)
from ..features.database.lineage import lineage_has_columns, lineage_has_edge
from ..features.database.profiles import column_has_metrics, profile_query, table_has_row_count
from ..runtime import expect
from ..runtime.expect import Query


@pytest.fixture
def table():
    return Table(
        id="00000000-0000-0000-0000-000000000001",
        name="child",
        fullyQualifiedName="svc.db.demo.child",
        columns=[{"name": "a", "dataType": "INT"}, {"name": "b", "dataType": "INT"}],
        tableConstraints=[
            {
                "constraintType": "FOREIGN_KEY",
                "columns": ["a", "b"],
                "referredColumns": ["svc.db.demo.parent.x", "svc.db.demo.parent.y"],
            }
        ],
    )


def test_composite_foreign_key_position_and_fully_qualified_identity(table):
    table_has_foreign_key(("a", "b"), ("svc.db.demo.parent.x", "svc.db.demo.parent.y"))(table)
    for wrong in [("svc.db.demo.parent.y", "svc.db.demo.parent.x"), ("svc.db.other.parent.x", "svc.db.other.parent.y")]:
        with pytest.raises(AssertionError, match="foreign key"):
            table_has_foreign_key(("a", "b"), wrong)(table)
    table.tableConstraints = [
        TableConstraint(constraintType="FOREIGN_KEY", columns=["a", "b"], referredColumns=["svc.db.demo.parent.x"])
    ]
    with pytest.raises(AssertionError, match="lengths"):
        table_has_foreign_key(("a", "b"), ("svc.db.demo.parent.x", "svc.db.demo.parent.y"))(table)


@pytest.mark.parametrize(
    "factory,args",
    [
        (table_has_foreign_key, (("a", "b"), ("svc.db.demo.parent.x",))),
        (lineage_has_columns, (("svc.db.demo.child.a",), ())),
        (column_has_metrics, ("a",)),
        (table_has_row_count, (-1,)),
        (has_description, ("",)),
        (procedure_has_code, ("",)),
    ],
)
def test_invalid_checker_options_fail_before_polling(factory, args):
    with pytest.raises(ValueError):
        factory(*args)


def test_unknown_profile_metric_fails_before_polling():
    with pytest.raises(ValueError, match="rowCounts"):
        column_has_metrics("a", rowCounts=2)


def test_short_fk_and_lineage_targets_are_invalid_options():
    with pytest.raises(ValueError, match="full FQNs"):
        table_has_foreign_key(("a",), ("parent.x",))
    with pytest.raises(ValueError, match="full FQNs"):
        lineage_has_columns(("child.a",), ("view.x",))
    with pytest.raises(ValueError, match="full FQNs"):
        lineage_has_edge("child", "view")


def test_real_table_profile_shape_converges(polling_clock, table):
    ready = table.model_copy(deep=True)
    ready.profile = TableProfile(timestamp=1, rowCount=4)
    ready.columns[0].profile = ColumnProfile(name="a", timestamp=1, valuesCount=3, nullCount=1, min=10, max=20, sum=50)
    pending = iter([table, ready])
    query = profile_query(SimpleNamespace(get_latest_table_profile=lambda fqn: next(pending)), "svc.db.demo.child")

    def check(observed):
        table_has_row_count(4)(observed)
        column_has_metrics("a", valuesCount=3, nullCount=1, min=10, max=20, sum=50)(observed)

    assert expect.poll(query).satisfies(check) is ready
    with pytest.raises(AssertionError, match="nullCount"):
        column_has_metrics("a", nullCount=0)(ready)


@pytest.mark.parametrize(
    "lower,upper,stale_count,ready_count",
    [(5, None, 4, 5), (5, 10, 4, 5), (5, 10, 11, 10)],
)
def test_custom_row_count_bounds_converge(polling_clock, table, lower, upper, stale_count, ready_count):
    stale = table.model_copy(deep=True)
    stale.profile = TableProfile(timestamp=1, rowCount=stale_count)
    ready = table.model_copy(deep=True)
    ready.profile = TableProfile(timestamp=2, rowCount=ready_count)

    def check(observed):
        entity_exists(observed)
        assert observed.profile is not None, "profile missing"
        count = observed.profile.rowCount
        assert count is not None and count >= lower, f"row count below {lower}: {count}"
        if upper is not None:
            assert count <= upper, f"row count above {upper}: {count}"

    with pytest.raises(AssertionError, match=r"row count (below|above)"):
        check(stale)
    responses = iter((stale, ready))
    query = profile_query(SimpleNamespace(get_latest_table_profile=lambda fqn: next(responses)), "svc.db.demo.child")
    assert expect.poll(query).satisfies(check) is ready


def test_missing_generated_table_is_not_an_existing_entity(polling_clock, table):
    with pytest.raises(AssertionError, match="entity missing"):
        entity_exists(None)
    responses = iter((None, table))
    query = table_query(SimpleNamespace(get_by_name=lambda **kwargs: next(responses)), "svc.db.demo.child")
    assert expect.poll(query).satisfies(entity_exists) is table


def test_missing_entity_or_column_is_not_successful_tag_exclusion(table):
    check = column_has_no_tag("a", "PII.Sensitive")
    check(table)
    with pytest.raises(AssertionError, match="entity missing"):
        check(None)
    with pytest.raises(AssertionError, match="column missing missing"):
        column_has_no_tag("missing", "PII.Sensitive")(table)


def test_metadata_checkers_observe_actual_generated_models(table):
    table = Table.model_validate(
        {
            **table.model_dump(mode="json"),
            "description": "Customer records",
            "schemaDefinition": "SELECT a FROM child",
            "deleted": False,
            "tags": [
                {"tagFQN": "PII.Sensitive", "labelType": "Manual", "state": "Confirmed", "source": "Classification"}
            ],
            "owners": [{"id": "00000000-0000-0000-0000-000000000002", "type": "user", "name": "reader"}],
        }
    )
    table.columns[0].tags = table.tags
    has_description("Customer")(table)
    has_tag("PII.Sensitive")(table)
    has_owner("reader")(table)
    column_has_tag("a", "PII.Sensitive")(table)
    table_has_schema_definition("select a")(table)
    table_is_deleted(deleted=False)(table)
    for check in (
        has_description("wrong"),
        has_tag("Wrong.Tag"),
        has_owner("missing"),
        column_has_no_tag("a", "PII.Sensitive"),
        table_is_deleted(deleted=True),
    ):
        with pytest.raises(AssertionError):
            check(table)
    procedure = StoredProcedure(
        id="00000000-0000-0000-0000-000000000003",
        name="count_rows",
        storedProcedureCode={"language": "SQL", "code": "SELECT COUNT(*) FROM child"},
    )
    procedure_has_code("COUNT(*)")(procedure)
    with pytest.raises(AssertionError):
        procedure_has_code("UPDATE")(procedure)


def test_generated_table_deleted_state_and_schema_definition_reject_wrong_observations(table):
    table.deleted = False
    table.schemaDefinition = "SELECT a FROM child"
    table_is_deleted(deleted=False)(table)
    table_has_schema_definition("select a")(table)
    with pytest.raises(AssertionError, match="expected deleted=True"):
        table_is_deleted(deleted=True)(table)
    with pytest.raises(AssertionError, match="schema definition missing"):
        table_has_schema_definition("LEFT JOIN")(table)

    table.deleted = True
    table.schemaDefinition = None
    table_is_deleted(deleted=True)(table)
    with pytest.raises(AssertionError, match="expected deleted=False"):
        table_is_deleted(deleted=False)(table)
    with pytest.raises(AssertionError, match="schema definition missing"):
        table_has_schema_definition("SELECT")(table)


@pytest.mark.parametrize(
    "code_data",
    [{"language": "SQL", "code": ""}, {"language": "SQL"}],
    ids=["empty_body", "missing_body"],
)
def test_generated_procedure_rejects_empty_or_missing_body(code_data):
    procedure = StoredProcedure(
        id="00000000-0000-0000-0000-000000000003",
        name="count_rows",
        storedProcedureCode=code_data,
    )
    with pytest.raises(AssertionError, match="procedure code missing"):
        procedure_has_code("COUNT(*)")(procedure)


@pytest.fixture
def graph():
    return {
        "entity": {"id": "2", "fullyQualifiedName": "svc.db.demo.view"},
        "nodes": [{"id": "1", "fullyQualifiedName": "svc.db.demo.child"}],
        "downstreamEdges": [],
        "upstreamEdges": [
            {
                "fromEntity": "1",
                "toEntity": "2",
                "lineageDetails": {
                    "columnsLineage": [
                        {"fromColumns": ["svc.db.demo.child.a"], "toColumn": "svc.db.demo.view.x"},
                        {"fromColumns": ["svc.db.demo.child.b"], "toColumn": "svc.db.demo.view.y"},
                    ]
                },
            }
        ],
    }


def test_lineage_checks_full_column_pairs_and_edge_direction(graph):
    lineage_has_edge("svc.db.demo.child", "svc.db.demo.view")(graph)
    check = lineage_has_columns(
        ("svc.db.demo.child.a", "svc.db.demo.child.b"), ("svc.db.demo.view.x", "svc.db.demo.view.y")
    )
    check(graph)
    with pytest.raises(AssertionError):
        lineage_has_edge("svc.db.demo.view", "svc.db.demo.child")(graph)
    with pytest.raises(AssertionError):
        lineage_has_columns(("svc.db.demo.child.a",), ("svc.db.demo.view.y",))(graph)
    with pytest.raises(AssertionError):
        lineage_has_columns(("svc.db.other.child.a",), ("svc.db.demo.view.x",))(graph)
    reversed_graph = deepcopy(graph)
    reversed_graph["upstreamEdges"][0].update(fromEntity="2", toEntity="1")
    with pytest.raises(AssertionError):
        check(reversed_graph)


@pytest.fixture
def generated_lineage():
    return EntityLineage(
        entity={
            "id": "00000000-0000-0000-0000-000000000002",
            "type": "table",
            "fullyQualifiedName": "svc.db.demo.view",
        },
        nodes=[
            {"id": "00000000-0000-0000-0000-000000000001", "type": "table", "fullyQualifiedName": "svc.db.demo.child"}
        ],
        upstreamEdges=[
            {
                "fromEntity": "00000000-0000-0000-0000-000000000001",
                "toEntity": "00000000-0000-0000-0000-000000000002",
                "lineageDetails": {
                    "columnsLineage": [{"fromColumns": ["svc.db.demo.child.a"], "toColumn": "svc.db.demo.view.x"}]
                },
            }
        ],
        downstreamEdges=[],
    )


@pytest.mark.parametrize(
    "nullable_field", ["nodes", "upstreamEdges", "downstreamEdges", "columnsLineage", "fromColumns", "toColumn"]
)
def test_schema_valid_null_lineage_converges(polling_clock, generated_lineage, nullable_field):
    pending_model = generated_lineage.model_copy(deep=True)
    if nullable_field in {"nodes", "downstreamEdges"}:
        pending_model.upstreamEdges = []
        setattr(pending_model, nullable_field, None)
    elif nullable_field == "upstreamEdges":
        pending_model.upstreamEdges = None
    elif nullable_field == "columnsLineage":
        pending_model.upstreamEdges[0].lineageDetails.columnsLineage = None
    else:
        setattr(pending_model.upstreamEdges[0].lineageDetails.columnsLineage[0], nullable_field, None)
    pending = EntityLineage.model_validate(pending_model.model_dump()).model_dump(mode="json")
    ready = generated_lineage.model_dump(mode="json")
    responses = iter([pending, ready])
    query = Query(f"lineage with nullable {nullable_field}", lambda: next(responses))
    check = lineage_has_columns(("svc.db.demo.child.a",), ("svc.db.demo.view.x",))
    assert expect.poll(query).satisfies(check) is ready


def test_ready_upstream_lineage_allows_null_downstream_edges(generated_lineage):
    generated_lineage.downstreamEdges = None
    graph = EntityLineage.model_validate(generated_lineage.model_dump()).model_dump(mode="json")
    lineage_has_edge("svc.db.demo.child", "svc.db.demo.view")(graph)
    lineage_has_columns(("svc.db.demo.child.a",), ("svc.db.demo.view.x",))(graph)
