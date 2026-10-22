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
Lineage of MSSQL stored procedures that move data with ALTER TABLE ... SWITCH.

SQL Server records no statement for DDL, so neither Query Store nor the plan cache holds
a procedure's SWITCH: the lineage has to come from the definition of a procedure that ran.
"""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import ProgrammingError

from metadata.generated.schema.entity.data.storedProcedure import (
    StoredProcedure,
    StoredProcedureCode,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import (
    QueryParserType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.source.database.lineage_processors import (
    _yield_procedure_lineage,
    is_lineage_query,
)
from metadata.ingestion.source.database.mssql import utils as mssql_utils
from metadata.ingestion.source.database.mssql.lineage import MssqlLineageSource
from metadata.ingestion.source.database.stored_procedures_mixin import QueryByProcedure

REPORTED_SWITCH = "ALTER TABLE target_table SWITCH PARTITION 2 TO source_table PARTITION 2"

REPORTED_PROCEDURE = f"""CREATE PROCEDURE dbo.SwitchPartitionProc
AS
BEGIN
    {REPORTED_SWITCH};
END"""

WAIT_OPTION_SWITCH = (
    "ALTER TABLE [dbo].[stage_table] SWITCH PARTITION 2 TO [dbo].[archive_table] PARTITION 2\n"
    "        WITH (WAIT_AT_LOW_PRIORITY (MAX_DURATION = 1 MINUTES, ABORT_AFTER_WAIT = NONE))"
)

MIXED_PROCEDURE = f"""CREATE PROCEDURE dbo.LoadAndSwitchProc
AS
BEGIN
    INSERT INTO dbo.archive_table (id, val) SELECT id, val FROM dbo.stage_table WHERE id > 200;
    {WAIT_OPTION_SWITCH};
END"""


def _table_names(tables) -> set[str]:
    return {str(table).replace("<default>.", "").lower() for table in tables}


class TestSwitchParsing:
    """The parser reads a SWITCH as data moving from the switched table into the TO table"""

    @pytest.mark.parametrize(
        ("query", "source", "target"),
        [
            (REPORTED_SWITCH, "target_table", "source_table"),
            ("ALTER TABLE dbo.stage SWITCH TO dbo.archive", "dbo.stage", "dbo.archive"),
            (WAIT_OPTION_SWITCH, "dbo.stage_table", "dbo.archive_table"),
            (
                "alter table sales.[orders 2024] switch partition $PARTITION.pf_year(2024) "
                "to sales.orders_archive partition $PARTITION.pf_year(2024)",
                "sales.orders 2024",
                "sales.orders_archive",
            ),
        ],
    )
    def test_switch_lineage_runs_from_switched_table_to_target(self, query, source, target):
        parser = LineageParser(query, Dialect.TSQL)

        assert _table_names(parser.source_tables) == {source}
        assert _table_names(parser.target_tables) == {target}

    def test_other_alter_table_statements_are_not_rewritten(self):
        query = "ALTER TABLE dbo.stage ADD loaded_at DATETIME"

        assert LineageParser.clean_raw_query(query) == query


class TestSwitchIsLineageQuery:
    """A SWITCH is parsed for lineage whatever type the query history labelled it with"""

    @pytest.mark.parametrize("query_type", ["ALTER_TABLE_SWITCH", "UNKNOWN"])
    def test_switch_is_a_lineage_query(self, query_type):
        assert is_lineage_query(query_type, REPORTED_SWITCH)

    def test_multiline_switch_is_a_lineage_query(self):
        assert is_lineage_query("ALTER_TABLE_SWITCH", WAIT_OPTION_SWITCH)

    def test_other_alter_table_is_not_a_lineage_query(self):
        assert not is_lineage_query("UNKNOWN", "ALTER TABLE dbo.stage ADD loaded_at DATETIME")


class TestExtractSwitchStatements:
    """SWITCH statements are read out of a procedure body"""

    def test_reported_procedure(self):
        assert mssql_utils.extract_switch_statements(REPORTED_PROCEDURE) == [REPORTED_SWITCH]

    def test_switch_with_wait_option_keeps_the_whole_statement(self):
        assert mssql_utils.extract_switch_statements(MIXED_PROCEDURE) == [WAIT_OPTION_SWITCH]

    def test_commented_out_switch_is_ignored(self):
        body = """CREATE PROCEDURE dbo.p AS
BEGIN
    -- ALTER TABLE dbo.a SWITCH TO dbo.b;
    /* ALTER TABLE dbo.c SWITCH TO dbo.d; */
    SELECT 1;
END"""

        assert mssql_utils.extract_switch_statements(body) == []

    def test_repeated_switch_is_returned_once(self):
        body = "BEGIN ALTER TABLE a SWITCH TO b; ALTER TABLE a SWITCH TO b; ALTER TABLE b SWITCH TO c; END"

        assert mssql_utils.extract_switch_statements(body) == [
            "ALTER TABLE a SWITCH TO b",
            "ALTER TABLE b SWITCH TO c",
        ]

    @pytest.mark.parametrize("body", [None, "", "CREATE PROCEDURE dbo.p AS SELECT 'switch'"])
    def test_body_without_switch(self, body):
        assert mssql_utils.extract_switch_statements(body) == []


def _row(data: dict) -> MagicMock:
    row = MagicMock()
    row._asdict.return_value = data
    return row


def _procedure_run(definition: str, name: str = "SwitchPartitionProc") -> MagicMock:
    run_at = datetime(2026, 10, 22, 5, 53, 1)
    return _row(
        {
            "QUERY_TYPE": "ALTER_TABLE_SWITCH",
            "QUERY_DATABASE_NAME": "switch_db",
            "QUERY_SCHEMA_NAME": "dbo",
            "QUERY_TEXT": definition,
            "QUERY_USER_NAME": None,
            "QUERY_START_TIME": run_at,
            "QUERY_DURATION": 0.01,
            "PROCEDURE_NAME": name,
            "PROCEDURE_TEXT": definition,
            "PROCEDURE_START_TIME": run_at,
            "PROCEDURE_END_TIME": run_at,
        }
    )


class TestMssqlSwitchQueryHistory:
    """Executed procedures contribute their SWITCH statements to the stored procedure queries"""

    @staticmethod
    def _source(procedure_runs):
        """
        A lineage source whose statement history holds nothing for the procedures, as SQL
        Server leaves it for a procedure that only switches partitions. `procedure_runs` is
        what the procedure execution stats return, or the exception reading them raises.
        """
        connection = MagicMock()
        executed = []

        def execute(statement):
            sql = str(statement)
            executed.append(sql)
            result = MagicMock()
            if "dm_exec_procedure_stats" in sql and "SWITCH" in sql:
                if isinstance(procedure_runs, Exception):
                    raise procedure_runs
                result.all.return_value = procedure_runs
            else:
                result.all.return_value = []
            return result

        connection.execute.side_effect = execute
        engine = MagicMock()
        engine.connect.return_value.__enter__.return_value = connection
        engine.connect.return_value.__exit__.return_value = False

        source = MssqlLineageSource.__new__(MssqlLineageSource)
        source.engine = engine
        source._query_store_enabled = True
        source._active_query_store = True
        source.source_config = MagicMock(queryLogDuration=1)
        source.status = MagicMock()
        source.get_stored_procedure_engines = lambda: iter([engine])
        return source, executed

    @staticmethod
    def _queries(source) -> list[QueryByProcedure]:
        with patch(
            "metadata.ingestion.source.database.mssql.lineage.get_sqlalchemy_engine_dateformat",
            return_value="mdy",
        ):
            return list(source.yield_stored_procedure_queries())

    def test_switch_of_an_executed_procedure_is_a_procedure_query(self):
        source, executed = self._source([_procedure_run(REPORTED_PROCEDURE)])

        queries = self._queries(source)

        assert [(query.procedure_name, query.query_text) for query in queries] == [
            ("SwitchPartitionProc", REPORTED_SWITCH)
        ]
        assert queries[0].query_schema_name == "dbo"
        assert queries[0].query_type == "ALTER_TABLE_SWITCH"
        assert any("DB_ID()" in sql and "dm_exec_procedure_stats" in sql for sql in executed)
        source.status.failed.assert_not_called()

    def test_every_switch_of_a_procedure_is_a_query(self):
        body = "CREATE PROCEDURE dbo.p AS BEGIN ALTER TABLE a SWITCH TO b; ALTER TABLE b SWITCH TO c; END"
        source, _ = self._source([_procedure_run(body, name="p")])

        assert [query.query_text for query in self._queries(source)] == [
            "ALTER TABLE a SWITCH TO b",
            "ALTER TABLE b SWITCH TO c",
        ]

    def test_procedure_stats_without_permission_skip_switch_lineage_quietly(self):
        # Query Store needs only database-level grants; the procedure execution stats need
        # VIEW SERVER STATE. Lacking it must not turn every run into a reported failure.
        source, _ = self._source(ProgrammingError("SELECT", {}, Exception("VIEW SERVER STATE permission denied")))

        assert self._queries(source) == []
        source.status.failed.assert_not_called()


class TestSwitchProcedureLineage:
    """End to end: a SWITCH query of a procedure becomes a lineage edge through the procedure"""

    @staticmethod
    def _table(name: str) -> Table:
        return Table(
            id=uuid.uuid4(),
            name=name,
            fullyQualifiedName=f"mssql.switch_db.dbo.{name}",
            columns=[
                Column(name="id", dataType=DataType.INT),
                Column(name="val", dataType=DataType.VARCHAR, dataLength=20),
            ],
        )

    def test_switch_creates_edge_through_the_procedure(self):
        tables = {name: self._table(name) for name in ("source_table", "target_table")}
        procedure = StoredProcedure(
            id=uuid.uuid4(),
            name="SwitchPartitionProc",
            fullyQualifiedName="mssql.switch_db.dbo.SwitchPartitionProc",
            storedProcedureCode=StoredProcedureCode(code=REPORTED_PROCEDURE, language="SQL"),
            database=EntityReference(id=uuid.uuid4(), type="database", name="switch_db"),
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema", name="dbo"),
            service=EntityReference(id=uuid.uuid4(), type="databaseService", name="mssql"),
        )
        query = QueryByProcedure.model_validate(_procedure_run(REPORTED_PROCEDURE)._asdict())
        query.query_text = REPORTED_SWITCH

        with patch(
            "metadata.ingestion.lineage.sql_lineage.search_table_entities",
            side_effect=lambda metadata, service_names, database, database_schema, table: (
                [tables[table.lower()]] if table.lower() in tables else None
            ),
        ):
            lineage = list(
                _yield_procedure_lineage(
                    metadata=MagicMock(),
                    service_name="mssql",
                    dialect=Dialect.TSQL,
                    processCrossDatabaseLineage=False,
                    crossDatabaseServiceNames=[],
                    parsingTimeoutLimit=10,
                    query_by_procedure=query,
                    procedure=procedure,
                    procedure_graph_map={},
                    enableTempTableLineage=False,
                    parser_type=QueryParserType.Auto,
                )
            )

        edges = [either.right.edge for either in lineage if either.right is not None]
        assert [(edge.fromEntity.id, edge.toEntity.id) for edge in edges] == [
            (tables["target_table"].id, tables["source_table"].id)
        ]
        assert edges[0].lineageDetails.pipeline.id == procedure.id
        assert edges[0].lineageDetails.pipeline.type == "storedProcedure"
