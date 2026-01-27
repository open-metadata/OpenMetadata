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
Comprehensive unit tests for parser.get_connection_class() fallback mechanism
Tests for Issue #22920 - Scalable solution for connection module imports

Background:
-----------
Issue #22920 reported ModuleNotFoundError for SAS connection on Linux systems:
  "No module named 'metadata.generated.schema.entity.services.connections.database.sASConnection'"

Root Cause:
-----------
The old code formula was: source_type[0].lower() + source_type[1:] + "Connection"
For "SAS", this produced "sASConnection", but the actual file is "sasConnection.py".

Case-Sensitivity Issue:
-----------------------
- macOS (case-insensitive FS): Bug was masked, imports worked
- Linux/Docker (case-sensitive FS): Imports failed with ModuleNotFoundError

Services Affected:
------------------
Only 3 out of 47 database services were broken on Linux:
  ❌ SAS     (tried: sASConnection,     actual: sasConnection.py)
  ❌ SQLite  (tried: sQLiteConnection,  actual: sqliteConnection.py)
  ❌ SSAS    (tried: sSASConnection,    actual: ssasConnection.py)

All other 44 services worked correctly because camelCase matched their filenames:
  ✅ BigQuery (bigQueryConnection.py), AzureSQL (azureSQLConnection.py), etc.

The Solution:
-------------
Try-except pattern attempts standard camelCase first, falls back to lowercase.
This automatically handles both naming conventions without hardcoded lists.

Test Strategy:
--------------
This test suite validates:
1. Fallback path works for the 3 affected services
2. Standard path works for 44 unaffected services
3. Edge cases (numbers, acronyms, mixed-case)
4. Comprehensive validation of all 47 services
5. Performance (fallback has negligible overhead)
"""
import pytest

from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.ingestion.api.parser import get_connection_class


class TestConnectionFallbackMechanism:
    """
    Test suite for the scalable connection import mechanism.

    The get_connection_class() function uses a try-except pattern:
    1. Try standard camelCase: "BigQuery" -> "bigQueryConnection.py" (44 services)
    2. Fallback to lowercase: "SAS" -> "sasConnection.py" (3 services)

    This automatically handles any naming convention without hardcoded lists.

    IMPORTANT: Only 3 services require the fallback path!
    All other services use standard camelCase and work on first try.
    """

    # The ONLY 3 services that require fallback to all-lowercase module name
    # These were broken on Linux (case-sensitive FS) before the fix
    # Old formula produced wrong casing: sASConnection (tried) != sasConnection (actual)
    FALLBACK_SERVICES = ["SAS", "SQLite", "SSAS"]

    # Services with multi-word camelCase names (take standard path)
    CAMELCASE_SERVICES = [
        "BigQuery",  # bigQueryConnection.py
        "AzureSQL",  # azureSQLConnection.py
        "DynamoDB",  # dynamoDBConnection.py
        "MariaDB",  # mariaDBConnection.py
        "MongoDB",  # mongoDBConnection.py
        "PinotDB",  # pinotDBConnection.py
        "DeltaLake",  # deltaLakeConnection.py
        "SingleStore",  # singleStoreConnection.py
        "UnityCatalog",  # unityCatalogConnection.py
        "BigTable",  # bigTableConnection.py
        "DomoDatabase",  # domoDatabaseConnection.py
        "SapHana",  # sapHanaConnection.py
        "SapErp",  # sapErpConnection.py
        "ServiceNow",  # serviceNowConnection.py
    ]

    # Services with single word or naturally lowercase names
    SIMPLE_SERVICES = [
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

    @pytest.mark.parametrize("service_name", FALLBACK_SERVICES)
    def test_lowercase_fallback_services(self, service_name):
        """
        Test the 3 services that were BROKEN on Linux before the fix.

        These services have schema files that don't follow standard camelCase:
        - SAS -> sasConnection.py (old code tried: sASConnection.py ❌)
        - SQLite -> sqliteConnection.py (old code tried: sQLiteConnection.py ❌)
        - SSAS -> ssasConnection.py (old code tried: sSASConnection.py ❌)

        On Linux (case-sensitive FS): Old code failed with ModuleNotFoundError
        On macOS (case-insensitive FS): Old code worked by accident (bug was masked)

        The try-except pattern automatically falls back to lowercase when
        the standard camelCase import fails, fixing the issue on all platforms.
        """
        connection_class = get_connection_class(service_name, DatabaseConnection)

        # Verify class was loaded successfully
        assert (
            connection_class is not None
        ), f"Failed to load connection class for {service_name}"

        # Verify class name is correct
        expected_class_name = f"{service_name}Connection"
        assert connection_class.__name__ == expected_class_name, (
            f"Expected class name '{expected_class_name}', "
            f"got '{connection_class.__name__}'"
        )

        # Verify module uses all-lowercase naming
        expected_module = f"{service_name.lower()}Connection"
        assert connection_class.__module__.endswith(expected_module), (
            f"Expected module to end with '{expected_module}', "
            f"got '{connection_class.__module__}'"
        )

    @pytest.mark.parametrize("service_name", CAMELCASE_SERVICES)
    def test_standard_camelcase_services(self, service_name):
        """
        Test services that were NEVER BROKEN - they always used standard camelCase.

        These services follow the pattern: "BigQuery" -> "bigQueryConnection.py"
        The old formula produced correct casing, so they worked on all systems.

        Example: "BigQuery"
          Old formula: "b" + "igQuery" + "Connection" = "bigQueryConnection" ✅
          Actual file: bigQueryConnection.py ✅
          Result: MATCH - worked on both Linux and macOS

        The try block succeeds immediately without needing the fallback.
        This represents 44 out of 47 database services (94%).
        """
        connection_class = get_connection_class(service_name, DatabaseConnection)

        # Verify class was loaded successfully
        assert (
            connection_class is not None
        ), f"Failed to load connection class for {service_name}"

        # Verify class name is correct
        expected_class_name = f"{service_name}Connection"
        assert connection_class.__name__ == expected_class_name, (
            f"Expected class name '{expected_class_name}', "
            f"got '{connection_class.__name__}'"
        )

        # Verify module uses camelCase naming (not all-lowercase)
        expected_module = f"{service_name[0].lower()}{service_name[1:]}Connection"
        assert connection_class.__module__.endswith(expected_module), (
            f"Expected module to end with '{expected_module}', "
            f"got '{connection_class.__module__}'"
        )

        # Verify it's NOT using all-lowercase (that would be wrong)
        wrong_module = f"{service_name.lower()}Connection"
        assert not connection_class.__module__.endswith(
            wrong_module
        ), f"Module should use camelCase, not all-lowercase '{wrong_module}'"

    @pytest.mark.parametrize("service_name", SIMPLE_SERVICES)
    def test_simple_name_services(self, service_name):
        """
        Test services with simple names that naturally work with camelCase.

        Services like "Glue", "Oracle", "Postgres" have single-word names
        or names where camelCase naturally produces the correct result.
        """
        connection_class = get_connection_class(service_name, DatabaseConnection)

        # Verify class was loaded successfully
        assert (
            connection_class is not None
        ), f"Failed to load connection class for {service_name}"

        # Verify class name is correct
        expected_class_name = f"{service_name}Connection"
        assert connection_class.__name__ == expected_class_name

    def test_all_database_services_comprehensive(self):
        """
        Comprehensive test that validates ALL database service types work.

        This is the ultimate validation that the fallback mechanism is robust
        and handles every service in the DatabaseServiceType enum.
        """
        # Services that don't have connection classes
        excluded_services = {"CustomDatabase", "QueryLog", "Dbt"}

        failed_services = []
        success_count = 0
        fallback_used = []
        standard_path = []

        for service_type in DatabaseServiceType:
            service_name = service_type.value

            if service_name in excluded_services:
                continue

            try:
                connection_class = get_connection_class(
                    service_name, DatabaseConnection
                )

                # Verify basic properties
                assert connection_class is not None
                assert connection_class.__name__ == f"{service_name}Connection"

                # Track which path was used
                if service_name in self.FALLBACK_SERVICES:
                    fallback_used.append(service_name)
                else:
                    standard_path.append(service_name)

                success_count += 1

            except Exception as e:
                failed_services.append((service_name, str(e)))

        # Report results
        total_services = len(list(DatabaseServiceType)) - len(excluded_services)

        if failed_services:
            failure_details = "\n".join(
                f"  - {name}: {error}" for name, error in failed_services
            )
            pytest.fail(
                f"❌ Failed to import {len(failed_services)} out of {total_services} services:\n"
                f"{failure_details}\n\n"
                f"✅ Successfully imported {success_count} services\n"
                f"📊 Standard path: {len(standard_path)} services\n"
                f"🔄 Fallback path: {len(fallback_used)} services ({fallback_used})"
            )

        assert success_count == total_services

    def test_sas_connection_original_issue(self):
        """
        Specific test for the original issue #22920 - SAS connection failure on Linux.

        The Bug:
        --------
        On Linux (case-sensitive filesystem), the old code tried to import "sASConnection"
        but the actual file is "sasConnection.py", causing ModuleNotFoundError.

        Error message from issue:
          "No module named 'metadata.generated.schema.entity.services.connections.database.sASConnection'"

        Before fix:
          import ...sASConnection  -> ❌ ModuleNotFoundError (on Linux)
                                      ✅ Worked on macOS (case-insensitive)

        After fix:
          Try:    import ...sASConnection  -> ❌ Fails
          Catch:  import ...sasConnection  -> ✅ Success (on all platforms)
        """
        connection_class = get_connection_class("SAS", DatabaseConnection)

        # Verify the class was loaded
        assert connection_class.__name__ == "SASConnection"

        # Verify it used the lowercase fallback path
        assert "sasConnection" in connection_class.__module__

        # Verify it has expected Pydantic model attributes
        assert hasattr(connection_class, "model_fields") or hasattr(
            connection_class, "__fields__"
        ), "Connection class should be a Pydantic model"

    def test_fallback_mechanism_performance(self):
        """
        Verify that the fallback mechanism has minimal performance impact.

        Standard path services: 1 import attempt (fast)
        Fallback path services: 2 import attempts (still fast)

        With only 3 services using fallback out of 47, the overhead is negligible.
        """
        import time

        # Test standard path (should be fast - single import)
        start = time.perf_counter()
        for _ in range(10):
            get_connection_class("BigQuery", DatabaseConnection)
        standard_time = time.perf_counter() - start

        # Test fallback path (should be slightly slower - two imports)
        start = time.perf_counter()
        for _ in range(10):
            get_connection_class("SAS", DatabaseConnection)
        fallback_time = time.perf_counter() - start

        # Both should be very fast (under 1 second for 10 iterations)
        assert standard_time < 1.0, "Standard path should be fast"
        assert fallback_time < 1.0, "Fallback path should be fast"

        # Fallback has negligible overhead in absolute terms (extra import attempt adds ~1ms)
        # Use absolute threshold rather than relative to avoid CI timing sensitivity
        assert (
            fallback_time < 0.1
        ), f"Fallback path ({fallback_time:.4f}s) should be fast in absolute terms"

    def test_edge_case_numeric_service_name(self):
        """
        Test service names with numbers (edge case).

        Db2 is an interesting case because it has a number in the name.
        """
        connection_class = get_connection_class("Db2", DatabaseConnection)

        assert connection_class.__name__ == "Db2Connection"
        assert "db2Connection" in connection_class.__module__

    def test_edge_case_all_uppercase_acronym(self):
        """
        Test services with all-uppercase acronyms.

        SSAS (SQL Server Analysis Services) is all uppercase and uses fallback.
        """
        connection_class = get_connection_class("SSAS", DatabaseConnection)

        assert connection_class.__name__ == "SSASConnection"
        assert "ssasConnection" in connection_class.__module__

    def test_edge_case_mixed_case_acronym(self):
        """
        Test services with mixed-case acronyms.

        AzureSQL has mixed uppercase (SQL) and should use standard camelCase.
        """
        connection_class = get_connection_class("AzureSQL", DatabaseConnection)

        assert connection_class.__name__ == "AzureSQLConnection"
        # Should use camelCase: azureSQLConnection (not azuresqlConnection)
        assert "azureSQLConnection" in connection_class.__module__


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
