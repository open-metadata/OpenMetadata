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

from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.api.status import Status
from metadata.ingestion.source.database.mssql.metadata import MssqlSource
from metadata.ingestion.source.database.mssql.models import (
    MssqlSynonym,
    MssqlSynonymTarget,
    SynonymUnresolvedReason,
)
from metadata.ingestion.source.database.mssql.queries import MSSQL_GET_SYNONYMS
from metadata.ingestion.source.database.mssql.synonyms import (
    SynonymMap,
    build_synonym_map,
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


class TestSynonymMap:
    def test_aliases_are_returned_sorted(self):
        synonym_map = SynonymMap()
        synonym_map.add("svc.master.dbo.orders", "svc.z_core.dbo.orders")
        synonym_map.add("svc.master.dbo.orders", "svc.a_core.dbo.orders")

        assert synonym_map.aliases_for("svc.master.dbo.orders") == [
            "svc.a_core.dbo.orders",
            "svc.z_core.dbo.orders",
        ]

    def test_unknown_target_returns_none(self):
        assert SynonymMap().aliases_for("svc.master.dbo.orders") is None

    def test_duplicate_alias_is_stored_once(self):
        synonym_map = SynonymMap()
        synonym_map.add("svc.master.dbo.orders", "svc.core.dbo.orders")
        synonym_map.add("svc.master.dbo.orders", "svc.core.dbo.orders")

        assert synonym_map.aliases_for("svc.master.dbo.orders") == ["svc.core.dbo.orders"]

    def test_consumed_target_is_not_reported_unresolved(self):
        synonym_map = SynonymMap()
        synonym_map.add("svc.master.dbo.orders", "svc.core.dbo.orders")
        synonym_map.aliases_for("svc.master.dbo.orders")

        assert synonym_map.unresolved() == []

    def test_unconsumed_target_is_reported_unresolved(self):
        synonym_map = SynonymMap()
        synonym_map.add("svc.master.dbo.orders", "svc.core.dbo.orders")

        assert synonym_map.unresolved() == [("svc.core.dbo.orders", SynonymUnresolvedReason.UNRESOLVED.value)]

    def test_explicitly_recorded_unresolved_is_reported(self):
        synonym_map = SynonymMap()
        synonym_map.record_unresolved("svc.core.dbo.remote_orders", SynonymUnresolvedReason.REMOTE_TARGET_UNMAPPED)

        assert synonym_map.unresolved() == [("svc.core.dbo.remote_orders", "RemoteTargetUnmapped")]

    def test_cap_rejects_further_entries(self):
        synonym_map = SynonymMap(max_entries=2)

        assert synonym_map.add("svc.master.dbo.a", "svc.core.dbo.a") is True
        assert synonym_map.add("svc.master.dbo.b", "svc.core.dbo.b") is True
        assert synonym_map.add("svc.master.dbo.c", "svc.core.dbo.c") is False
        assert synonym_map.aliases_for("svc.master.dbo.c") is None

    def test_cap_counts_targets_not_aliases(self):
        synonym_map = SynonymMap(max_entries=1)

        assert synonym_map.add("svc.master.dbo.a", "svc.core.dbo.a") is True
        assert synonym_map.add("svc.master.dbo.a", "svc.other.dbo.a") is True

    def test_is_empty(self):
        synonym_map = SynonymMap()

        assert synonym_map.is_empty() is True
        synonym_map.add("svc.master.dbo.orders", "svc.core.dbo.orders")
        assert synonym_map.is_empty() is False

    def test_lookup_is_case_insensitive_regardless_of_which_case_was_added_first(self):
        # SQL Server's default collation is case-insensitive, so base_object_name
        # casing routinely disagrees with the target table's real stored casing.
        added_mixed_case = SynonymMap()
        added_mixed_case.add("svc.db.dbo.Orders", "svc.core.dbo.orders_alias")
        assert added_mixed_case.aliases_for("svc.db.dbo.orders") == ["svc.core.dbo.orders_alias"]

        added_lower_case = SynonymMap()
        added_lower_case.add("svc.db.dbo.orders", "svc.core.dbo.orders_alias")
        assert added_lower_case.aliases_for("svc.db.dbo.Orders") == ["svc.core.dbo.orders_alias"]

    def test_aliases_for_retains_original_alias_casing(self):
        synonym_map = SynonymMap()
        synonym_map.add("svc.db.dbo.Orders", "svc.core.dbo.CustOrdersAlias")

        # The lookup key is folded, but the stored alias FQN must not be -- OpenMetadata
        # FQNs are case-preserving, so folding the value would corrupt aliases[].
        assert synonym_map.aliases_for("svc.db.dbo.orders") == ["svc.core.dbo.CustOrdersAlias"]

    def test_target_consumed_via_differently_cased_lookup_is_not_unresolved(self):
        synonym_map = SynonymMap()
        synonym_map.add("svc.db.dbo.Orders", "svc.core.dbo.orders_alias")

        synonym_map.aliases_for("svc.db.dbo.orders")

        assert synonym_map.unresolved() == []

    def test_unresolved_cap_bounds_explicit_entries(self):
        synonym_map = SynonymMap(max_entries=2)

        synonym_map.record_unresolved("svc.core.dbo.a", SynonymUnresolvedReason.REMOTE_TARGET_UNMAPPED)
        synonym_map.record_unresolved("svc.core.dbo.b", SynonymUnresolvedReason.REMOTE_TARGET_UNMAPPED)
        synonym_map.record_unresolved("svc.core.dbo.c", SynonymUnresolvedReason.REMOTE_TARGET_UNMAPPED)

        # Only the first 2 entries should be stored (capped at max_entries)
        assert len(synonym_map.unresolved()) == 2
        stored_fqns = [u[0] for u in synonym_map.unresolved()]
        assert "svc.core.dbo.a" in stored_fqns
        assert "svc.core.dbo.b" in stored_fqns
        assert "svc.core.dbo.c" not in stored_fqns


def _fqn_builder(database, schema, table):
    return f"svc.{database}.{schema}.{table}"


def _engine_returning(rows_by_database):
    """Mock a SQLAlchemy engine whose execute() returns per-database synonym rows"""
    engine = MagicMock()
    connection = engine.connect.return_value.__enter__.return_value

    def execute(statement, *_args, **_kwargs):
        rendered = str(statement)
        for database, rows in rows_by_database.items():
            if f"[{database}]" in rendered:
                result = MagicMock()
                result.all.return_value = rows
                return result
        result = MagicMock()
        result.all.return_value = []
        return result

    connection.execute.side_effect = execute
    return engine


def _row(synonym_schema, synonym_name, base_object_name):
    row = MagicMock()
    row.synonym_schema = synonym_schema
    row.synonym_name = synonym_name
    row.base_object_name = base_object_name
    return row


class TestBuildSynonymMap:
    def test_cross_database_synonym_maps_to_its_target(self):
        engine = _engine_returning({"analytics_core": [_row("dbo", "orders", "[analytics_master].[dbo].[orders]")]})

        synonym_map = build_synonym_map(
            engine=engine,
            database_names=["analytics_core"],
            fqn_builder=_fqn_builder,
        )

        assert synonym_map.aliases_for("svc.analytics_master.dbo.orders") == ["svc.analytics_core.dbo.orders"]

    def test_remote_target_is_recorded_unresolved(self):
        engine = _engine_returning({"analytics_core": [_row("dbo", "orders", "[LINK].[db].[dbo].[orders]")]})

        synonym_map = build_synonym_map(
            engine=engine,
            database_names=["analytics_core"],
            fqn_builder=_fqn_builder,
        )

        assert synonym_map.unresolved() == [("svc.analytics_core.dbo.orders", "RemoteTargetUnmapped")]

    def test_a_failing_database_does_not_abort_the_sweep(self):
        engine = MagicMock()
        connection = engine.connect.return_value.__enter__.return_value

        def execute(statement, *_args, **_kwargs):
            if "[broken]" in str(statement):
                raise RuntimeError("permission denied")
            result = MagicMock()
            result.all.return_value = [_row("dbo", "orders", "[master_db].[dbo].[orders]")]
            return result

        connection.execute.side_effect = execute

        synonym_map = build_synonym_map(
            engine=engine,
            database_names=["broken", "good"],
            fqn_builder=_fqn_builder,
        )

        assert synonym_map.aliases_for("svc.master_db.dbo.orders") is not None

    def test_database_name_with_bracket_is_escaped(self):
        engine = _engine_returning({})

        build_synonym_map(
            engine=engine,
            database_names=["we]ird"],
            fqn_builder=_fqn_builder,
        )

        connection = engine.connect.return_value.__enter__.return_value
        rendered = str(connection.execute.call_args[0][0])
        assert "[we]]ird].sys.synonyms" in rendered


class TestMssqlSourceAliases:
    def test_get_table_aliases_returns_none_for_an_empty_map(self):
        source = MagicMock(spec=MssqlSource)
        source.synonym_map = SynonymMap()

        assert MssqlSource.get_table_aliases(source, table_name="orders", schema_name="dbo") is None

    def test_get_table_aliases_resolves_the_current_table(self):
        source = MagicMock(spec=MssqlSource)
        source.synonym_map = SynonymMap()
        source.synonym_map.add("svc.analytics_master.dbo.orders", "svc.analytics_core.dbo.orders")
        source.context.get.return_value.database = "analytics_master"
        source._build_table_fqn.side_effect = _fqn_builder

        aliases = MssqlSource.get_table_aliases(source, table_name="orders", schema_name="dbo")

        assert aliases == ["svc.analytics_core.dbo.orders"]

    def test_close_warns_for_each_unresolved_synonym(self):
        source = MagicMock(spec=MssqlSource)
        source.status = Status()
        source.synonym_map = SynonymMap()
        source.synonym_map.record_unresolved(
            "svc.analytics_core.dbo.orders", SynonymUnresolvedReason.REMOTE_TARGET_UNMAPPED
        )

        MssqlSource.close(source)

        assert source.status.warnings == [
            {"svc.analytics_core.dbo.orders": "Synonym target unresolved: RemoteTargetUnmapped"}
        ]

    def test_close_reports_no_warnings_when_nothing_is_unresolved(self):
        source = MagicMock(spec=MssqlSource)
        source.status = Status()
        source.synonym_map = SynonymMap()

        MssqlSource.close(source)

        assert source.status.warnings == []


class TestInScopeDatabaseNames:
    """
    _in_scope_database_names() is the sweep's routing logic: it decides which
    databases prepare() sweeps at all. prepare() wraps the sweep in a broad
    except, so a regression here would silently produce an empty synonym map
    rather than fail loudly.
    """

    def test_returns_only_the_configured_database_when_not_ingesting_all(self):
        source = MagicMock(spec=MssqlSource)
        source.service_connection = MagicMock(ingestAllDatabases=False, database="analytics_core")

        result = MssqlSource._in_scope_database_names(source)

        assert result == ["analytics_core"]
        source.get_database_names_raw.assert_not_called()

    def test_excludes_a_database_matching_the_filter_pattern(self):
        # Covers the plain-name filtering path (useFqnForFiltering=False). The
        # useFqnForFiltering=True branch is not covered here: exercising it
        # would require asserting against fqn.build's/quote_name's exact output
        # format, coupling this test to internals unrelated to the routing
        # logic under test.
        source = MagicMock(spec=MssqlSource)
        source.service_connection = MagicMock(ingestAllDatabases=True)
        source.metadata = MagicMock()
        source.config = MagicMock(serviceName="svc")
        source.source_config = MagicMock(
            useFqnForFiltering=False,
            databaseFilterPattern=FilterPattern(excludes=["^analytics_master$"]),
        )
        source.get_database_names_raw.return_value = ["analytics_core", "analytics_master"]

        result = MssqlSource._in_scope_database_names(source)

        assert result == ["analytics_core"]


class TestMssqlSourcePrepare:
    def test_prepare_wires_the_sweep_into_synonym_map(self):
        source = MagicMock(spec=MssqlSource)
        source.engine = MagicMock()
        source.service_connection = MagicMock(includeSynonyms=True)
        source._in_scope_database_names.return_value = ["analytics_core"]
        expected_map = SynonymMap()
        expected_map.add("svc.analytics_master.dbo.orders", "svc.analytics_core.dbo.orders")

        with patch(
            "metadata.ingestion.source.database.mssql.metadata.build_synonym_map",
            return_value=expected_map,
        ) as mock_build:
            MssqlSource.prepare(source)

        mock_build.assert_called_once_with(
            engine=source.engine,
            database_names=["analytics_core"],
            fqn_builder=source._build_table_fqn,
        )
        assert source.synonym_map is expected_map

    def test_prepare_leaves_the_existing_synonym_map_untouched_when_the_sweep_fails(self):
        source = MagicMock(spec=MssqlSource)
        source.engine = MagicMock()
        source.service_connection = MagicMock(includeSynonyms=True)
        # What __init__ would have set before prepare() ever ran.
        source.synonym_map = SynonymMap()
        source._in_scope_database_names.return_value = ["analytics_core"]

        with patch(
            "metadata.ingestion.source.database.mssql.metadata.build_synonym_map",
            side_effect=RuntimeError("permission denied"),
        ):
            MssqlSource.prepare(source)

        assert source.synonym_map is not None
        assert source.synonym_map.is_empty() is True
        assert source.synonym_map.aliases_for("svc.analytics_master.dbo.orders") is None

        source.status = Status()
        MssqlSource.close(source)

        assert source.status.warnings == []


class TestIncludeSynonymsFlag:
    """includeSynonyms gates the sweep so an opted-out service runs no synonym queries."""

    def test_defaults_to_disabled(self):
        # Synonym discovery is opt-in: a service configured before the field existed, or by
        # anyone who never touched the toggle, must not start paying for the sweep.
        assert MssqlConnection(hostPort="localhost:1433", database="db").includeSynonyms is False

    def test_disabled_skips_the_sweep_entirely(self):
        source = MagicMock(spec=MssqlSource)
        source.service_connection = MagicMock(includeSynonyms=False)
        source.synonym_map = SynonymMap()

        with patch("metadata.ingestion.source.database.mssql.metadata.build_synonym_map") as sweep:
            MssqlSource.prepare(source)

        sweep.assert_not_called()
        assert source.synonym_map.is_empty() is True

    def test_enabled_runs_the_sweep(self):
        source = MagicMock(spec=MssqlSource)
        source.engine = MagicMock()
        source.service_connection = MagicMock(includeSynonyms=True)
        source._in_scope_database_names.return_value = ["analytics_core"]
        built = SynonymMap()
        built.add("svc.master.dbo.orders", "svc.core.dbo.orders")

        with patch(
            "metadata.ingestion.source.database.mssql.metadata.build_synonym_map",
            return_value=built,
        ) as sweep:
            MssqlSource.prepare(source)

        sweep.assert_called_once()
        assert source.synonym_map is built
