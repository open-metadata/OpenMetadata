#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
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

from metadata.generated.schema.entity.data.table import Table
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
            fqn.split('a"')

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
        assert split_fqn.schema == "dbt_jaffle"
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
