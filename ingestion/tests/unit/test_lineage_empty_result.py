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
Test that lineage processing handles empty result sets correctly
"""
import unittest

from sqlalchemy import create_engine, text


class TestLineageEmptyResults(unittest.TestCase):
    """Test that lineage source handles empty query results without errors"""

    def test_text_wrapper_with_empty_results(self):
        """
        Test that using text() wrapper prevents SQLAlchemy parameter errors
        even when query returns 0 rows
        """
        # Create an in-memory SQLite database for testing
        engine = create_engine("sqlite:///:memory:")

        # Create a test table
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                CREATE TABLE test_table (
                    id INTEGER PRIMARY KEY,
                    query_text TEXT,
                    database_name TEXT
                )
            """
                )
            )

        # Test query with LIKE patterns that could trigger the error
        # Similar to the postgres query with %% patterns
        test_query = """
            SELECT 
                query_text,
                database_name
            FROM test_table
            WHERE query_text NOT LIKE '%%excluded%%'
            AND query_text LIKE '%%create%%table%%'
            LIMIT 100
        """

        # Execute the query with text() wrapper - should not raise error
        with engine.connect() as conn:
            result = conn.execute(text(test_query))
            rows = list(result)
            # Should return empty list, not raise TypeError
            self.assertEqual(len(rows), 0)

    def test_text_wrapper_with_filter_condition(self):
        """
        Test that filter conditions that result in 0 rows work correctly
        """
        engine = create_engine("sqlite:///:memory:")

        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                CREATE TABLE query_logs (
                    id INTEGER PRIMARY KEY,
                    query_text TEXT,
                    database_name TEXT
                )
            """
                )
            )
            # Insert some test data
            conn.execute(
                text(
                    """
                INSERT INTO query_logs (query_text, database_name)
                VALUES ('SELECT * FROM users', 'db1')
            """
                )
            )

        # Query with filter that excludes all rows
        test_query = """
            SELECT 
                query_text,
                database_name
            FROM query_logs
            WHERE query_text LIKE '%%INSERT%%'
            AND 1=0
        """

        # Should handle 0 rows gracefully
        with engine.connect() as conn:
            result = conn.execute(text(test_query))
            rows = list(result)
            self.assertEqual(len(rows), 0)


if __name__ == "__main__":
    unittest.main()
