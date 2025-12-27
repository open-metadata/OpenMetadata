"""
Unit tests for parser.get_connection_class() function
Tests the fix for Issue #22920 - SAS connection casing bug
"""
import unittest

from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.ingestion.api.parser import get_connection_class


class TestGetConnectionClass(unittest.TestCase):
    """Test the get_connection_class function handles all service types correctly"""

    def test_sas_connection_lowercase_schema(self):
        """Test SAS service which has all-lowercase schema file (sasConnection.py)"""
        # This is the primary bug from Issue #22920
        connection_class = get_connection_class("SAS", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "SASConnection")

    def test_bigquery_connection_camelcase_schema(self):
        """Test BigQuery service with camelCase schema file (bigQueryConnection.py)"""
        connection_class = get_connection_class("BigQuery", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "BigQueryConnection")

    def test_azuresql_connection_camelcase_schema(self):
        """Test AzureSQL service with camelCase schema file (azureSQLConnection.py)"""
        connection_class = get_connection_class("AzureSQL", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "AzureSQLConnection")

    def test_dynamodb_connection_camelcase_schema(self):
        """Test DynamoDB service with camelCase schema file (dynamoDBConnection.py)"""
        connection_class = get_connection_class("DynamoDB", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "DynamoDBConnection")

    def test_db2_connection_lowercase_after_first(self):
        """Test Db2 service (db2Connection.py) - naturally lowercase after first char"""
        connection_class = get_connection_class("Db2", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "Db2Connection")

    def test_glue_connection_simple_case(self):
        """Test Glue service (glueConnection.py) - simple lowercase"""
        connection_class = get_connection_class("Glue", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "GlueConnection")

    def test_mysql_connection_simple_case(self):
        """Test Mysql service (mysqlConnection.py) - simple lowercase"""
        connection_class = get_connection_class("Mysql", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "MysqlConnection")

    def test_postgresql_connection(self):
        """Test PostgreSQL service (postgresConnection.py)"""
        connection_class = get_connection_class("Postgres", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "PostgresConnection")

    def test_snowflake_connection(self):
        """Test Snowflake service (snowflakeConnection.py)"""
        connection_class = get_connection_class("Snowflake", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "SnowflakeConnection")

    def test_redshift_connection(self):
        """Test Redshift service (redshiftConnection.py)"""
        connection_class = get_connection_class("Redshift", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "RedshiftConnection")

    def test_mssql_connection(self):
        """Test MSSQL service (mssqlConnection.py)"""
        connection_class = get_connection_class("Mssql", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "MssqlConnection")

    def test_oracle_connection(self):
        """Test Oracle service (oracleConnection.py)"""
        connection_class = get_connection_class("Oracle", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "OracleConnection")

    def test_athena_connection(self):
        """Test Athena service (athenaConnection.py)"""
        connection_class = get_connection_class("Athena", DatabaseConnection)
        self.assertIsNotNone(connection_class)
        self.assertEqual(connection_class.__name__, "AthenaConnection")

    def test_all_database_service_types(self):
        """Test all database service types can load connection classes"""
        # Exclude types that don't have connection classes
        excluded_types = ["CustomDatabase", "QueryLog", "Dbt"]

        for service_type in DatabaseServiceType:
            if service_type.value not in excluded_types:
                with self.subTest(service_type=service_type.value):
                    try:
                        connection_class = get_connection_class(
                            service_type.value, DatabaseConnection
                        )
                        self.assertIsNotNone(
                            connection_class,
                            f"Failed to load connection class for {service_type.value}",
                        )
                        expected_class_name = f"{service_type.value}Connection"
                        self.assertEqual(
                            connection_class.__name__,
                            expected_class_name,
                            f"Class name mismatch for {service_type.value}",
                        )
                    except Exception as e:
                        self.fail(
                            f"Failed to get connection class for {service_type.value}: {e}"
                        )


if __name__ == "__main__":
    unittest.main()
