import pytest

from metadata.ingestion.source.database.snowflake.utils import format_full_schema_name


@pytest.mark.parametrize(
    "full_schema_name, original_schema, current_database, expected_output",
    [
        (
            '"UPPERCASE_DB".lowercase_schema',
            "lowercase_schema",
            "UPPERCASE_DB",
            '"UPPERCASE_DB"."lowercase_schema"',
        ),
        (
            'lowercase_db."UPPERCASE_SCHEMA"',
            "UPPERCASE_SCHEMA",
            "lowercase_db",
            '"lowercase_db"."UPPERCASE_SCHEMA"',
        ),
        (
            '"UPPERCASE_DB"."UPPERCASE_SCHEMA"',
            "UPPERCASE_SCHEMA",
            "UPPERCASE_DB",
            '"UPPERCASE_DB"."UPPERCASE_SCHEMA"',
        ),
        ('"DOT.DB"."DOT.SCHEMA"', "DOT.SCHEMA", "DOT.DB", '"DOT.DB"."DOT.SCHEMA"'),
        ('"dbname.".schemaname', "schemaname", "dbname.", '"dbname."."schemaname"'),
    ],
)
def test_full_schema_name_sanitization(
    full_schema_name, original_schema, current_database, expected_output
):
    sanitized_schema = format_full_schema_name(
        full_schema_name, original_schema, current_database
    )
    assert sanitized_schema == expected_output
