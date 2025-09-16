from unittest.mock import MagicMock, Mock

import pytest

from metadata.profiler.metrics.system.snowflake.system import (
    PUBLIC_SCHEMA,
    SnowflakeTableResovler,
)
from metadata.utils.profiler_utils import get_identifiers_from_string


@pytest.mark.parametrize(
    "schema_name",
    ["test_schema", PUBLIC_SCHEMA, None],
)
@pytest.mark.parametrize(
    "existing_tables",
    [
        ["db.test_schema.test_table", "db.PUBLIC.test_table"],
        ["db.test_schema.test_table"],
        ["db.PUBLIC.test_table"],
        [],
    ],
)
def test_resolve_snoflake_fqn(schema_name, existing_tables):
    def expected_result(schema_name, existing_tables):
        if len(existing_tables) == 0:
            return RuntimeError
        if schema_name == "test_schema":
            if "db.test_schema.test_table" in existing_tables:
                return "db", "test_schema", "test_table"
            if "db.PUBLIC.test_table" in existing_tables:
                return "db", PUBLIC_SCHEMA, "test_table"
        if (
            schema_name in [None, PUBLIC_SCHEMA]
            and "db.PUBLIC.test_table" in existing_tables
        ):
            return "db", PUBLIC_SCHEMA, "test_table"
        return RuntimeError

    resolver = SnowflakeTableResovler(Mock())

    def mock_show_tables(_, schema, table):
        for t in existing_tables:
            if t == f"db.{schema}.{table}":
                return True

    resolver.show_tables = mock_show_tables
    expected = expected_result(schema_name, existing_tables)
    if expected == RuntimeError:
        with pytest.raises(expected):
            resolver.resolve_implicit_fqn("db", schema_name, "test_table")
    else:
        result = resolver.resolve_implicit_fqn("db", schema_name, "test_table")
        assert result == expected


@pytest.mark.parametrize("context_database", [None, "context_db"])
@pytest.mark.parametrize("context_schema", [None, "context_schema", PUBLIC_SCHEMA])
@pytest.mark.parametrize(
    "identifier",
    [
        "",
        "test_table",
        "id_schema.test_table",
        "PUBLIC.test_table",
        "id_db.test_schema.test_table",
        "id_db.PUBLIC.test_table",
    ],
)
@pytest.mark.parametrize(
    "resolved_schema",
    [
        PUBLIC_SCHEMA,
        "context_schema",
        RuntimeError("could not resolve schema"),
    ],
)
def test_get_identifiers(
    context_database,
    context_schema,
    identifier,
    resolved_schema,
):
    def expected_result():
        if identifier == "":
            return RuntimeError("Could not extract the table name.")
        db, id_schema, table = get_identifiers_from_string(identifier)
        if db is None and context_database is None:
            return RuntimeError("Could not resolve database name.")
        if id_schema is None and isinstance(resolved_schema, RuntimeError):
            return RuntimeError("could not resolve schema")
        return (
            (db or context_database),
            (id_schema or resolved_schema or context_schema),
            table,
        )

    resolver = SnowflakeTableResovler(Mock())
    if isinstance(resolved_schema, RuntimeError):
        resolver.resolve_implicit_fqn = MagicMock(side_effect=resolved_schema)
    else:
        resolver.resolve_implicit_fqn = MagicMock(
            return_value=(context_database, resolved_schema, identifier)
        )

    expected_value = expected_result()
    if isinstance(expected_value, RuntimeError):
        with pytest.raises(type(expected_value), match=str(expected_value)) as e:
            resolver.resolve_snowflake_fqn(context_database, context_schema, identifier)
    else:
        assert expected_value == resolver.resolve_snowflake_fqn(
            context_database, context_schema, identifier
        )
