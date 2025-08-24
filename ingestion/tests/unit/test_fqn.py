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
Test FQN build behavior
"""
from unittest import TestCase
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.models.custom_basemodel_validation import (
    RESERVED_ARROW_KEYWORD,
    RESERVED_COLON_KEYWORD,
    RESERVED_QUOTE_KEYWORD,
)
from metadata.ingestion.ometa.utils import quote
from metadata.utils import fqn


class TestFqn(TestCase):
    """
    Validate FQN building
    """

    def test_split(self):
        this = self

        class FQNTest:
            """
            Test helper class
            """

            def __init__(self, parts, fqn):
                self.parts = parts
                self.fqn = fqn

            def validate(self, actual_parts, actual_fqn):
                this.assertEqual(self.fqn, actual_fqn)
                this.assertEqual(len(self.parts), len(actual_parts))

                for i in range(len(self.parts)):
                    if "." in self.parts[i]:
                        this.assertEqual(fqn.quote_name(self.parts[i]), actual_parts[i])
                    else:
                        this.assertEqual(self.parts[i], actual_parts[i])

        xs = [
            FQNTest(["a", "b", "c", "d"], "a.b.c.d"),
            FQNTest(["a.1", "b", "c", "d"], '"a.1".b.c.d'),
            FQNTest(["a", "b.2", "c", "d"], 'a."b.2".c.d'),
            FQNTest(["a", "b", "c.3", "d"], 'a.b."c.3".d'),
            FQNTest(["a", "b", "c", "d.4"], 'a.b.c."d.4"'),
            FQNTest(["a.1", "b.2", "c", "d"], '"a.1"."b.2".c.d'),
            FQNTest(["a.1", "b.2", "c.3", "d"], '"a.1"."b.2"."c.3".d'),
            FQNTest(["a.1", "b.2", "c.3", "d.4"], '"a.1"."b.2"."c.3"."d.4"'),
            FQNTest(["fqn", "test.test.test"], 'fqn."test.test.test"'),
            FQNTest(["fqn", "testtesttest"], "fqn.testtesttest"),
            FQNTest(["fqn", "testtes ttest"], "fqn.testtes ttest"),
        ]
        for x in xs:
            x.validate(fqn.split(x.fqn), fqn._build(*x.parts))

    def test_quote_name(self):
        """
        Make sure that fqns are properly quoted
        """
        # Unquote_named name remains unquote_named
        self.assertEqual("a", fqn.quote_name("a"))
        # Add quote_names when "." exists in the name
        self.assertEqual('"a.b"', fqn.quote_name("a.b"))
        # Leave existing valid quote_names
        self.assertEqual('"a.b"', fqn.quote_name('"a.b"'))
        # Remove quote_names when not needed
        self.assertEqual("a", fqn.quote_name('"a"'))

        with self.assertRaises(Exception) as context:
            fqn.quote_name('"a')
        self.assertEqual('Invalid name "a', str(context.exception))
        with self.assertRaises(Exception) as context:
            fqn.quote_name('a"')
        self.assertEqual('Invalid name a"', str(context.exception))
        with self.assertRaises(Exception) as context:
            fqn.quote_name('a"b')
        self.assertEqual('Invalid name a"b', str(context.exception))

    def test_invalid(self):
        with self.assertRaises(Exception):
            fqn.split('a.."')

    def test_build_table(self):
        """
        Validate Table FQN building
        """
        mocked_metadata = MagicMock()
        mocked_metadata.es_search_from_fqn.return_value = None
        table_fqn = fqn.build(
            metadata=mocked_metadata,
            entity_type=Table,
            service_name="service",
            database_name="db",
            schema_name="schema",
            table_name="table",
        )
        self.assertEqual(table_fqn, "service.db.schema.table")

        table_fqn_dots = fqn.build(
            metadata=mocked_metadata,
            entity_type=Table,
            service_name="service",
            database_name="data.base",
            schema_name="schema",
            table_name="table",
        )
        self.assertEqual(table_fqn_dots, 'service."data.base".schema.table')

        table_fqn_space = fqn.build(
            metadata=mocked_metadata,
            entity_type=Table,
            service_name="service",
            database_name="data base",
            schema_name="schema",
            table_name="table",
        )
        self.assertEqual(table_fqn_space, "service.data base.schema.table")

    def test_split_test_case_fqn(self):
        """test for split test case"""
        split_fqn = fqn.split_test_case_fqn(
            "local_redshift.dev.dbt_jaffle.customers.customer_id.expect_column_max_to_be_between"
        )

        assert split_fqn.service == "local_redshift"
        assert split_fqn.database == "dev"
        assert split_fqn.schema_ == "dbt_jaffle"
        assert split_fqn.table == "customers"
        assert split_fqn.column == "customer_id"
        assert split_fqn.test_case == "expect_column_max_to_be_between"

        split_fqn = fqn.split_test_case_fqn(
            "local_redshift.dev.dbt_jaffle.customers.expect_table_column_to_be_between"
        )

        assert not split_fqn.column
        assert split_fqn.test_case == "expect_table_column_to_be_between"

        with pytest.raises(ValueError):
            fqn.split_test_case_fqn("local_redshift.dev.dbt_jaffle.customers")

    def test_quote_fqns(self):
        """We can properly quote FQNs for URL usage"""
        assert quote(FullyQualifiedEntityName("a.b.c")) == "a.b.c"
        # Works with strings directly
        assert quote("a.b.c") == "a.b.c"
        assert quote(FullyQualifiedEntityName('"foo.bar".baz')) == "%22foo.bar%22.baz"
        assert quote('"foo.bar/baz".hello') == "%22foo.bar%2Fbaz%22.hello"

    def test_table_with_quotes(self):
        """Test FQN building for table names containing quotes"""
        mocked_metadata = MagicMock()
        mocked_metadata.es_search_from_fqn.return_value = None

        table_name = 'users "2024"'
        result = fqn.build(
            metadata=mocked_metadata,
            entity_type=Table,
            service_name="mysql",
            database_name="test_db",
            schema_name="public",
            table_name=table_name,
            skip_es_search=True,
        )

        expected = f"mysql.test_db.public.users {RESERVED_QUOTE_KEYWORD}2024{RESERVED_QUOTE_KEYWORD}"
        self.assertEqual(result, expected)

    def test_column_with_special_chars(self):
        """Test FQN building for column names with multiple special characters"""
        mocked_metadata = MagicMock()
        mocked_metadata.es_search_from_fqn.return_value = None

        column_name = 'data::type>"info"'
        result = fqn.build(
            metadata=mocked_metadata,
            entity_type=Column,
            service_name="postgres",
            database_name="analytics",
            schema_name="reporting",
            table_name="metrics",
            column_name=column_name,
        )

        expected = f"postgres.analytics.reporting.metrics.data{RESERVED_COLON_KEYWORD}type{RESERVED_ARROW_KEYWORD}{RESERVED_QUOTE_KEYWORD}info{RESERVED_QUOTE_KEYWORD}"
        self.assertEqual(result, expected)

    def test_both_table_and_column_special_chars(self):
        """Test FQN building when both table and column have special characters"""
        mocked_metadata = MagicMock()
        mocked_metadata.es_search_from_fqn.return_value = None

        table_name = "report::daily"
        column_name = 'value>"USD"'

        result = fqn.build(
            metadata=mocked_metadata,
            entity_type=Column,
            service_name="snowflake",
            database_name="warehouse",
            schema_name="analytics",
            table_name=table_name,
            column_name=column_name,
        )

        expected = f"snowflake.warehouse.analytics.report{RESERVED_COLON_KEYWORD}daily.value{RESERVED_ARROW_KEYWORD}{RESERVED_QUOTE_KEYWORD}USD{RESERVED_QUOTE_KEYWORD}"
        self.assertEqual(result, expected)

    def test_no_transformation_needed(self):
        """Test FQN building for names without special characters"""
        mocked_metadata = MagicMock()
        mocked_metadata.es_search_from_fqn.return_value = None

        result = fqn.build(
            metadata=mocked_metadata,
            entity_type=Table,
            service_name="mysql",
            database_name="test_db",
            schema_name="public",
            table_name="normal_table_name",
            skip_es_search=True,
        )

        self.assertEqual(result, "mysql.test_db.public.normal_table_name")

    def test_real_world_scenarios(self):
        """Test FQN building for real-world database scenarios"""
        mocked_metadata = MagicMock()
        mocked_metadata.es_search_from_fqn.return_value = None

        # Snowflake case-sensitive identifier
        snowflake_table = '"MixedCase_Table"'
        result1 = fqn.build(
            metadata=mocked_metadata,
            entity_type=Table,
            service_name="snowflake",
            database_name="ANALYTICS",
            schema_name="PUBLIC",
            table_name=snowflake_table,
            skip_es_search=True,
        )
        expected1 = f"snowflake.ANALYTICS.PUBLIC.{RESERVED_QUOTE_KEYWORD}MixedCase_Table{RESERVED_QUOTE_KEYWORD}"
        self.assertEqual(result1, expected1)

        # PostgreSQL type cast in column
        postgres_column = "created_at::timestamp"
        result2 = fqn.build(
            metadata=mocked_metadata,
            entity_type=Column,
            service_name="postgres",
            database_name="mydb",
            schema_name="public",
            table_name="events",
            column_name=postgres_column,
        )
        expected2 = (
            f"postgres.mydb.public.events.created_at{RESERVED_COLON_KEYWORD}timestamp"
        )
        self.assertEqual(result2, expected2)

        # BigQuery partition notation
        bigquery_table = 'events_2024$"daily"'
        result3 = fqn.build(
            metadata=mocked_metadata,
            entity_type=Table,
            service_name="bigquery",
            database_name="my-project",
            schema_name="dataset",
            table_name=bigquery_table,
            skip_es_search=True,
        )
        expected3 = f"bigquery.my-project.dataset.events_2024${RESERVED_QUOTE_KEYWORD}daily{RESERVED_QUOTE_KEYWORD}"
        self.assertEqual(result3, expected3)
