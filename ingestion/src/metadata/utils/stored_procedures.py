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
Stored Procedures Utilities
"""

import re

from metadata.utils.logger import utils_logger

logger = utils_logger()

# The optionally qualified procedure name, plus the whitespace before it. Bounded on purpose:
# an unbounded `.*?` runs to the next paren anywhere in the statement, which would let
# `UPDATE call_log SET x = pkg.refresh_stats(1)` resolve to a real procedure. `\s` matches
# newlines, so a multi-line call parses without re.DOTALL.
#
# Unquoted covers Oracle's `[schema.][package|type][@dblink] name` and the `$` / `#` its
# identifiers allow. A quoted segment is taken whole, since a delimited identifier may hold any
# character, which is how BigQuery spells a hyphenated project id.
# https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CALL.html
# https://cloud.google.com/bigquery/docs/reference/standard-sql/lexical
# https://docs.snowflake.com/en/sql-reference/identifiers-syntax
_QUALIFIED_NAME = r"(?:[\s\w.@$#]|`[^`]*`|\"[^\"]*\")*?"

# Where the name ends. A `CALL` runs up to the argument list. A parameterless PL/SQL call inside
# a block has no argument list, so it runs up to the statement terminator instead.
_BEFORE_ARG_LIST = r"(?=\()"
_BEFORE_BLOCK_END = r"(?=;\s*end)"


def _invocation(keyword: str, ends_at: str) -> str:
    """Build one `<keyword> <qualified name>` alternation.

    The keyword needs a boundary on both sides. `\\b` before it rejects `recall`, and `(?!\\w)`
    after it rejects an identifier that merely starts with the keyword, so `SELECT call_center(1)`
    is not read as an invocation of a procedure named `_center`.
    """
    return rf"(?<=\b{keyword})(?!\w){_QUALIFIED_NAME}{ends_at}"


NAME_PATTERN = "|".join(
    (
        _invocation("call", _BEFORE_ARG_LIST),
        _invocation("begin", _BEFORE_ARG_LIST),
        _invocation("begin", _BEFORE_BLOCK_END),
    )
)


def _continues_identifier(char: str) -> bool:
    """Match the name grammar's Unicode word characters and Oracle continuations."""
    return char.isalnum() or char in "_$#"


def _blank_line_comment(text: str, i: int, n: int, out: list[str]) -> int:
    """Blank a `--` or `#` comment up to CR or LF, preserving the line ending."""
    j = i
    while j < n and text[j] not in "\r\n":
        j += 1
    out.append(" " * (j - i))
    return j


def _blank_block_comment(text: str, i: int, n: int, out: list[str]) -> int | None:
    """Blank a `/* ... */` block comment. Return the new index, or ``None`` if
    the comment is unterminated (caller truncates at the opener)."""
    j = i + 2
    while j < n - 1 and not (text[j] == "*" and text[j + 1] == "/"):
        j += 1
    if j >= n - 1:
        return None
    out.append(" " * (j + 2 - i))
    return j + 2


def _copy_dquote(text: str, i: int, n: int, out: list[str]) -> int:
    """Copy a `"..."` delimited identifier verbatim (it is part of the name).
    `""` is an escaped quote inside the identifier; an unterminated `"` leaves
    the tail verbatim (no truncation)."""
    out.append(text[i])
    j = i + 1
    while j < n:
        out.append(text[j])
        if text[j] == '"':
            if j + 1 < n and text[j + 1] == '"':
                out.append('"')
                j += 2
                continue
            j += 1
            break
        j += 1
    return j


def _copy_backtick(text: str, i: int, n: int, out: list[str]) -> int:
    """Copy a `` `...` `` backtick identifier verbatim (BigQuery project path);
    its internal dots are separators that `NAME_PATTERN` splits."""
    out.append(text[i])
    j = i + 1
    while j < n and text[j] != "`":
        out.append(text[j])
        j += 1
    if j < n:
        out.append("`")
        j += 1
    return j


def _blank_dollar(text: str, i: int, n: int, out: list[str]) -> int | None:
    """Blank a PostgreSQL `$tag$...$tag$` dollar-quote (empty tag `$$` allowed).
    Return the new index, ``None`` to truncate (unterminated), or ``-1`` when
    the `$` does not open a dollar-quote (caller preserves it verbatim)."""
    j = i + 1
    while j < n and (text[j].isalnum() or text[j] == "_"):
        j += 1
    if j >= n or text[j] != "$":
        return -1
    tag = text[i : j + 1]
    k = text.find(tag, j + 1)
    if k == -1:
        return None
    out.append(" " * (k + len(tag) - i))
    return k + len(tag)


def _detect_qquote(text: str, i: int, n: int) -> tuple[int, str]:
    """If `text[i]` starts an Oracle `q'<delim>...<delim>'` or `nq'...'`
    alternative-quoted literal (outside a word identifier), return the index of
    the opening `'` and the delimiter character. Otherwise return ``(-1, "")``.
    """
    c = text[i]
    if c in ("q", "Q") and i + 2 < n and text[i + 1] == "'" and (i == 0 or not _continues_identifier(text[i - 1])):
        d = text[i + 2]
        if not d.isspace():
            return i + 1, d
    if (
        c in ("n", "N")
        and i + 3 < n
        and text[i + 1] in ("q", "Q")
        and text[i + 2] == "'"
        and (i == 0 or not _continues_identifier(text[i - 1]))
    ):
        d = text[i + 3]
        if not d.isspace():
            return i + 2, d
    return -1, ""


def _blank_qquote(text: str, start: int, q_end: int, delim: str, out: list[str], n: int) -> int | None:
    """Blank a `q'`/`nq'` literal that opens at ``start`` (closing `'` at
    ``q_end``). Bracket delimiters pair `()`/`[]`/`{}`/`<>`; any other single
    non-whitespace delimiter is its own closer. Return the new index, or
    ``None`` if the literal is unterminated (caller truncates).
    """
    close = {"(": ")", "[": "]", "{": "}", "<": ">"}.get(delim)
    j = q_end + 2
    if close is not None:
        while j < n and not (text[j] == close and j + 1 < n and text[j + 1] == "'"):
            j += 1
    else:
        while j < n and not (text[j] == delim and j + 1 < n and text[j + 1] == "'"):
            j += 1
    if j >= n or j + 1 >= n:
        return None
    out.append(" " * (j + 2 - start))
    return j + 2


def _blank_ordinary_string(text: str, i: int, out: list[str], n: int) -> int | None:
    """Blank an ordinary `'...'` literal that opens at ``i``. A backslash is a
    literal character and `''` is an escaped apostrophe. Return the new index,
    or ``None`` if the string is unterminated (caller truncates at the opener).
    """
    opener_out = len(out)
    out.append(" ")
    j = i + 1
    while j < n:
        if text[j] == "'":
            if j + 1 < n and text[j + 1] == "'":
                out.append("  ")
                j += 2
                continue
            out.append(" ")
            j += 1
            return j
        out.append(" ")
        j += 1
    del out[opener_out:]
    return None


def _sanitize(query_text: str) -> str:
    """Blank comments and string literals so a `CALL`/`BEGIN` written inside one
    cannot win the leftmost `re.search` match and fabricate lineage.

    A single linear scan (no backtracking regex) handles every form so repeated
    unmatched `q'`-like prefixes in comment text stay linear in input size:

    * `--` / `#` line and `/* ... */` block comments are blanked. CR, LF and CRLF
      endings of line comments survive. An unterminated `/*` runs to end of text, so the
      tail is truncated at its opener -- a `CALL` inside it never executed.
    * `"..."` (Snowflake/Oracle) and `` `...` `` (BigQuery) delimited
      identifiers are preserved verbatim; a delimited name may hold any
      character (incl. `--`, `/*`, `'`, `q'`), so q-quote / comment / string
      recognition is suppressed inside them.
    * PostgreSQL dollar-quoted `$tag$...$tag$` strings (empty tag `$$` allowed)
      are blanked like ordinary literals; an unterminated dollar-quote truncates.
      The opener is recognized only at a token boundary (no Unicode word char, `$` or `#`
      just before), so a `$` that continues an unquoted identifier -- Oracle's
      `my$proc` / `my$proc$archive`, Snowflake's `$1`, or a name like `a$$` --
      is preserved verbatim instead of being read as a dollar-quote opener.
    * Oracle alternative-quoted `q'<delim>...<delim>'` and national-char
      `nq'...'` literals are blanked. They are recognized only outside a word
      (so `seq'...` is not a q-quote) and only outside comments and delimited
      identifiers, so a `q'` written in a `--` comment or inside `"..."` keeps
      its meaning. Bracket delimiters pair `()`/`[]`/`{}`/`<>`; any other single
      non-whitespace character is its own closer. An unterminated q-quote
      truncates at its opener.
    * Ordinary `'...'` strings use Oracle-style escaping: a backslash is a
      literal character and `''` is an escaped apostrophe. This preserves a
      real `CALL`/`BEGIN` after a valid literal ending in a backslash. An unterminated `'`
      truncates at its opener, the same source as `gv$sql.sql_text`'s 1000-char
      cut.
    """
    out: list[str] = []
    i = 0
    n = len(query_text)
    while i < n:
        c = query_text[i]

        # BigQuery's `#` opens a comment at a lexical boundary, while Oracle
        # permits it inside an unquoted identifier such as `a#$$`.
        if (c == "-" and i + 1 < n and query_text[i + 1] == "-") or (
            c == "#" and (i == 0 or not _continues_identifier(query_text[i - 1]))
        ):
            i = _blank_line_comment(query_text, i, n, out)
            continue

        # `/* ... */` block comment. An unterminated `/*` runs to end of text,
        # so truncate at its opener: a `CALL` written inside it never executed.
        if c == "/" and i + 1 < n and query_text[i + 1] == "*":
            new_i = _blank_block_comment(query_text, i, n, out)
            if new_i is None:
                return "".join(out)
            i = new_i
            continue

        # `"..."` delimited identifier: preserve whole (a delimited name may
        # hold any character, incl. `--`/`/*`/`'`/`q'`). An unterminated `"`
        # leaves the tail verbatim -- a delimited identifier is not a
        # truncation source.
        if c == '"':
            i = _copy_dquote(query_text, i, n, out)
            continue

        # `` `...` `` backtick identifier (BigQuery project path): preserve
        # whole; its internal dots are separators that `NAME_PATTERN` splits.
        if c == "`":
            i = _copy_backtick(query_text, i, n, out)
            continue

        # PostgreSQL dollar-quoted `$tag$...$tag$` (empty tag `$$` allowed).
        # A `$` that does not open a dollar-quote is preserved verbatim: Oracle's
        # `my$proc` / `my$proc$archive` and Snowflake's `$1` are unquoted
        # identifiers, so a dollar-quote opener is recognized only at a token
        # boundary -- no Unicode word char, `$` or `#` just before, which keeps a
        # `$` that continues an identifier (`my$`, `a$$`) from being read as a
        # dollar-quote opener that would truncate a real `CALL`/`BEGIN`.
        # An unterminated dollar-quote truncates.
        if c == "$" and (i == 0 or not _continues_identifier(query_text[i - 1])):
            new_i = _blank_dollar(query_text, i, n, out)
            if new_i is None:
                return "".join(out)
            if new_i == -1:
                out.append(c)
                new_i = i + 1
            i = new_i
            continue

        # Oracle alternative-quoted `q'<delim>...<delim>'` / `nq'...'`, only
        # outside a word (so `seq'...` is not a q-quote) and -- by construction
        # of the scan above -- outside comments and delimited identifiers.
        q_end, delim = _detect_qquote(query_text, i, n)
        if q_end != -1:
            new_i = _blank_qquote(query_text, i, q_end, delim, out, n)
            if new_i is None:
                return "".join(out)
            i = new_i
            continue

        # Oracle's backslashes are literal; only doubled apostrophes escape a
        # quote. An unclosed literal can be a query-history cut, so discard its
        # tail without losing invocations before it.
        if c == "'":
            new_i = _blank_ordinary_string(query_text, i, out, n)
            if new_i is None:
                return "".join(out)
            i = new_i
            continue

        out.append(c)
        i += 1

    return "".join(out)


def get_procedure_name_from_call(query_text: str, sensitive_match: bool = False) -> str | None:
    """
    In the query text we'll have:
    - `CALL db.schema.procedure_name(...)`,
    - `CALL schema.procedure_name(...)`
    - `CALL procedure_name(...)`.

    We need to get the procedure name in these 3 cases.

    We'll return the lowered procedure name
    """
    # Comments and literal values can mention invocations that never executed.
    if any(marker in query_text for marker in ("--", "/*", "'", "$", "#")):
        query_text = _sanitize(query_text)

    res = re.search(NAME_PATTERN, query_text, re.IGNORECASE if not sensitive_match else 0)
    if not res:
        return None

    try:
        # Split only on dots that are NOT inside a "..." segment. A double-quoted
        # identifier (Snowflake/Oracle) may hold a literal `.` as one of its
        # characters; splitting on it would drop the head of the name and miss
        # the lineage join, since the StoredProcedure entity is keyed by the real,
        # undelimited name (e.g. Snowflake's `PROCEDURE_NAME` carries it verbatim
        # and the query-history row supplies only `QUERY_TEXT`). Backtick blobs
        # (BigQuery's `project.dataset.routine` path) have no double-quotes, so
        # their internal dots are split here too — exactly the separator role
        # BigQuery assigns them — then the backticks are stripped below.
        name = res.group(0).strip()
        parts = re.split(r"""\.(?=(?:[^"]*"[^"]*")*[^"]*$)""", name)
        # Take the last segment and drop its identifier delimiters. StoredProcedure
        # entity names are stored undelimited, and the caller matches on
        # `procedure.name.root.lower()`, so a name kept as `"my proc"` would never
        # match the entity it names.
        return parts[-1].strip().lower().replace("`", "").replace('"', "")
    except Exception as exc:
        logger.warning(f"Error trying to get the procedure name in [{query_text}] due to [{exc}]")
        return None
