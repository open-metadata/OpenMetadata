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
"""MSSQL synonym discovery unit tests"""

from metadata.ingestion.source.database.mssql.models import (
    MssqlSynonym,
    MssqlSynonymTarget,
    SynonymUnresolvedReason,
)
from metadata.ingestion.source.database.mssql.queries import MSSQL_GET_SYNONYMS
from metadata.ingestion.source.database.mssql.synonyms import (
    parse_base_object_name,
    split_sql_server_identifier,
)


def test_synonym_query_targets_a_named_database():
    rendered = MSSQL_GET_SYNONYMS.format(database_name="analytics_core")

    assert "[analytics_core].sys.synonyms" in rendered
    assert "base_object_name" in rendered


def test_synonym_model_fields():
    synonym = MssqlSynonym(
        synonym_schema="dbo",
        synonym_name="orders",
        base_object_name="[analytics_master].[dbo].[orders]",
    )

    assert synonym.synonym_schema == "dbo"
    assert synonym.base_object_name == "[analytics_master].[dbo].[orders]"


def test_unresolved_reason_values():
    assert SynonymUnresolvedReason.REMOTE_TARGET_UNMAPPED.value == "RemoteTargetUnmapped"
    assert SynonymUnresolvedReason.UNSUPPORTED_TARGET_TYPE.value == "UnsupportedTargetType"
    assert SynonymUnresolvedReason.UNRESOLVED.value == "Unresolved"


def test_synonym_target_fields():
    target = MssqlSynonymTarget(database="analytics_master", schema_name="dbo", table="orders")

    assert (target.database, target.schema_name, target.table) == ("analytics_master", "dbo", "orders")


class TestSplitSqlServerIdentifier:
    def test_plain_three_part(self):
        assert split_sql_server_identifier("db.dbo.orders") == ["db", "dbo", "orders"]

    def test_bracket_quoted(self):
        assert split_sql_server_identifier("[db].[dbo].[orders]") == ["db", "dbo", "orders"]

    def test_dot_inside_brackets_is_not_a_separator(self):
        assert split_sql_server_identifier("[my.db].[dbo].[order.items]") == [
            "my.db",
            "dbo",
            "order.items",
        ]

    def test_escaped_closing_bracket(self):
        assert split_sql_server_identifier("[we[ird]]name]") == ["we[ird]name"]

    def test_omitted_middle_part_yields_empty_string(self):
        assert split_sql_server_identifier("db..orders") == ["db", "", "orders"]

    def test_mixed_quoting(self):
        assert split_sql_server_identifier("db.[dbo].orders") == ["db", "dbo", "orders"]


class TestParseBaseObjectName:
    def test_three_part_name(self):
        target, reason = parse_base_object_name("[analytics_master].[dbo].[orders]", "analytics_core")

        assert reason is None
        assert (target.database, target.schema_name, target.table) == (
            "analytics_master",
            "dbo",
            "orders",
        )

    def test_two_part_name_inherits_the_synonym_database(self):
        target, reason = parse_base_object_name("[sales].[orders]", "analytics_core")

        assert reason is None
        assert (target.database, target.schema_name, target.table) == (
            "analytics_core",
            "sales",
            "orders",
        )

    def test_one_part_name_inherits_database_and_defaults_schema(self):
        target, reason = parse_base_object_name("orders", "analytics_core")

        assert reason is None
        assert (target.database, target.schema_name, target.table) == (
            "analytics_core",
            "dbo",
            "orders",
        )

    def test_omitted_schema_defaults_to_dbo(self):
        target, reason = parse_base_object_name("[analytics_master]..[orders]", "analytics_core")

        assert reason is None
        assert (target.database, target.schema_name, target.table) == (
            "analytics_master",
            "dbo",
            "orders",
        )

    def test_four_part_name_is_remote(self):
        target, reason = parse_base_object_name("[LINKED].[analytics_master].[dbo].[orders]", "analytics_core")

        assert target is None
        assert reason is SynonymUnresolvedReason.REMOTE_TARGET_UNMAPPED

    def test_four_part_name_with_empty_server_is_local(self):
        target, reason = parse_base_object_name("[].[analytics_master].[dbo].[orders]", "analytics_core")

        assert reason is None
        assert target.database == "analytics_master"

    def test_case_is_preserved(self):
        target, reason = parse_base_object_name("[Analytics_Master].[DBO].[Orders]", "analytics_core")

        assert reason is None
        assert (target.database, target.schema_name, target.table) == (
            "Analytics_Master",
            "DBO",
            "Orders",
        )

    def test_empty_name_is_unresolved(self):
        target, reason = parse_base_object_name("", "analytics_core")

        assert target is None
        assert reason is SynonymUnresolvedReason.UNRESOLVED

    def test_too_many_parts_is_unresolved(self):
        target, reason = parse_base_object_name("a.b.c.d.e", "analytics_core")

        assert target is None
        assert reason is SynonymUnresolvedReason.UNRESOLVED

    def test_empty_table_name_is_unresolved(self):
        target, reason = parse_base_object_name("[db].[dbo].[]", "analytics_core")

        assert target is None
        assert reason is SynonymUnresolvedReason.UNRESOLVED
