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
"""
Unit tests for parser.get_connection_class()
Tests for Issue #22920 - Connection module import handling

ISSUE #22920 - Root Cause Analysis
===================================

The Schema Generation Pattern:
-------------------------------
Most service connection files use camelCase naming:
  - BigQuery    -> bigQueryConnection.py    (first char lower, rest same)
  - AzureSQL    -> azureSQLConnection.py    (first char lower, rest same)
  - DynamoDB    -> dynamoDBConnection.py    (first char lower, rest same)
  - MariaDB     -> mariaDBConnection.py     (first char lower, rest same)

Three exceptions use all-lowercase:
  - SAS         -> sasConnection.py         (all lowercase)
  - SQLite      -> sqliteConnection.py      (all lowercase)
  - SSAS        -> ssasConnection.py        (all lowercase)

The Original Bug:
-----------------
The code only used: source_type[0].lower() + source_type[1:] + "Connection"
This worked for most services but FAILED for the 3 lowercase exceptions:
  - "SAS" produced "sASConnection" but file is "sasConnection.py"

On case-insensitive filesystems (macOS), this worked by accident.
On case-sensitive filesystems (Linux/Docker), imports failed:
  ModuleNotFoundError: No module named '...sASConnection'

The Solution:
-------------
The current implementation uses a try-except pattern:
1. Try standard camelCase: "BigQuery" -> "bigQueryConnection" (most services)
2. Fallback to lowercase: "SAS" -> "sasConnection" (3 exceptions)

This handles both naming patterns without hardcoded lists.

Performance Impact:
-------------------
- Standard services (44): Single import, ~5-10ms
- Exceptional services (3): First import fails + fallback, ~12-20ms
- Negligible impact: Only 3 out of 47 services use fallback
"""
import pytest

from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.ingestion.api.parser import get_connection_class


class TestGetConnectionClass:
    """
    Test suite for get_connection_class() function to ensure it correctly
    generates connection module names for all database service types.

    This tests the fix for Issue #22920 where mixed-case service names
    (like SAS, BigQuery, AzureSQL) were failing due to incorrect casing
    in the generated module name.
    """

    # Services that use camelCase in file names (most services)
    CAMELCASE_SERVICES = [
        "AzureSQL",
        "BigQuery",
        "BigTable",
        "DeltaLake",
        "DomoDatabase",
        "DynamoDB",
        "MariaDB",
        "MongoDB",
        "PinotDB",
        "SapErp",
        "SapHana",
        "ServiceNow",
        "SingleStore",
        "UnityCatalog",
    ]

    # Services that use all-lowercase in file names (exceptions)
    LOWERCASE_SERVICES = [
        "SAS",  # sasConnection.py
        "SQLite",  # sqliteConnection.py
        "SSAS",  # ssasConnection.py
    ]

    # Services that worked with simple casing (first char lowercase only)
    SIMPLE_CASE_SERVICES = [
        "Athena",
        "Cassandra",
        "Clickhouse",
        "Cockroach",
        "Couchbase",
        "Databricks",
        "Datalake",
        "Db2",
        "Doris",
        "Druid",
        "Epic",
        "Exasol",
        "Glue",
        "Greenplum",
        "Hive",
        "Iceberg",
        "Impala",
        "Mssql",
        "Mysql",
        "Oracle",
        "Postgres",
        "Presto",
        "Redshift",
        "Salesforce",
        "Snowflake",
        "Synapse",
        "Teradata",
        "Timescale",
        "Trino",
        "Vertica",
    ]

    @pytest.mark.parametrize("service_name", CAMELCASE_SERVICES)
    def test_camelcase_services(self, service_name):
        """
        Test services that use camelCase in their module file names.

        These services have capital letters beyond the first character:
        - BigQuery -> bigQueryConnection.py
        - AzureSQL -> azureSQLConnection.py
        - DynamoDB -> dynamoDBConnection.py
        """
        try:
            connection_class = get_connection_class(service_name, DatabaseConnection)

            # Verify we got a valid class
            assert (
                connection_class is not None
            ), f"get_connection_class returned None for {service_name}"

            # Verify class name follows expected pattern
            expected_class_name = f"{service_name}Connection"
            assert connection_class.__name__ == expected_class_name, (
                f"Expected class name '{expected_class_name}', "
                f"got '{connection_class.__name__}'"
            )

            # Generate expected camelCase module name
            # (first char lowercase, rest unchanged)
            expected_module_name = (
                service_name[0].lower() + service_name[1:] + "Connection"
            )
            assert expected_module_name in connection_class.__module__, (
                f"Expected module to contain '{expected_module_name}', "
                f"got '{connection_class.__module__}'"
            )

        except ModuleNotFoundError as e:
            pytest.fail(f"Failed to import connection class for {service_name}: {e}")
        except Exception as e:
            pytest.fail(f"Unexpected error for {service_name}: {e}")

    @pytest.mark.parametrize("service_name", LOWERCASE_SERVICES)
    def test_lowercase_services(self, service_name):
        """
        Test services that use all-lowercase in their module file names.

        These are exceptions: SAS, SQLite, SSAS
        - SAS -> sasConnection.py (not sASConnection.py)
        - SQLite -> sqliteConnection.py (not sQLiteConnection.py)
        - SSAS -> ssasConnection.py (not sSASConnection.py)
        """
        try:
            connection_class = get_connection_class(service_name, DatabaseConnection)

            # Verify we got a valid class
            assert (
                connection_class is not None
            ), f"get_connection_class returned None for {service_name}"

            # Verify class name follows expected pattern
            expected_class_name = f"{service_name}Connection"
            assert connection_class.__name__ == expected_class_name, (
                f"Expected class name '{expected_class_name}', "
                f"got '{connection_class.__name__}'"
            )

            # Generate expected lowercase module name
            expected_module_name = service_name.lower() + "Connection"
            assert expected_module_name in connection_class.__module__, (
                f"Expected module to contain '{expected_module_name}', "
                f"got '{connection_class.__module__}'"
            )

        except ModuleNotFoundError as e:
            pytest.fail(f"Failed to import connection class for {service_name}: {e}")
        except Exception as e:
            pytest.fail(f"Unexpected error for {service_name}: {e}")

    @pytest.mark.parametrize("service_name", SIMPLE_CASE_SERVICES)
    def test_simple_case_services(self, service_name):
        """
        Test services where simple first-char lowercase works.

        These services naturally work with: first char lowercase, rest same
        - Mysql -> mysqlConnection.py
        - Athena -> athenaConnection.py
        """
        try:
            connection_class = get_connection_class(service_name, DatabaseConnection)

            # Verify we got a valid class
            assert (
                connection_class is not None
            ), f"get_connection_class returned None for {service_name}"

            # Verify class name follows expected pattern
            expected_class_name = f"{service_name}Connection"
            assert connection_class.__name__ == expected_class_name, (
                f"Expected class name '{expected_class_name}', "
                f"got '{connection_class.__name__}'"
            )

            # Generate expected simple-case module name
            expected_module_name = (
                service_name[0].lower() + service_name[1:] + "Connection"
            )
            assert expected_module_name in connection_class.__module__, (
                f"Expected module to contain '{expected_module_name}', "
                f"got '{connection_class.__module__}'"
            )

        except ModuleNotFoundError as e:
            pytest.fail(f"Failed to import connection class for {service_name}: {e}")
        except Exception as e:
            pytest.fail(f"Unexpected error for {service_name}: {e}")

    def test_all_database_services(self):
        """
        Test that database service types with connection classes
        can successfully import them.

        Note: CustomDatabase, QueryLog, and Dbt are in DatabaseServiceType
        but don't have connection modules (they're metadata-only services).
        """
        failed_services = []
        success_count = 0
        skipped_services = [
            "CustomDatabase",
            "QueryLog",
            "Dbt",
        ]  # No connection modules

        for service in DatabaseServiceType:
            service_name = service.value

            # Skip services without connection modules
            if service_name in skipped_services:
                continue

            try:
                connection_class = get_connection_class(
                    service_name, DatabaseConnection
                )
                assert connection_class is not None
                success_count += 1
            except Exception as e:
                failed_services.append((service_name, str(e)))

        # Report results
        total_testable = len(list(DatabaseServiceType)) - len(skipped_services)

        if failed_services:
            failure_details = "\n".join(
                f"  - {name}: {error}" for name, error in failed_services
            )
            pytest.fail(
                f"Failed to import {len(failed_services)} out of "
                f"{total_testable} services:\n"
                f"{failure_details}\n\n"
                f"Successfully imported {success_count} services."
            )

        # If we get here, all services passed
        assert success_count == total_testable, (
            f"Expected {total_testable} services, "
            f"but only {success_count} succeeded"
        )

    def test_sas_connection_specific(self):
        """
        Specific test for SAS connection (the original issue #22920).

        SAS is one of the exceptions that uses all-lowercase:
        - File: sasConnection.py
        - Uses fallback import path
        """
        try:
            connection_class = get_connection_class("SAS", DatabaseConnection)

            # Verify class details
            assert connection_class.__name__ == "SASConnection"
            assert "sasConnection" in connection_class.__module__

            # Verify it has expected attributes
            assert hasattr(connection_class, "model_fields") or hasattr(
                connection_class, "__fields__"
            )

        except ModuleNotFoundError as e:
            pytest.fail(
                f"SAS connection import failed with "
                f"ModuleNotFoundError: {e}\n"
                f"This is the exact bug reported in Issue #22920.\n"
                f"The fix should use fallback to lowercase."
            )

    def test_bigquery_connection_specific(self):
        """
        Specific test for BigQuery connection.

        BigQuery uses camelCase in the module file:
        - File: bigQueryConnection.py (NOT bigqueryConnection.py)
        - Standard import path works
        """
        try:
            connection_class = get_connection_class("BigQuery", DatabaseConnection)

            assert connection_class.__name__ == "BigQueryConnection"
            # Expect camelCase module name
            assert "bigQueryConnection" in connection_class.__module__

        except ModuleNotFoundError as e:
            pytest.fail(
                f"BigQuery connection import failed: {e}\n"
                f"Expected module 'bigQueryConnection' (camelCase)."
            )

    def test_azuresql_connection_specific(self):
        """
        Specific test for AzureSQL connection.

        AzureSQL uses camelCase in the module file:
        - File: azureSQLConnection.py (NOT azuresqlConnection.py)
        - Standard import path works
        """
        try:
            connection_class = get_connection_class("AzureSQL", DatabaseConnection)

            assert connection_class.__name__ == "AzureSQLConnection"
            # Expect camelCase module name
            assert "azureSQLConnection" in connection_class.__module__

        except ModuleNotFoundError as e:
            pytest.fail(
                f"AzureSQL connection import failed: {e}\n"
                f"Expected module 'azureSQLConnection' (camelCase)."
            )

    def test_dynamodb_connection_specific(self):
        """
        Specific test for DynamoDB connection.

        DynamoDB uses camelCase in the module file:
        - File: dynamoDBConnection.py (NOT dynamodbConnection.py)
        - Standard import path works
        """
        try:
            connection_class = get_connection_class("DynamoDB", DatabaseConnection)

            assert connection_class.__name__ == "DynamoDBConnection"
            # Expect camelCase module name
            assert "dynamoDBConnection" in connection_class.__module__

        except ModuleNotFoundError as e:
            pytest.fail(
                f"DynamoDB connection import failed: {e}\n"
                f"Expected module 'dynamoDBConnection' (camelCase)."
            )

    def test_module_name_generation_formula(self):
        """
        Test the formula used to generate connection module names.

        This test documents the expected behavior:

        Most services use camelCase (first char lowercase, rest same):
        - BigQuery -> bigQueryConnection.py
        - AzureSQL -> azureSQLConnection.py
        - DynamoDB -> dynamoDBConnection.py

        Three exceptions use all-lowercase:
        - SAS -> sasConnection.py (not sASConnection.py)
        - SQLite -> sqliteConnection.py (not sQLiteConnection.py)
        - SSAS -> ssasConnection.py (not sSASConnection.py)
        """
        test_cases = {
            # All-lowercase exceptions (use fallback)
            "SAS": "sasConnection",
            "SQLite": "sqliteConnection",
            "SSAS": "ssasConnection",
            # CamelCase services (standard path)
            "BigQuery": "bigQueryConnection",
            "AzureSQL": "azureSQLConnection",
            "DynamoDB": "dynamoDBConnection",
            # Simple lowercase services
            "Mysql": "mysqlConnection",
            "Glue": "glueConnection",
            "Db2": "db2Connection",
        }

        for service_name, expected_module_name in test_cases.items():
            try:
                connection_class = get_connection_class(
                    service_name, DatabaseConnection
                )

                # Extract just the module filename
                actual_module_name = connection_class.__module__.split(".")[-1]

                assert actual_module_name == expected_module_name, (
                    f"For service '{service_name}': "
                    f"expected module '{expected_module_name}', "
                    f"got '{actual_module_name}'"
                )

            except Exception as e:
                pytest.fail(f"Failed test for {service_name}: {e}")
