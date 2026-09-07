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
Test Stored Procedures Utils
"""

import time

from metadata.utils.stored_procedures import get_procedure_name_from_call


class TestStoredProcedures:
    """Group stored procedures tests"""

    def test_get_procedure_name_from_call(self):
        """Check that we properly parse CALL queries"""
        assert get_procedure_name_from_call(query_text="CALL db.schema.procedure_name(...)") == "procedure_name"

        assert get_procedure_name_from_call(query_text="CALL schema.procedure_name(...)") == "procedure_name"

        assert get_procedure_name_from_call(query_text="CALL procedure_name(...)") == "procedure_name"

        assert get_procedure_name_from_call(query_text="CALL DB.SCHEMA.PROCEDURE_NAME(...)") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN DB.SCHEMA.PROCEDURE_NAME; END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN schema.procedure_name; END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN procedure_name; END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN DB.SCHEMA.PROCEDURE_NAME(...); END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN schema.procedure_name(...); END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN procedure_name(...); END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="something very random") is None

    def test_get_procedure_name_with_nested_function_args(self):
        """Oracle rewrites literal args as functions (e.g. TO_NUMBER(...)).
        The procedure name must still be parsed without capturing the argument."""
        assert (
            get_procedure_name_from_call(query_text="BEGIN SALES.INSERT_NUMBER(TO_NUMBER(:1)); END;") == "insert_number"
        )

        assert get_procedure_name_from_call(query_text="CALL SALES.INSERT_NUMBER(TO_NUMBER(12345))") == "insert_number"

        assert (
            get_procedure_name_from_call(query_text="BEGIN SCHEMA.PROC(TO_DATE('2024-01-01'), NVL(x, 0)); END;")
            == "proc"
        )

    def test_get_procedure_name_from_multiline_call(self):
        """Multi-line CALL statements (keyword and name on different lines, as captured
        by query-log SQL) must still be parsed. Regression test for a name span that
        could not cross newlines."""
        assert get_procedure_name_from_call(query_text="CALL\n  proc_name()") == "proc_name"

        assert get_procedure_name_from_call(query_text="CALL\n  my_db.my_schema.my_proc()") == "my_proc"

        assert get_procedure_name_from_call(query_text="CALL\n  schema.procedure_name(...)") == "procedure_name"

        assert get_procedure_name_from_call(query_text="CALL\n\n  procedure_name\n  ()") == "procedure_name"

        assert get_procedure_name_from_call(query_text="  call  \n  proc_name  ()") == "proc_name"

    def test_get_procedure_name_from_multiline_begin_end(self):
        """Multi-line BEGIN ... END; blocks (the common Oracle PL/SQL invocation form,
        where gv$sql.sql_text preserves the original multi-line text) must be parsed.
        Regression test for the begin alternations added for Oracle SP lineage."""
        assert (
            get_procedure_name_from_call(query_text="BEGIN\n  SALES.INSERT_NUMBER(TO_NUMBER(:1));\nEND;")
            == "insert_number"
        )

        assert get_procedure_name_from_call(query_text="BEGIN\n  schema.proc_name;\nEND;") == "proc_name"

        assert get_procedure_name_from_call(query_text="BEGIN\n  procedure_name();\nEND;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="begin\n  proc_name();\nend;") == "proc_name"

        assert get_procedure_name_from_call(query_text="BEGIN\n  DB.SCHEMA.PROCEDURE_NAME;\nEND;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN\n  schema.proc_name\n;\nEND;") == "proc_name"

    def test_get_procedure_name_from_multiline_preserves_single_line_behavior(self):
        """Letting the name span cross newlines must not change any previously-working
        single-line result."""
        assert get_procedure_name_from_call(query_text="CALL db.schema.procedure_name(...)") == "procedure_name"

        assert get_procedure_name_from_call(query_text="CALL procedure_name(...)") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN DB.SCHEMA.PROCEDURE_NAME; END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN procedure_name(...); END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="something very random") is None

        assert get_procedure_name_from_call(query_text="-- this is a recall\nof an event") is None

    def test_get_procedure_name_sensitive_match_is_case_sensitive_but_spans_newlines(self):
        """sensitive_match=True drops re.IGNORECASE (so the call/begin keyword must be
        lowercase) while multi-line text is still parsed, because the name span matches
        whitespace directly rather than relying on re.DOTALL."""
        assert get_procedure_name_from_call(query_text="call\n  proc_name()", sensitive_match=True) == "proc_name"

        assert get_procedure_name_from_call(query_text="begin\n  schema.proc;\nend;", sensitive_match=True) == "proc"

        assert get_procedure_name_from_call(query_text="CALL\n  proc_name()", sensitive_match=True) is None

        assert get_procedure_name_from_call(query_text="BEGIN\n  proc();\nEND;", sensitive_match=True) is None

    def test_get_procedure_name_ignores_non_procedure_sql(self):
        """Oracle's stored-procedure query filters on `UPPER(sql_text) LIKE '%CALL%' OR LIKE
        '%BEGIN%'`, an unanchored substring match, so ordinary multi-line SQL reaches this
        parser as procedure_text. None of it names a procedure and none of it may parse as one."""
        assert (
            get_procedure_name_from_call(
                query_text="SELECT\n  begin_date,\n  end_date\nFROM sales\nWHERE id IN (1, 2, 3)"
            )
            is None
        )

        assert (
            get_procedure_name_from_call(
                query_text="INSERT INTO ledger\nSELECT beginning_balance\nFROM accounts\nWHERE dt > TRUNC(SYSDATE)"
            )
            is None
        )

        assert (
            get_procedure_name_from_call(
                query_text="UPDATE call_center\nSET x = 1\nWHERE id IN (SELECT id FROM staging)"
            )
            is None
        )

        assert (
            get_procedure_name_from_call(
                query_text="-- recall the prior run\nMERGE INTO tgt USING (SELECT 1 FROM dual) s ON (1=1)"
            )
            is None
        )

        assert get_procedure_name_from_call(query_text="BEGIN\n  UPDATE t SET a = 1;\n  COMMIT;\nEND;") is None

    def test_get_procedure_name_does_not_fabricate_a_procedure_from_a_function_call(self):
        """The worst failure mode is not a bogus name, it is a plausible one. A package or
        function call on a line after a `call`/`begin` substring must not reduce to a bare
        identifier, or it would match a real StoredProcedure entity and fabricate lineage."""
        assert get_procedure_name_from_call(query_text="UPDATE call_log\nSET x = pkg.refresh_stats(1)") is None

        assert get_procedure_name_from_call(query_text="SELECT begin_dt\nFROM t\nWHERE y = SALES.LOAD_DIM(1)") is None

    def test_get_procedure_name_stays_linear_on_large_non_procedure_sql(self):
        """The name span must stay bounded. An unbounded `.*?` (as re.DOTALL allows) turns this
        into a quadratic scan, because every `call`/`begin` substring walks to the end of the
        text looking for a paren that never arrives.

        Measured on this input: a bounded span takes ~6ms, an unbounded one ~2.5s. The 500ms
        budget therefore leaves ~85x headroom on the correct implementation while still failing
        a return to quadratic behaviour by ~5x, so it does not flake on a loaded CI runner."""
        line = "begin_date, end_date, beginning_balance, call_center,\n"
        query_text = "SELECT\n" + line * (64 * 1024 // len(line)) + "FROM t"

        start = time.perf_counter()
        result = get_procedure_name_from_call(query_text=query_text)
        elapsed = time.perf_counter() - start

        assert result is None
        assert elapsed < 0.5, f"parsing {len(query_text)} bytes took {elapsed:.2f}s, expected well under 0.5s"
