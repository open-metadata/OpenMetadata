from unittest.mock import Mock
from metadata.ingestion.source.database.snowflake.utils import _get_schema_unique_constraints

def test_snowflake_unique_constraint_collision():
    # Mocking self (SnowflakeDialect)
    dialect_mock = Mock()
    dialect_mock.normalize_name = lambda name: name.lower() if name else name

    # Mocking connection
    connection_mock = Mock()

    # Mocking the result of connection.execute(...)
    # Simulating two tables 'table_1' and 'table_2' inside the same schema 
    # both sharing an identical constraint name like "unique_id"
    row1 = Mock()
    row1._mapping = {
        "constraint_name": "unique_id",
        "table_name": "table_1",
        "column_name": "id"
    }

    row2 = Mock()
    row2._mapping = {
        "constraint_name": "unique_id",
        "table_name": "table_2",
        "column_name": "id"
    }
    
    # Composite constraint on table_2 (second column of the same unique key)
    row3 = Mock()
    row3._mapping = {
        "constraint_name": "unique_id",
        "table_name": "table_2",
        "column_name": "email"
    }

    result_mock = [row1, row2, row3]
    connection_mock.execute.return_value = result_mock

    # Run the patched function
    output = _get_schema_unique_constraints(dialect_mock, connection_mock, "public")

    # Output should correctly split the constraints for table_1 and table_2 without collision
    assert "table_1" in output
    assert "table_2" in output

    assert len(output["table_1"]) == 1
    assert output["table_1"][0]["name"] == "unique_id"
    assert output["table_1"][0]["column_names"] == ["id"]

    assert len(output["table_2"]) == 1
    assert output["table_2"][0]["name"] == "unique_id"
    assert output["table_2"][0]["column_names"] == ["id", "email"]
