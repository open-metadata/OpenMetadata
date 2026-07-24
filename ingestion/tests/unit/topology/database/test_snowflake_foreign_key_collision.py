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
Unit tests for the Snowflake schema-level foreign key reflection.

Snowflake constraint names are unique per table, not per schema. Cloned tables
(CREATE TABLE ... CLONE / LIKE) copy the constraint name, so `SHOW IMPORTED KEYS
IN SCHEMA` can return the same fk_name for several tables. The reflection must key
constraints on (fk_name, table_name) so columns from different tables are not
merged into one constraint attached to the wrong table.
"""

from unittest import TestCase
from unittest.mock import Mock

from snowflake.sqlalchemy.snowdialect import SnowflakeDialect

from metadata.ingestion.source.database.snowflake.utils import (
    get_schema_foreign_keys,
)


def _fk_row(
    fk_name,
    fk_table_name,
    fk_column_name,
    pk_table_name,
    pk_column_name,
    pk_schema_name="SAMPLE_DATA",
    pk_database_name="DRP",
):
    row = Mock()
    row._mapping = {
        "fk_name": fk_name,
        "fk_table_name": fk_table_name,
        "fk_column_name": fk_column_name,
        "pk_schema_name": pk_schema_name,
        "pk_table_name": pk_table_name,
        "pk_column_name": pk_column_name,
        "pk_database_name": pk_database_name,
        "delete_rule": "NO ACTION",
        "update_rule": "NO ACTION",
    }
    return row


class SnowflakeForeignKeyCollisionTest(TestCase):
    def setUp(self):
        self.dialect = SnowflakeDialect()
        self.dialect.normalize_name = lambda x: x
        self.dialect.denormalize_name = lambda x: x
        self.dialect.default_schema_name = "PUBLIC"
        self.dialect._current_database_schema = lambda *args, **kwargs: ("DRP", "PUBLIC")
        self.mock_connection = Mock()

    def _run(self, rows):
        self.mock_connection.execute = Mock(return_value=rows)

        return get_schema_foreign_keys(self.dialect, self.mock_connection, "SAMPLE_DATA")

    def test_same_constraint_name_on_cloned_tables_does_not_merge(self):
        """A shared fk_name across two tables must yield two separate constraints."""
        rows = [
            _fk_row("SYS_FK", "CUSTOMER", "C_NATIONKEY", "NATION", "N_NATIONKEY"),
            _fk_row("SYS_FK", "SUPPLIER", "S_NATIONKEY", "NATION", "N_NATIONKEY"),
        ]

        result = self._run(rows)

        assert set(result.keys()) == {"CUSTOMER", "SUPPLIER"}
        assert result["CUSTOMER"][0]["constrained_columns"] == ["C_NATIONKEY"]
        assert result["SUPPLIER"][0]["constrained_columns"] == ["S_NATIONKEY"]

    def test_supplier_column_never_leaks_into_customer(self):
        """Regression: CUSTOMER must not acquire SUPPLIER's S_NATIONKEY column."""
        rows = [
            _fk_row("SYS_FK", "CUSTOMER", "C_NATIONKEY", "NATION", "N_NATIONKEY"),
            _fk_row("SYS_FK", "SUPPLIER", "S_NATIONKEY", "NATION", "N_NATIONKEY"),
        ]

        result = self._run(rows)

        assert "S_NATIONKEY" not in result["CUSTOMER"][0]["constrained_columns"]

    def test_multi_column_foreign_key_on_single_table_still_groups(self):
        """A genuine composite FK on one table keeps grouping its columns together."""
        rows = [
            _fk_row("PARTSUPP_FK", "PARTSUPP", "PS_PARTKEY", "PART", "P_PARTKEY"),
            _fk_row("PARTSUPP_FK", "PARTSUPP", "PS_SUPPKEY", "SUPPLIER", "S_SUPPKEY"),
        ]

        result = self._run(rows)

        assert list(result.keys()) == ["PARTSUPP"]
        constraint = result["PARTSUPP"][0]
        assert constraint["constrained_columns"] == ["PS_PARTKEY", "PS_SUPPKEY"]
        assert constraint["referred_columns"] == ["P_PARTKEY", "S_SUPPKEY"]

    def test_distinct_constraints_on_same_table_are_kept_separate(self):
        """Different fk_names on the same table remain two constraints."""
        rows = [
            _fk_row("FK_NATION", "CUSTOMER", "C_NATIONKEY", "NATION", "N_NATIONKEY"),
            _fk_row("FK_REGION", "CUSTOMER", "C_REGIONKEY", "REGION", "R_REGIONKEY"),
        ]

        result = self._run(rows)

        assert list(result.keys()) == ["CUSTOMER"]
        constrained = {c["name"]: c["constrained_columns"] for c in result["CUSTOMER"]}
        assert constrained == {
            "FK_NATION": ["C_NATIONKEY"],
            "FK_REGION": ["C_REGIONKEY"],
        }
