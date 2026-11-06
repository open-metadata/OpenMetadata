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

"""
Column lineage through STRUCT and ARRAY<STRUCT> columns in BigQuery views.

The view SQL is parsed for real; only the table lookup is stubbed, so these tests
cover the parser output and the column resolution together.
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query

SERVICE = "bq"
SCHEMA_FQN = f"{SERVICE}.proj.ds"


def _column(table: str, path: str, data_type: str = "STRING", children: list | None = None) -> dict:
    column = {
        "name": path.rsplit(".", 1)[-1],
        "dataType": data_type,
        "fullyQualifiedName": f"{SCHEMA_FQN}.{table}.{path}",
    }
    if children is not None:
        column["children"] = children
    return column


def _table(name: str, columns: list[dict]) -> Table:
    return Table(id=uuid.uuid4(), name=name, fullyQualifiedName=f"{SCHEMA_FQN}.{name}", columns=columns)


def _customer(table: str, prefix: str = "customer") -> dict:
    return _column(
        table,
        prefix,
        "STRUCT",
        [
            _column(table, f"{prefix}.email"),
            _column(
                table,
                f"{prefix}.address",
                "STRUCT",
                [_column(table, f"{prefix}.address.zip"), _column(table, f"{prefix}.address.city")],
            ),
        ],
    )


def _events(table: str) -> dict:
    return _column(table, "events", "ARRAY", [_column(table, "events.ip")])


USERS = _table("users", [_column("users", "id", "INT"), _customer("users"), _events("users")])


def _column_edges(query: str, tables: list[Table], dialect: Dialect = Dialect.BIGQUERY) -> set[tuple[str, str]]:
    by_name = {table.name.root: table for table in tables}

    def lookup(table_name: str, **_) -> list[Table] | None:
        table = by_name.get(table_name.rsplit(".", maxsplit=1)[-1])
        return [table] if table else None

    with patch(
        "metadata.ingestion.lineage.sql_lineage.get_table_entities_from_query",
        side_effect=lookup,
    ):
        results = list(
            get_lineage_by_query(
                MagicMock(),
                service_names=SERVICE,
                database_name="proj",
                schema_name="ds",
                query=query,
                dialect=dialect,
            )
        )

    edges = set()
    for result in results:
        assert result.right is not None, result.left
        details = result.right.lineage_details
        for column_lineage in details.columnsLineage or []:
            prefix = f"{SCHEMA_FQN}."
            edges.update(
                (from_col.root.removeprefix(prefix), column_lineage.toColumn.root.removeprefix(prefix))
                for from_col in column_lineage.fromColumns
            )
    return edges


def test_struct_selected_as_is_maps_every_nested_field():
    view = _table("v", [_column("v", "id", "INT"), _customer("v"), _events("v")])

    edges = _column_edges("CREATE VIEW ds.v AS SELECT id, customer, events FROM `proj.ds.users`", [USERS, view])

    assert edges == {
        ("users.id", "v.id"),
        ("users.customer", "v.customer"),
        ("users.customer.email", "v.customer.email"),
        ("users.customer.address", "v.customer.address"),
        ("users.customer.address.zip", "v.customer.address.zip"),
        ("users.customer.address.city", "v.customer.address.city"),
        ("users.events", "v.events"),
        ("users.events.ip", "v.events.ip"),
    }


@pytest.mark.parametrize(
    "select",
    ["id, customer.*", "u.id, u.customer.*"],
    ids=["unqualified", "aliased"],
)
def test_struct_star_expansion_maps_each_field_to_its_view_column(select):
    view = _table(
        "v",
        [
            _column("v", "id", "INT"),
            _column("v", "email"),
            _column("v", "address", "STRUCT", [_column("v", "address.zip"), _column("v", "address.city")]),
        ],
    )

    edges = _column_edges(f"CREATE VIEW ds.v AS SELECT {select} FROM `proj.ds.users` AS u", [USERS, view])

    assert edges == {
        ("users.id", "v.id"),
        ("users.customer.email", "v.email"),
        ("users.customer.address", "v.address"),
        ("users.customer.address.zip", "v.address.zip"),
        ("users.customer.address.city", "v.address.city"),
    }


def test_struct_field_selected_by_path_maps_to_its_alias():
    view = _table("v", [_column("v", "customer_email"), _column("v", "zip")])

    edges = _column_edges(
        "CREATE VIEW ds.v AS SELECT customer.email AS customer_email, customer.address.zip AS zip FROM `proj.ds.users`",
        [USERS, view],
    )

    assert edges == {
        ("users.customer.email", "v.customer_email"),
        ("users.customer.address.zip", "v.zip"),
    }


@pytest.mark.parametrize(
    "dialect",
    [Dialect.DATABRICKS, Dialect.SPARKSQL, Dialect.HIVE, Dialect.TRINO, Dialect.ATHENA, Dialect.SNOWFLAKE],
)
def test_nested_fields_resolve_in_other_dialects_with_struct_columns(dialect):
    view = _table(
        "v", [_column("v", "customer_email"), _column("v", "address", "STRUCT", [_column("v", "address.zip")])]
    )

    edges = _column_edges(
        "CREATE VIEW ds.v AS SELECT customer.email AS customer_email, customer.address AS address FROM ds.users",
        [USERS, view],
        dialect,
    )

    assert edges == {
        ("users.customer.email", "v.customer_email"),
        ("users.customer.address", "v.address"),
        ("users.customer.address.zip", "v.address.zip"),
    }


def test_unqualified_table_name_stays_a_table_next_to_a_struct_path():
    orders = _table(
        "orders",
        [
            _column("orders", "id", "INT"),
            _column("orders", "orders", "STRUCT", [_column("orders", "orders.total", "INT")]),
            _customer("orders"),
        ],
    )
    view = _table("v", [_column("v", "order_id", "INT"), _column("v", "e")])

    edges = _column_edges(
        "CREATE VIEW ds.v AS SELECT orders.id AS order_id, customer.email AS e FROM orders",
        [orders, view],
    )

    assert edges == {("orders.id", "v.order_id"), ("orders.customer.email", "v.e")}


def test_field_path_through_a_struct_name_used_twice_gets_no_lineage():
    def address(table: str, path: str) -> dict:
        return _column(table, path, "STRUCT", [_column(table, f"{path}.zip")])

    accounts = _table(
        "accounts",
        [
            _column("accounts", "billing", "STRUCT", [address("accounts", "billing.address")]),
            _column("accounts", "shipping", "STRUCT", [address("accounts", "shipping.address")]),
        ],
    )
    view = _table("v", [_column("v", "zip")])

    edges = _column_edges("CREATE VIEW ds.v AS SELECT billing.address.zip AS zip FROM ds.accounts", [accounts, view])

    assert edges == set()


def test_field_path_skips_a_same_named_column_that_is_not_a_struct():
    profiles = _table("profiles", [_column("profiles", "address"), _customer("profiles")])
    view = _table("v", [_column("v", "zip")])

    edges = _column_edges("CREATE VIEW ds.v AS SELECT customer.address.zip AS zip FROM ds.profiles", [profiles, view])

    assert edges == {("profiles.customer.address.zip", "v.zip")}


@pytest.mark.parametrize(
    "query",
    [
        "CREATE VIEW ds.v AS SELECT id, customer.email AS e FROM (SELECT id, billing AS customer FROM ds.users) s",
        "CREATE VIEW ds.v AS SELECT s.id, s.customer.email AS e FROM (SELECT id, billing AS customer FROM ds.users) s",
        "CREATE VIEW ds.v AS WITH c AS (SELECT id, billing AS customer FROM ds.users) SELECT id, customer.email AS e FROM c",
    ],
    ids=["subquery", "qualified-subquery", "cte"],
)
def test_struct_name_a_subquery_could_define_gets_no_lineage(query):
    users = _table("users", [_column("users", "id", "INT"), _customer("users"), _customer("users", "billing")])
    view = _table("v", [_column("v", "id", "INT"), _column("v", "e")])

    assert _column_edges(query, [users, view]) == {("users.id", "v.id")}


def test_struct_path_in_a_multi_statement_query_gets_no_lineage():
    inter = _table("inter", [_column("inter", "id", "INT"), _customer("inter")])
    target = _table("tgt", [_column("tgt", "e")])

    edges = _column_edges(
        "INSERT INTO ds.inter SELECT * FROM ds.users; "
        "INSERT INTO ds.tgt SELECT customer.email AS e FROM ds.inter JOIN ds.users ON inter.id = users.id",
        [USERS, inter, target],
    )

    assert ("users.customer.email", "inter.customer.email") in edges
    assert not {edge for edge in edges if edge[1] == "tgt.e"}


def test_join_gives_struct_paths_no_lineage_rather_than_the_wrong_table():
    orders = _table(
        "orders",
        [_column("orders", "id", "INT"), _column("orders", "x", "STRUCT", [_customer("orders", "x.customer")])],
    )
    view = _table("v", [_customer("v"), _column("v", "e")])

    edges = _column_edges(
        "CREATE VIEW ds.v AS SELECT users.customer AS customer, customer.email AS e "
        "FROM ds.users JOIN ds.orders ON users.id = orders.id",
        [USERS, orders, view],
    )

    assert edges == {
        ("users.customer", "v.customer"),
        ("users.customer.email", "v.customer.email"),
        ("users.customer.address", "v.customer.address"),
        ("users.customer.address.zip", "v.customer.address.zip"),
        ("users.customer.address.city", "v.customer.address.city"),
    }


def test_a_query_whose_subqueries_cannot_be_read_counts_as_having_them():
    unparsed = LineageParser("SELECT id FROM ds.users", Dialect.BIGQUERY)
    unparsed.parser = None
    unreadable = LineageParser("SELECT id FROM ds.users", Dialect.BIGQUERY)
    unreadable.parser._sql_holder = None

    assert unparsed.has_subqueries
    assert unreadable.has_subqueries
    assert not LineageParser("SELECT id FROM ds.users", Dialect.BIGQUERY).has_subqueries
