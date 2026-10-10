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

    def test_get_procedure_name_ignores_commented_out_call_before_a_real_call(self):
        """Engine query-history text carries SQL comments through verbatim (the Snowflake,
        Oracle and Redshift lineage queries carry `NOT LIKE '/* ... */%%'` filters precisely
        because comments survive in `QUERY_TEXT`/`SQL_FULLTEXT`). `re.search` returns the
        leftmost match, so a `CALL`/`BEGIN` that lives inside a `-- ...` or `/* ... */` comment
        would otherwise steal the match from the statement that actually executed, stamping
        lineage onto the wrong procedure (corrupting) or dropping it when the commented name
        does not resolve. Regression test for the comment-blind `re.search` introduced in
        f0995cb (#13121).
        """
        # `--` line comment: the commented-out call must not win over the real one.
        assert (
            get_procedure_name_from_call(query_text="-- CALL old_daily_refresh();\nCALL nightly_load();")
            == "nightly_load"
        )

        assert (
            get_procedure_name_from_call(query_text="-- call daily_refresh()\nbegin schema.real_proc; end;")
            == "real_proc"
        )

        # `/* ... */` block comment: same guarantee, including when the block spans the
        # `CALL` keyword and its name on the same line.
        assert (
            get_procedure_name_from_call(query_text="/* deprecated: CALL legacy_load() */\nCALL nightly_load();")
            == "nightly_load"
        )

        # Multi-line block comment ahead of a real call.
        assert (
            get_procedure_name_from_call(
                query_text="/*\n * Replaced by nightly_load.\n * Old: CALL legacy_load()\n */\nCALL nightly_load();"
            )
            == "nightly_load"
        )

        # A mix of both comment styles ahead of the real statement.
        assert (
            get_procedure_name_from_call(
                query_text="-- CALL staging_refresh()\n/* CALL legacy_load() */\nCALL nightly_load();"
            )
            == "nightly_load"
        )

    def test_get_procedure_name_does_not_fabricate_a_procedure_from_a_call_in_a_comment(self):
        """Oracle's stored-procedure query filters on `UPPER(sql_text) LIKE '%CALL%' OR LIKE
        '%BEGIN%'`, an unanchored substring match, so a regular query that merely mentions
        `CALL` in a comment reaches this parser. The commented name must not be extracted and
        matched against a real StoredProcedure entity, fabricating lineage for a query that is
        not a procedure call at all."""
        assert (
            get_procedure_name_from_call(query_text="-- Reference: CALL nightly_load()\nSELECT * FROM sales_summary")
            is None
        )

        assert get_procedure_name_from_call(query_text="/* TODO: CALL backfill_proc() */\nSELECT 1") is None

        # The only `CALL`/`BEGIN` in the text is inside a comment -> nothing to extract.
        assert get_procedure_name_from_call(query_text="-- CALL nightly_load()") is None

        assert get_procedure_name_from_call(query_text="/* begin schema.proc(); end; */") is None

    def test_get_procedure_name_strips_comments_without_corrupting_quoted_identifiers(self):
        """`sqlparse` is a SQL-aware tokenizer, so stripping comments must preserve quoted
        identifiers (backtick and `"..."` forms) and string literals that a naive regex would
        corrupt. A `--` or `/*` that appears inside a string literal is not a comment and must
        survive, while a real comment ahead of a quoted-name invocation is still stripped."""
        # Comment ahead of a quoted-name invocation still allows the quoted name to parse.
        assert (
            get_procedure_name_from_call(query_text="-- prior run\nCALL `my-project.my_dataset.my_proc`()") == "my_proc"
        )

        assert get_procedure_name_from_call(query_text='-- prior\nCALL db."My Schema"."My Proc"(1)') == "my proc"

        assert get_procedure_name_from_call(query_text='-- prior\nCALL "proc.v2"()') == "proc.v2"

        # A `--` / `/*` inside a string literal is part of the argument, not a comment, so the
        # real procedure name still parses and the literal is left intact.
        assert get_procedure_name_from_call(query_text="CALL proc('has -- inside')") == "proc"

        assert get_procedure_name_from_call(query_text="CALL schema.proc('a/*b*/c')") == "proc"

    def test_get_procedure_name_ignores_identifiers_that_start_with_the_keyword(self):
        """A word boundary before the keyword is not enough. `call_center` and `begin_date` both
        start on a boundary, so `\\bcall` and `\\bbegin` match their prefix, and the rest of the
        identifier is made of characters the name span accepts. Where such an identifier is
        immediately followed by an argument list the whole thing looks like an invocation, which
        is why the keyword also needs a boundary after it."""
        assert get_procedure_name_from_call(query_text="SELECT call_center(1)") is None

        assert get_procedure_name_from_call(query_text="SELECT begin_date(1)") is None

        assert get_procedure_name_from_call(query_text="SELECT call_log(1) FROM t") is None

        assert get_procedure_name_from_call(query_text="UPDATE t SET x = begin_dt(1)") is None

        assert get_procedure_name_from_call(query_text="SELECT recall_fn(1)") is None

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

    def test_get_procedure_name_parses_every_form_the_call_grammar_allows(self):
        """Oracle's CALL grammar is `CALL [schema.][package|type][@dblink] name(args)`, so the
        text between the keyword and the argument list can carry a database link and identifiers
        containing `$` or `#`, both of which are legal in an Oracle identifier.

        https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CALL.html
        """
        assert get_procedure_name_from_call(query_text="CALL schema.pkg@dblink.proc_name(1)") == "proc_name"

        assert get_procedure_name_from_call(query_text="CALL pkg@dblink.proc_name(1)") == "proc_name"

        assert get_procedure_name_from_call(query_text="CALL\n  pkg@dblink.proc_name(1)") == "proc_name"

        assert get_procedure_name_from_call(query_text="CALL my$proc(1)") == "my$proc"

        assert get_procedure_name_from_call(query_text="CALL my#proc(1)") == "my#proc"

        assert get_procedure_name_from_call(query_text="CALL emp_mgmt.remove_dept(162)") == "remove_dept"

    def test_get_procedure_name_parses_quoted_identifiers(self):
        """A delimited identifier may contain any character, so the name span has to consume a
        quoted segment whole rather than character by character. BigQuery needs this for a
        hyphenated project id, which its unquoted rules (letters, digits, underscore) forbid,
        and Snowflake for a double-quoted name. Widening the span to allow a bare hyphen instead
        is not an option, because `SELECT begin_dt - 1 ... WHERE id IN (` would then parse as a
        call and resolve to a procedure named after a fragment of the WHERE clause.

        https://cloud.google.com/bigquery/docs/reference/standard-sql/lexical
        https://docs.snowflake.com/en/sql-reference/identifiers-syntax
        """
        assert get_procedure_name_from_call(query_text="CALL `my-project.my_dataset.my_proc`()") == "my_proc"

        assert get_procedure_name_from_call(query_text="CALL `my-project-123.ds.proc`(1)") == "proc"

        assert get_procedure_name_from_call(query_text="CALL my_dataset.my_proc()") == "my_proc"

        assert get_procedure_name_from_call(query_text='CALL "My-Proc"(1)') == "my-proc"

        assert get_procedure_name_from_call(query_text='CALL db."My Schema"."My Proc"(1)') == "my proc"

        assert get_procedure_name_from_call(query_text="SELECT begin_dt - 1\nFROM t\nWHERE id IN (1,2)") is None

        assert get_procedure_name_from_call(query_text='SELECT begin_dt, "Some Col"\nFROM t\nWHERE x IN (1)') is None

    def test_get_procedure_name_preserves_dots_inside_double_quoted_identifiers(self):
        """A `.` inside a double-quoted identifier (Snowflake/Oracle form) is a literal character
        of the name, not a separator between qualifiers. The StoredProcedure entity is keyed by
        the real, undelimited name (e.g. Snowflake's `ACCOUNT_USAGE.PROCEDURES.PROCEDURE_NAME`
        carries it verbatim), and the query-history row only supplies `QUERY_TEXT`, so this
        parser is the sole source of the name to join on. Splitting on every dot returned only
        the tail (`"proc.v2"` -> `"v2"`), so `procedures_by_name.get("v2")` missed the entity
        keyed `proc.v2` and lineage was silently dropped.

        BigQuery's backtick form is the opposite: the whole backtick blob is one qualified path
        (`project.dataset.routine`) and its internal dots are separators, so those keep returning
        the last segment — covered by `test_get_procedure_name_parses_quoted_identifiers`.

        Regression test for the unconditional `.split(".")[-1]` introduced in 660bf01a5b (#13655),
        which predates the `"..."` alternation of `_QUALIFIED_NAME` added in e38dee4222 (#32737).

        https://docs.snowflake.com/en/sql-reference/identifiers-syntax
        https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/identifiers.html
        """
        assert get_procedure_name_from_call(query_text='CALL "proc.v2"()') == "proc.v2"

        assert get_procedure_name_from_call(query_text='CALL my_db.my_schema."proc.v2"(1)') == "proc.v2"

        assert get_procedure_name_from_call(query_text='CALL db."report.run"(1)') == "report.run"

        assert get_procedure_name_from_call(query_text='CALL "a.b.c"(1)') == "a.b.c"

        # A dot between two quoted segments is a separator: only the last segment is the name.
        assert get_procedure_name_from_call(query_text='CALL schema."a.b"."c.d"(1)') == "c.d"

        # Quoted dot in a BEGIN ... END; (Oracle PL/SQL) form, which routes through the same parser.
        assert get_procedure_name_from_call(query_text='BEGIN\n  schema."proc.v2";\nEND;') == "proc.v2"

        # Case-insensitive keyword + lowered name still hold for quoted dot names.
        assert get_procedure_name_from_call(query_text='call "Proc.V2"(1)') == "proc.v2"

        # sensitive_match drops re.IGNORECASE while preserving the quoted dot.
        assert get_procedure_name_from_call(query_text='call schema."proc.v2"(1)', sensitive_match=True) == "proc.v2"
