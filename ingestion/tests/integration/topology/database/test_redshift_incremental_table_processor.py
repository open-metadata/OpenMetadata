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
Check incremental extraction
"""

import random
from datetime import datetime
from unittest import TestCase
from unittest.mock import create_autospec, patch

from sqlalchemy.engine import Connection

from metadata.ingestion.source.database.redshift.incremental_table_processor import (
    RedshiftIncrementalTableProcessor,
)

VALID_CREATE_TABLE_STATEMENT_TEMPLATES = [
    # Simple Create Table
    "CREATE TABLE {table_name} (column_1 VARCHAR(255))",
    # Multiple Columns
    "CREATE TABLE {table_name} (column_1 VARCHAR(255), column_2 INT)",
    # Create As
    "CREATE TABLE {table_name} AS (SELECT * FROM other_table)",
    # Weird Case
    "creaTE TaBlE {table_name} (column_1 VARChaR(255))",
    # Weird spacing
    "   \tCREATE  \n  TABLE  {table_name}  (column_1   VARCHAR(255))   ",
    # If not Exists
    "CREATE TABLE IF NOT EXISTS {table_name} (column_1 VARCHAR(255))",
    # External Table
    "CREATE EXTERNAL TABLE {table_name} (column_1 VARCHAR(255))",
    # Local Table
    "CREATE LOCAL TABLE {table_name} (column_1 VARCHAR(255))",
    # Temporary Table
    "CREATE TEMPORARY TABLE {table_name} (column_1 VARCHAR(255))",
    # Temp Table
    "CREATE TEMP TABLE {table_name} (column_1 VARCHAR(255))",
]

VALID_ALTER_TABLE_STATEMENT_TEMPLATES = [
    # Add new trable constraint
    "ALTER TABLE {table_name} ADD CONSTRAINT constraint UNIQUE column_1",
    # Alter Column Type
    "ALTER TABLE {table_name} ALTER COLUMN column_1 TYPE varchar(1000)",
    # Alter DistKey
    "ALTER TABLE {table_name} ALTER DISTKEY column_1",
    # Add Column
    "ALTER TABLE {table_name} ADD COLUMN column_3 INT",
    # Drop Column
    "ALTER TABLE {table_name} DROP COLUMN column_1",
    # Set Location
    "ALTER TABLE {table_name} SET LOCATION {{ 's3://bucket/folder/' }}",
    # Weird Case
    "alTeR TaBlE {table_name} OwNeR tO new_owner",
    # Weird spacing
    "   \tALTER  \n  TABLE  {table_name}  OWNER  TO          \n new_owner \t\n\v",
]

VALID_DROP_TABLE_STATEMENT_TEMPLATES = [
    # Simple Drop Table
    "DROP TABLE {table_name}",
    # Drop Table - Cascade
    "DROP TABLE {table_name} CASCADE",
    # Drop Table - Restrict
    "DROP TABLE {table_name} RESTRICT",
    # If Exists
    "DROP TABLE IF EXISTS {table_name}",
    # Weird Case
    "DrOP TaBlE If EXIstS {table_name}",
    # Weird spacing
    "   \tDROP \n  TABLE  {table_name}\n\t\n\v",
]

VALID_CREATE_VIEW_STATEMENT_TEMPLATES = [
    # Simple Create View
    "CREATE VIEW {table_name} AS SELECT * FROM other_table",
    # Create View with Column Names
    "CREATE VIEW {table_name} (column_1) AS SELECT column_2 FROM other_table",
    # Create or Replace View
    "CREATE OR REPLACE VIEW {table_name} AS SELECT * FROM other_table",
    # External View
    "CREATE EXTERNAL VIEW {table_name} IF NOT EXISTS AS SELECT * FROM other_table",
    # Materialized View
    "CREATE MATERIALIZED VIEW {table_name} AS SELECT * FROM other_table",
    # Weird Case
    "creaTE VIEW {table_name} As SELect * FroM other_table",
    # Weird spacing
    "   \tCREATE  \n  VIEW  {table_name}   AS SELECT     * FROM other_table   ",
]

VALID_ALTER_VIEW_STATEMENT_TEMPLATES = [
    # Simple Alter View
    "ALTER VIEW {table_name} AS SELECT * FROM other_table",
    # External View
    "ALTER EXTERNAL VIEW {table_name} AS SELECT * FROM other_table",
    # Force
    "ALTER EXTERNAL VIEW {table_name} FORCE AS SELECT * FROM other_table",
    # Weird Case
    "alTeR ExtERNAL VIEw {table_name} As SElect * froM other_table",
    # Weird spacing
    "   \tALTER  \n  EXTERNAL    VIEW  {table_name}  SELECt\n * FROM\n\n other_table \t\n",
]

VALID_DROP_VIEW_STATEMENT_TEMPLATES = [
    # Simple Drop
    "DROP VIEW {table_name}",
    # If Exists
    "DROP VIEW IF EXISTS {table_name}",
    # Cascade
    "DROP VIEW {table_name} CASCADE",
    # External
    "DROP EXTERNAL VIEW {table_name}",
    # Materialized
    "DROP MATERIALIZED VIEW {table_name}",
    # Weird Case
    "DrOP view If EXIstS {table_name}",
    # Weird spacing
    "   \tDROP \n  VIEW  {table_name}\n\t\n\v",
]

VALID_COMMENT_STATEMENT_TEMPLATES = [
    # Simple Comment
    "COMMENT ON TABLE {table_name} IS NULL",
    # View
    "COMMENT ON VIEW {table_name} IS 'lorem ipsum'",
    # Weird Case
    "CommENT on TAble {table_name} is NULL",
    # Weird spacing
    "   \tCOMMENT \n  ON VIEW  {table_name}\n\t\n IS 'lorem ipsum'",
]


class RedshiftIncrementalTableProcessorTest(TestCase):
    """Validate RedshiftIncrementalTableProcessor logic"""

    def test_create_table_regex_works_as_expected(self):
        """Check if the CREATE_TABLE regex works as expected."""
        for template in VALID_CREATE_TABLE_STATEMENT_TEMPLATES:
            print(f"{template}")
            return_value = [template.format(table_name="my_schema.my_table")]

            with patch.object(
                RedshiftIncrementalTableProcessor,
                "_query_for_changes",
                return_value=return_value,
            ):
                processor = RedshiftIncrementalTableProcessor.create(
                    create_autospec(Connection), "default_schema"
                )
                processor.set_table_map("my_database", datetime(2020, 1, 1))

                self.assertEqual(processor.get_not_deleted("my_schema"), ["my_table"])
                self.assertEqual(processor.get_not_deleted("other_schema"), [])
                self.assertEqual(processor.get_deleted("my_schema"), [])
                self.assertEqual(processor.get_deleted("other_schema"), [])

    def test_alter_table_regex_works_as_expected(self):
        """Check if the ALTER_TABLE regex works as expected."""
        for template in VALID_ALTER_TABLE_STATEMENT_TEMPLATES:
            print(f"{template}")
            return_value = [template.format(table_name="my_schema.my_table")]

            with patch.object(
                RedshiftIncrementalTableProcessor,
                "_query_for_changes",
                return_value=return_value,
            ):
                processor = RedshiftIncrementalTableProcessor.create(
                    create_autospec(Connection), "default_schema"
                )
                processor.set_table_map("my_database", datetime(2020, 1, 1))

                self.assertEqual(processor.get_not_deleted("my_schema"), ["my_table"])
                self.assertEqual(processor.get_not_deleted("other_schema"), [])
                self.assertEqual(processor.get_deleted("my_schema"), [])
                self.assertEqual(processor.get_deleted("other_schema"), [])

    def test_drop_table_regex_works_as_expected(self):
        """Check if the DROP_TABLE regex works as expected."""
        for template in VALID_DROP_TABLE_STATEMENT_TEMPLATES:
            print(f"{template}")
            return_value = [template.format(table_name="my_schema.my_table")]

            with patch.object(
                RedshiftIncrementalTableProcessor,
                "_query_for_changes",
                return_value=return_value,
            ):
                processor = RedshiftIncrementalTableProcessor.create(
                    create_autospec(Connection), "default_schema"
                )
                processor.set_table_map("my_database", datetime(2020, 1, 1))

                self.assertEqual(processor.get_not_deleted("my_schema"), [])
                self.assertEqual(processor.get_not_deleted("other_schema"), [])
                self.assertEqual(
                    processor.get_deleted("my_schema"), [("my_schema", "my_table")]
                )
                self.assertEqual(processor.get_deleted("other_schema"), [])

    def test_create_view_regex_works_as_expected(self):
        """Check if the CREATE_VIEW regex works as expected."""
        for template in VALID_CREATE_VIEW_STATEMENT_TEMPLATES:
            print(f"{template}")
            return_value = [template.format(table_name="my_schema.my_table")]

            with patch.object(
                RedshiftIncrementalTableProcessor,
                "_query_for_changes",
                return_value=return_value,
            ):
                processor = RedshiftIncrementalTableProcessor.create(
                    create_autospec(Connection), "default_schema"
                )
                processor.set_table_map("my_database", datetime(2020, 1, 1))

                self.assertEqual(processor.get_not_deleted("my_schema"), ["my_table"])
                self.assertEqual(processor.get_not_deleted("other_schema"), [])
                self.assertEqual(processor.get_deleted("my_schema"), [])
                self.assertEqual(processor.get_deleted("other_schema"), [])

    def test_alter_view_regex_works_as_expected(self):
        """Check if the ALTER_VIEW regex works as expected."""
        for template in VALID_ALTER_VIEW_STATEMENT_TEMPLATES:
            print(f"{template}")
            return_value = [template.format(table_name="my_schema.my_table")]

            with patch.object(
                RedshiftIncrementalTableProcessor,
                "_query_for_changes",
                return_value=return_value,
            ):
                processor = RedshiftIncrementalTableProcessor.create(
                    create_autospec(Connection), "default_schema"
                )
                processor.set_table_map("my_database", datetime(2020, 1, 1))

                self.assertEqual(processor.get_not_deleted("my_schema"), ["my_table"])
                self.assertEqual(processor.get_not_deleted("other_schema"), [])
                self.assertEqual(processor.get_deleted("my_schema"), [])
                self.assertEqual(processor.get_deleted("other_schema"), [])

    def test_drop_view_regex_works_as_expected(self):
        """Check if the DROP_VIEW regex works as expected."""
        for template in VALID_DROP_VIEW_STATEMENT_TEMPLATES:
            print(f"{template}")
            return_value = [template.format(table_name="my_schema.my_table")]

            with patch.object(
                RedshiftIncrementalTableProcessor,
                "_query_for_changes",
                return_value=return_value,
            ):
                processor = RedshiftIncrementalTableProcessor.create(
                    create_autospec(Connection), "default_schema"
                )
                processor.set_table_map("my_database", datetime(2020, 1, 1))

                self.assertEqual(processor.get_not_deleted("my_schema"), [])
                self.assertEqual(processor.get_not_deleted("other_schema"), [])
                self.assertEqual(
                    processor.get_deleted("my_schema"), [("my_schema", "my_table")]
                )
                self.assertEqual(processor.get_deleted("other_schema"), [])

    def test_comment_regex_works_as_expected(self):
        """Check if the COMMENT regex works as expected."""
        for template in VALID_COMMENT_STATEMENT_TEMPLATES:
            print(f"{template}")
            return_value = [template.format(table_name="my_schema.my_table")]

            with patch.object(
                RedshiftIncrementalTableProcessor,
                "_query_for_changes",
                return_value=return_value,
            ):
                processor = RedshiftIncrementalTableProcessor.create(
                    create_autospec(Connection), "default_schema"
                )
                processor.set_table_map("my_database", datetime(2020, 1, 1))

                self.assertEqual(processor.get_not_deleted("my_schema"), ["my_table"])
                self.assertEqual(processor.get_not_deleted("other_schema"), [])
                self.assertEqual(processor.get_deleted("my_schema"), [])
                self.assertEqual(processor.get_deleted("other_schema"), [])

    def test_default_schema_works_as_expected(self):
        """Check if when no schema is present in the table name, the default_schema is used."""
        return_value = [
            VALID_CREATE_TABLE_STATEMENT_TEMPLATES[0].format(table_name="my_table")
        ]

        with patch.object(
            RedshiftIncrementalTableProcessor,
            "_query_for_changes",
            return_value=return_value,
        ):
            processor = RedshiftIncrementalTableProcessor.create(
                create_autospec(Connection), "default_schema"
            )
            processor.set_table_map("my_database", datetime(2020, 1, 1))

            self.assertEqual(processor.get_not_deleted("default_schema"), ["my_table"])

    def test_no_duplicates_are_allowed(self):
        """Checks if only the first time table is seen it is saved."""
        return_value = []
        for template in [
            VALID_DROP_TABLE_STATEMENT_TEMPLATES[0]
        ] + VALID_CREATE_TABLE_STATEMENT_TEMPLATES:
            return_value.append(template.format(table_name="my_schema.my_table"))

        with patch.object(
            RedshiftIncrementalTableProcessor,
            "_query_for_changes",
            return_value=return_value,
        ):
            processor = RedshiftIncrementalTableProcessor.create(
                create_autospec(Connection), "default_schema"
            )
            processor.set_table_map("my_database", datetime(2020, 1, 1))

            self.assertEqual(
                processor.get_deleted("my_schema"), [("my_schema", "my_table")]
            )
            self.assertEqual(processor.get_not_deleted("my_schema"), [])

    def test_bulk(self):
        """Check if the result is as expected from many tables."""

        table_names = [
            # schema_1
            "schema_1.table_1",
            "schema_1.table_2",
            "schema_1.table_3",
            "my_database.schema_1.table_4",
            # schema_2
            "schema_2.table_1",
            # default_schema
            "table_1",
            "table_2",
            # schema_3
            "my_database.schema_3.table_1",
            "my_database.schema_3.table_2",
            "my_database.schema_3.table_4",
        ]

        templates = [
            *VALID_CREATE_TABLE_STATEMENT_TEMPLATES,
            *VALID_ALTER_TABLE_STATEMENT_TEMPLATES,
            *VALID_DROP_TABLE_STATEMENT_TEMPLATES,
            *VALID_CREATE_VIEW_STATEMENT_TEMPLATES,
            *VALID_ALTER_VIEW_STATEMENT_TEMPLATES,
            *VALID_DROP_VIEW_STATEMENT_TEMPLATES,
            *VALID_COMMENT_STATEMENT_TEMPLATES,
        ]

        random.shuffle(templates)

        return_value = [
            template.format(table_name=random.choice(table_names))
            for template in templates
        ]

        with patch.object(
            RedshiftIncrementalTableProcessor,
            "_query_for_changes",
            return_value=return_value,
        ):
            processor = RedshiftIncrementalTableProcessor.create(
                create_autospec(Connection), "default_schema"
            )
            processor.set_table_map("my_database", datetime(2020, 1, 1))

            # schema_1
            self.assertLessEqual(
                len(
                    processor.get_deleted("schema_1")
                    + processor.get_not_deleted("schema_1")
                ),
                4,
            )

            self.assertTrue(
                all(
                    table_name in ["table_1", "table_2", "table_3", "table_4"]
                    for table_name in (processor.get_not_deleted("schema_1"))
                )
            )

            self.assertTrue(
                all(
                    table_name in ["table_1", "table_2", "table_3", "table_4"]
                    for (_, table_name) in (processor.get_deleted("schema_1"))
                )
            )

            # schema_2
            self.assertLessEqual(
                len(
                    processor.get_deleted("schema_2")
                    + processor.get_not_deleted("schema_2")
                ),
                1,
            )

            self.assertTrue(
                all(
                    table_name == "table_1"
                    for table_name in (processor.get_not_deleted("schema_2"))
                )
            )

            self.assertTrue(
                all(
                    table_name == "table_1"
                    for (_, table_name) in (processor.get_deleted("schema_2"))
                )
            )

            # schema_3
            self.assertLessEqual(
                len(
                    processor.get_deleted("schema_3")
                    + processor.get_not_deleted("schema_3")
                ),
                3,
            )

            self.assertTrue(
                all(
                    table_name in ["table_1", "table_2", "table_4"]
                    for table_name in (processor.get_not_deleted("schema_3"))
                )
            )

            self.assertTrue(
                all(
                    table_name in ["table_1", "table_2", "table_4"]
                    for (_, table_name) in (processor.get_deleted("schema_3"))
                )
            )

            # default_schema
            self.assertLessEqual(
                len(
                    processor.get_deleted("default_schema")
                    + processor.get_not_deleted("default_schema")
                ),
                2,
            )

            self.assertTrue(
                all(
                    table_name in ["table_1", "table_2"]
                    for table_name in (processor.get_not_deleted("default_schema"))
                )
            )

            self.assertTrue(
                all(
                    table_name in ["table_1", "table_2"]
                    for (_, table_name) in (processor.get_deleted("default_schema"))
                )
            )
