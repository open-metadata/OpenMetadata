import pytest

from metadata.ingestion.source.database.databricks.metadata import format_schema_name


@pytest.mark.parametrize(
    "input_schema, expected_schema",
    [
        ("test_schema-name", "`test_schema-name`"),
        ("test_schema_name", "test_schema_name"),
        ("schema-with-hyphen", "`schema-with-hyphen`"),
        ("schema_with_underscore", "schema_with_underscore"),
        ("validSchema", "validSchema"),
    ],
)
def test_schema_name_sanitization(input_schema, expected_schema):
    """
    Test sanitization of schema names by adding backticks only around hyphenated names.
    """
    sanitized_schema = format_schema_name(input_schema)
    assert sanitized_schema == expected_schema
