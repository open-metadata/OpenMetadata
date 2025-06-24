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
Clickhouse lineage utils tests
"""
from unittest.mock import Mock, patch

import pytest

from metadata.ingestion.source.database.clickhouse.lineage import (
    ClickhouseLineageSource,
)


class TestClickhouseLineage:
    """
    Tests for Clickhouse lineage source table resolution
    """

    def setup_method(self):
        """Setup method called before each test"""
        self.mock_metadata = Mock()
        self.mock_config = Mock()
        self.mock_source_config = Mock()

        # Set up proper config structure that the parent classes expect
        self.mock_source_config.queryLogDuration = (
            1  # Integer as expected by get_start_and_end
        )

        self.mock_service_connection = Mock()
        self.mock_service_connection.type.value = "clickhouse"
        self.mock_service_connection.type.name = "Clickhouse"

        self.mock_config.serviceName = "test_clickhouse"
        self.mock_config.sourceConfig.config = self.mock_source_config
        self.mock_config.serviceConnection.root.config = self.mock_service_connection

        # Mock the parent constructors to avoid dependency issues
        with patch(
            "metadata.ingestion.source.database.query_parser_source.QueryParserSource.__init__",
            return_value=None,
        ), patch(
            "metadata.ingestion.source.database.lineage_source.LineageSource.__init__",
            return_value=None,
        ), patch(
            "metadata.ingestion.source.database.clickhouse.query_parser.ClickhouseQueryParserSource.__init__",
            return_value=None,
        ):

            # Create a real ClickhouseLineageSource instance but bypass the constructor
            self.clickhouse_source = ClickhouseLineageSource.__new__(
                ClickhouseLineageSource
            )

            # Set up required attributes manually
            self.clickhouse_source.config = self.mock_config
            self.clickhouse_source.metadata = self.mock_metadata
            self.clickhouse_source.service_name = "test_clickhouse"
            self.clickhouse_source.source_config = self.mock_source_config
            self.clickhouse_source.service_connection = self.mock_service_connection
            self.clickhouse_source.engine = Mock()

    @pytest.mark.parametrize(
        "table_name,database_name,database_schema,mock_responses,expected_found",
        [
            # Test case 1: Schema-prefixed table found using Strategy 2b (parsed schema as database)
            (
                "schema.table_test",
                "test_db",
                "default",
                [
                    None,
                    None,
                    [Mock(name="table_test")],
                ],  # Strategy 1, 2a fail, 2b succeeds
                True,
            ),
            # Test case 2: Base table name fallback works
            (
                "another_schema.my_table",
                "clickhouse_db",
                "public",
                [
                    None,
                    None,
                    None,
                    [Mock(name="my_table")],
                ],  # Strategy 1, 2a, 2b fail, 3 succeeds
                True,
            ),
            # Test case 3: Original resolution works immediately
            (
                "simple_table",
                "test_db",
                "default",
                [[Mock(name="simple_table")]],  # Strategy 1 succeeds immediately
                True,
            ),
            # Test case 4: All strategies fail
            (
                "nonexistent.table",
                "test_db",
                "default",
                [None, None, None, None, None],  # All strategies fail
                False,
            ),
        ],
    )
    def test_get_clickhouse_table_entities_with_strategies(
        self, table_name, database_name, database_schema, mock_responses, expected_found
    ):
        """
        Test that the Clickhouse-specific table entity resolution uses multiple strategies correctly
        """
        with patch(
            "metadata.ingestion.source.database.clickhouse.lineage.get_table_entities_from_query",
            side_effect=mock_responses,
        ):

            result = self.clickhouse_source.get_clickhouse_table_entities_from_query(
                metadata=self.mock_metadata,
                service_name="test_service",
                database_name=database_name,
                database_schema=database_schema,
                table_name=table_name,
            )

            if expected_found:
                assert result is not None
                assert len(result) > 0
            else:
                assert result is None

    @pytest.mark.parametrize(
        "table_name,expected_strategies_attempted",
        [
            ("schema.table_test", 5),  # original + 2 parsed + base + uppercase
            ("simple_table", 2),  # original + uppercase (since original is lowercase)
            ("ALLCAPS", 2),  # original + lowercase
            ("Mixed.Case_Table", 6),  # original + 2 parsed + base + lower + upper
        ],
    )
    def test_strategy_count_verification(
        self, table_name, expected_strategies_attempted
    ):
        """
        Test that the correct number of strategies are attempted based on table name format
        """
        call_count = 0

        def count_calls(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return None  # Always return None to force all strategies to be tried

        with patch(
            "metadata.ingestion.source.database.clickhouse.lineage.get_table_entities_from_query",
            side_effect=count_calls,
        ):

            self.clickhouse_source.get_clickhouse_table_entities_from_query(
                metadata=self.mock_metadata,
                service_name="test_service",
                database_name="test_db",
                database_schema="default",
                table_name=table_name,
            )

            assert call_count == expected_strategies_attempted

    def test_schema_table_parsing_logic(self):
        """
        Test that schema.table names are correctly parsed and used in strategies
        """
        mock_calls = []

        def track_calls(
            metadata, service_name, database_name, database_schema, table_name
        ):
            mock_calls.append(
                {
                    "database_name": database_name,
                    "database_schema": database_schema,
                    "table_name": table_name,
                }
            )
            return None  # Force all strategies to be tried

        with patch(
            "metadata.ingestion.source.database.clickhouse.lineage.get_table_entities_from_query",
            side_effect=track_calls,
        ):

            self.clickhouse_source.get_clickhouse_table_entities_from_query(
                metadata=self.mock_metadata,
                service_name="test_service",
                database_name="original_db",
                database_schema="original_schema",
                table_name="my_schema.my_table",
            )

            # Verify strategy calls
            assert len(mock_calls) == 5

            # Strategy 1: Original
            assert mock_calls[0] == {
                "database_name": "original_db",
                "database_schema": "original_schema",
                "table_name": "my_schema.my_table",
            }

            # Strategy 2a: Parsed schema as database_schema
            assert mock_calls[1] == {
                "database_name": "original_db",
                "database_schema": "my_schema",
                "table_name": "my_table",
            }

            # Strategy 2b: Parsed schema as database_name
            assert mock_calls[2] == {
                "database_name": "my_schema",
                "database_schema": "original_schema",
                "table_name": "my_table",
            }

            # Strategy 3: Base table name
            assert mock_calls[3] == {
                "database_name": "original_db",
                "database_schema": "original_schema",
                "table_name": "my_table",
            }

            # Strategy 4: Uppercase variant
            assert mock_calls[4] == {
                "database_name": "original_db",
                "database_schema": "original_schema",
                "table_name": "MY_SCHEMA.MY_TABLE",
            }

    def test_case_variations_attempted(self):
        """
        Test that case variations are correctly attempted for table names
        """
        mock_calls = []

        def track_calls(
            metadata, service_name, database_name, database_schema, table_name
        ):
            mock_calls.append(table_name)
            return None  # Force all strategies to be tried

        with patch(
            "metadata.ingestion.source.database.clickhouse.lineage.get_table_entities_from_query",
            side_effect=track_calls,
        ):

            # Test with mixed case table name
            self.clickhouse_source.get_clickhouse_table_entities_from_query(
                metadata=self.mock_metadata,
                service_name="test_service",
                database_name="test_db",
                database_schema="default",
                table_name="MixedCase_Table",
            )

            # Should try original, lowercase, and uppercase
            table_names_tried = [call for call in mock_calls]
            assert "MixedCase_Table" in table_names_tried  # Original
            assert "mixedcase_table" in table_names_tried  # Lowercase
            assert "MIXEDCASE_TABLE" in table_names_tried  # Uppercase

    def test_early_termination_on_success(self):
        """
        Test that the method returns immediately when a strategy succeeds
        """
        mock_entity = [Mock(name="found_table")]
        call_count = 0

        def count_and_succeed_on_second(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 2:  # Succeed on second strategy
                return mock_entity
            return None

        with patch(
            "metadata.ingestion.source.database.clickhouse.lineage.get_table_entities_from_query",
            side_effect=count_and_succeed_on_second,
        ):

            result = self.clickhouse_source.get_clickhouse_table_entities_from_query(
                metadata=self.mock_metadata,
                service_name="test_service",
                database_name="test_db",
                database_schema="default",
                table_name="schema.table_test",
            )

            assert result == mock_entity
            assert call_count == 2  # Should stop after second strategy succeeds

    def test_logging_on_failure(self):
        """
        Test that appropriate warning is logged when all strategies fail
        """
        with patch(
            "metadata.ingestion.source.database.clickhouse.lineage.get_table_entities_from_query",
            return_value=None,
        ), patch(
            "metadata.ingestion.source.database.clickhouse.lineage.logger"
        ) as mock_logger:

            result = self.clickhouse_source.get_clickhouse_table_entities_from_query(
                metadata=self.mock_metadata,
                service_name="test_service",
                database_name="test_db",
                database_schema="default",
                table_name="nonexistent.table",
            )

            assert result is None
            mock_logger.warning.assert_called_once()
            warning_message = mock_logger.warning.call_args[0][0]
            assert "Table entity [nonexistent.table] not found" in warning_message
            assert "test_service" in warning_message
            assert "test_db" in warning_message
            assert "default" in warning_message

    def test_simple_table_name_strategies(self):
        """
        Test that simple table names (no dots) still attempt case variations
        """
        mock_calls = []

        def track_calls(
            metadata, service_name, database_name, database_schema, table_name
        ):
            mock_calls.append(table_name)
            return None

        with patch(
            "metadata.ingestion.source.database.clickhouse.lineage.get_table_entities_from_query",
            side_effect=track_calls,
        ):

            self.clickhouse_source.get_clickhouse_table_entities_from_query(
                metadata=self.mock_metadata,
                service_name="test_service",
                database_name="test_db",
                database_schema="default",
                table_name="simpletable",
            )

            # Should try original and uppercase (lowercase would be same as original)
            assert "simpletable" in mock_calls
            assert "SIMPLETABLE" in mock_calls
            assert len(mock_calls) == 2  # No schema parsing strategies for simple names

    def test_clickhouse_specific_database_schema_handling(self):
        """
        Test that Clickhouse's database-as-schema architecture is properly handled
        """
        mock_calls = []

        def track_database_schema_calls(
            metadata, service_name, database_name, database_schema, table_name
        ):
            mock_calls.append(
                {
                    "database_name": database_name,
                    "database_schema": database_schema,
                    "table_name": table_name,
                }
            )
            return None

        with patch(
            "metadata.ingestion.source.database.clickhouse.lineage.get_table_entities_from_query",
            side_effect=track_database_schema_calls,
        ):

            self.clickhouse_source.get_clickhouse_table_entities_from_query(
                metadata=self.mock_metadata,
                service_name="test_service",
                database_name="original_db",
                database_schema="original_schema",
                table_name="my_database.my_table",
            )

            # Find the strategy that uses parsed schema as database_name
            database_strategy = next(
                call
                for call in mock_calls
                if call["database_name"] == "my_database"
                and call["table_name"] == "my_table"
            )

            assert database_strategy["database_name"] == "my_database"
            assert database_strategy["database_schema"] == "original_schema"
            assert database_strategy["table_name"] == "my_table"

            # This handles Clickhouse's flexible database/schema naming
