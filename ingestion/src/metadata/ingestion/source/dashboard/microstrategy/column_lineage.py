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
Column-level lineage for MicroStrategy cubes.

A cube's SQL names its output columns with aliases. MicroStrategy generates them (``WJXBFS1``,
``CATEGORY0``), or derives a metric's from its name (``REVENUERANK`` for ``Revenue Rank``).
An attribute is matched on the warehouse columns a projection reads, never on the alias; a metric
may be matched on an alias derived from its name.
ADR:2026-11-05-microstrategy-charts-are-named-by-dossier-and-the-search-is-paged
"""

from __future__ import annotations

import re
import traceback
from collections.abc import Mapping
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import TYPE_CHECKING

import sqlglot
from sqlglot import exp

from metadata.ingestion.lineage.parser import (  # pyright: ignore[reportPrivateUsage]
    LINEAGE_PARSING_TIMEOUT,
    _sqlglot_dialect,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.timeout import timeout

if TYPE_CHECKING:
    from collections.abc import Iterable

    from metadata.ingestion.lineage.models import Dialect

logger = ingestion_logger()

# A warehouse column a cube reads: the table as the SQL names it, lowercased and dot-joined
# (``project.dataset.table``), and the column, lowercased.
SourceColumn = tuple[str, str]
# The warehouse columns each projection alias reads, by its normalized alias, across all passes.
AliasReads = Mapping[str, frozenset[SourceColumn]]
NO_ALIASES: AliasReads = MappingProxyType({})


@dataclass(frozen=True)
class ParsedCube:
    """
    What a cube's SQL reads: its tables, and the warehouse columns each projection reads, in all and
    by alias. ``cube`` is the cube the SQL came from: a report dataset's source cube, else the
    dataset itself.
    """

    tables: tuple[str, ...] = ()
    read_columns: frozenset[SourceColumn] = field(default_factory=frozenset)
    cube: str | None = None
    # A default the class shares must be hashable on Python 3.11, and a mapping proxy is not.
    alias_reads: AliasReads = field(default_factory=lambda: NO_ALIASES)


def table_name_of(table: exp.Table) -> str:
    """``catalog.db.name`` of a table reference, lowercased, without quoting"""
    return ".".join(part for part in (table.catalog, table.db, table.name) if part).lower()


SQL_KEYWORD = re.compile(r"(?:select|with|create|insert|drop|update|delete|merge)\b", re.IGNORECASE)


# The tokens a pass split must tell apart, each without nested repetition so the scan stays
# linear: a quote opening, a comment opening, a line comment, a blank line, a parenthesis, a
# bracket, and anything else.
SQL_TOKEN = re.compile(r"['\"`]|/\*|--[^\n]*|\n[ \t\r\f\v]*\n|[()\[]|[^\s'\"`/()\[-]+|[\s\S]")
QUOTE_STOPS = {
    (quote, escapes): re.compile("[" + re.escape(quote) + ("\\\\" if escapes else "") + "]")
    for quote in ("'", '"', "`", "]")
    for escapes in (False, True)
}


def _quote_end(sql: str, start: int, quote: str, escapes: bool) -> int | None:
    """
    Where the quoted text opened at ``start`` ends, or None when it is never closed. A doubled
    quote is part of the text, and so is a quote after a backslash in dialects that escape with one.
    """
    stops = QUOTE_STOPS[(quote, escapes and quote != "`")]
    position = start + 1
    while stop := stops.search(sql, position):
        index = stop.start()
        if sql[index] == "\\" or sql.startswith(quote * 2, index):
            position = index + 2
            continue
        return index + 1
    return None


def backslash_escapes(dialect: Dialect) -> bool:
    """Whether the dialect's strings escape a quote with a backslash, as sqlglot reads them"""
    try:
        return "\\" in sqlglot.Dialect.get_or_raise(_sqlglot_dialect(dialect)).tokenizer_class.STRING_ESCAPES
    except Exception:
        return False


def bracket_quotes(dialect: Dialect) -> bool:
    """Whether the dialect quotes a name with brackets (``[Amount (USD)]``), as sqlglot reads them"""
    try:
        tokenizer = sqlglot.Dialect.get_or_raise(_sqlglot_dialect(dialect)).tokenizer_class
        return "[" in getattr(tokenizer, "_IDENTIFIERS", {})
    except Exception:
        return False


def starts_with_sql(text: str) -> bool:
    """
    Whether the text opens with a SQL keyword once leading comments are skipped. A loop, not a
    regex: a repeated comment group in a regex backtracks exponentially on an unclosed ``/*``.
    """
    position, length = 0, len(text)
    while True:
        while position < length and text[position].isspace():
            position += 1
        if text.startswith("--", position):
            newline = text.find("\n", position)
            position = length if newline < 0 else newline + 1
        elif text.startswith("/*", position):
            close = text.find("*/", position + 2)
            if close < 0:
                return False
            position = close + 2
        else:
            return bool(SQL_KEYWORD.match(text, position))


def sql_passes(sql: str, escapes: bool = False, brackets: bool = False) -> list[str]:
    """
    The passes of a cube SQL. MicroStrategy separates them with blank lines, not semicolons, so a
    pass starts after a blank line whose next statement token is a SQL keyword, outside any
    parentheses. Blank lines inside comments, quoted text, a CTE or a subquery never split, and a
    parenthesis inside quoted text or a bracket-quoted name is not counted. One scan, linear in the
    length of the SQL.
    """
    starts, pending, position, depth = [0], None, 0, 0
    while match := SQL_TOKEN.search(sql, position):
        token = match.group()
        position = match.end()
        if token in ("'", '"', "`"):
            end = _quote_end(sql, match.start(), token, escapes)
            if end is None:
                # Unclosed quoted text runs to the end: no pass starts inside it.
                break
            position = end
            pending = None
        elif token == "[" and brackets:
            # A bracket-quoted name ends at the first ``]`` not doubled.
            end = _quote_end(sql, match.start(), "]", False)
            if end is None:
                break
            position = end
            pending = None
        elif token == "/*":
            close = sql.find("*/", position)
            if close < 0:
                # An unclosed comment is not SQL: it must not swallow the pass before it.
                if pending is not None:
                    starts.append(pending)
                break
            position = close + 2
        elif token.startswith("--"):
            continue
        elif token.startswith("\n") and token.endswith("\n") and len(token) > 1:
            pending = match.start() if pending is None else pending
            # The closing newline may open the next blank line.
            position = match.end() - 1
        elif not token.isspace():
            if token == "(":
                depth += 1
            elif token == ")":
                depth = max(depth - 1, 0)
            if pending is not None and depth == 0 and SQL_KEYWORD.match(sql, match.start()):
                starts.append(pending)
            pending = None
    ends = starts[1:] + [len(sql)]
    return [sql[start:end] for start, end in zip(starts, ends, strict=True)]


def read_columns(sql: str, dialect: Dialect) -> frozenset[SourceColumn]:
    """The (table, column) pairs the projections of every SELECT in the SQL read"""
    return read_projections(sql, dialect)[0]


def read_projections(sql: str, dialect: Dialect) -> tuple[frozenset[SourceColumn], AliasReads]:
    """
    The (table, column) pairs the projections of every SELECT in the SQL read, in all and by
    normalized alias. A column whose table cannot be told is left out, and a pass that does not
    parse reads nothing: it yields no column lineage and leaves table lineage to the lineage parser.
    """
    columns: set[SourceColumn] = set()
    aliases: dict[str, set[SourceColumn]] = {}
    for sql_pass in sql_passes(sql, backslash_escapes(dialect), bracket_quotes(dialect)):
        # A cube built from a file answers with a note, not SQL.
        if not starts_with_sql(sql_pass):
            continue
        try:
            statements = timeout(seconds=LINEAGE_PARSING_TIMEOUT)(sqlglot.parse)(
                sql_pass, read=_sqlglot_dialect(dialect)
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Could not read the columns of a cube SQL pass: %s", exc)
            continue
        for statement in statements:
            scopes: Scopes = {}
            for select in statement.find_all(exp.Select) if statement else ():
                for alias, read in _projection_columns(select, scopes):
                    columns.update(read)
                    if read and (key := normalized(alias)):
                        aliases.setdefault(key, set()).update(read)
    return frozenset(columns), MappingProxyType({key: frozenset(read) for key, read in aliases.items()})


def _cte_names(node: exp.Expression) -> set[str]:
    """
    The CTE names a query or table reference can mean: those of its own WITH and of every enclosing
    query's. Inside a CTE's own body, a non-recursive WITH offers only the CTEs defined before it.
    """
    names: set[str] = set()
    inside_cte, parent = None, node
    while parent is not None:
        if isinstance(parent, exp.CTE):
            inside_cte = parent
        with_ = parent.args.get("with_")
        if isinstance(with_, exp.With):
            ctes = list(with_.expressions)
            position = next((index for index, cte in enumerate(ctes) if cte is inside_cte), None)
            if position is not None and not with_.args.get("recursive"):
                ctes = ctes[:position]
            names.update(cte.alias.lower() for cte in ctes)
        parent = parent.parent
    return names


def _source_keys(table: exp.Table) -> list[str]:
    """
    The names a column can qualify a table by: its alias, else its name with each qualifier the
    SQL gives it (``my_table``, ``s1.my_table``, ``db.s1.my_table``).
    """
    if table.alias:
        return [table.alias.lower()]
    parts = [part for part in (table.catalog, table.db, table.name) if part]
    return [".".join(parts[index:]).lower() for index in range(len(parts))]


# The sources of each SELECT of a statement, read once: keyed by the SELECT's id.
Scopes = dict[int, dict[str, "str | None"]]


def _alias_names(source: exp.Expression) -> list[str]:
    """
    The name a non-table source answers to: its alias. Only an alias without a name lends its
    column its place, which is how sqlglot reads a BigQuery UNNEST (``CROSS JOIN UNNEST(items)
    item``); a column alias of a named source (``VALUES (1) AS v(o)``) names a column, not a source.
    """
    alias = source.args.get("alias")
    if not isinstance(alias, exp.TableAlias):
        return []
    names = [alias.name] if alias.name else [column.name for column in alias.columns]
    return [name.lower() for name in names if name]


def _own_sources(select: exp.Select, scopes: Scopes) -> dict[str, str | None]:
    """
    The sources a SELECT itself reads, by the names a column can qualify them by: a table's name,
    or None for a CTE, derived table, UNNEST, VALUES or LATERAL, whose columns are not warehouse
    columns. A name that two different tables answer to is None too, since it cannot tell them apart.
    """
    if id(select) in scopes:
        return scopes[id(select)]
    sources: dict[str, str | None] = {}
    # No CTE sits between a SELECT and its own sources, so they all see the CTEs the SELECT sees.
    ctes = _cte_names(select)
    for source in select.find_all(exp.Table, exp.Subquery, exp.Unnest, exp.Values, exp.Lateral):
        if source.find_ancestor(exp.Select) is not select:
            continue
        if isinstance(source, exp.Table):
            is_cte = not source.db and not source.catalog and source.name.lower() in ctes
            name = None if is_cte else table_name_of(source)
            for key in _source_keys(source):
                sources[key] = name if key not in sources or sources[key] == name else None
        elif source.arg_key == "laterals" or isinstance(
            source.find_ancestor(exp.From, exp.Join, exp.Select), (exp.From, exp.Join)
        ):
            # A Hive or Spark LATERAL VIEW sits in the SELECT's laterals, not under a FROM or JOIN.
            # A derived table, UNNEST, VALUES or LATERAL reads no warehouse column. Unnamed, it
            # still counts as a source, so an unqualified column is not given to the only table.
            for key in _alias_names(source) or [f"#{id(source)}"]:
                sources[key] = None
    scopes[id(select)] = sources
    return sources


def _resolve(select: exp.Select, alias: str, scopes: Scopes) -> str | None:
    """
    The table an alias names in a SELECT: its own source, else the nearest enclosing query's, so a
    correlated reference reaches the outer table. The walk stops at the first query that defines
    the alias, even as a derived table, so an inner alias never resolves to an outer table.
    """
    scope: exp.Select | None = select
    while scope is not None:
        sources = _own_sources(scope, scopes)
        if alias in sources:
            return sources[alias]
        scope = scope.find_ancestor(exp.Select)
    return None


def _projection_columns(select: exp.Select, scopes: Scopes) -> Iterable[tuple[str, set[SourceColumn]]]:
    """(alias, the warehouse columns it reads) for each projection of a SELECT"""
    sources = set(_own_sources(select, scopes).values())
    only_table = next(iter(sources)) if len(sources) == 1 else None
    for projection in select.expressions:
        columns = set()
        for column in projection.find_all(exp.Column):
            # A column of a nested query is read with that query, against its own aliases first.
            if column.find_ancestor(exp.Select) is not select:
                continue
            qualifier = ".".join(part for part in (column.catalog, column.db, column.table) if part)
            table = _resolve(select, qualifier.lower(), scopes) if qualifier else only_table
            if table:
                columns.add((table, column.name.lower()))
        yield projection.alias_or_name, columns


def normalized(name: str) -> str:
    """
    ``Order Id`` and ``order_id`` alike, for names a Data Import cube derives from columns. Letters
    and digits of every script are kept, so ``数量`` and ``金额`` stay apart.
    """
    return re.sub(r"[\W_]+", "", name.casefold())


def name_match(name: str, columns: set[str], ambiguous: set[str], repeated: set[str]) -> str | None:
    """
    The one column a Data Import object is named after: the column of the same name, else the only
    column whose normalized name is the object's. None when that is not a single column, when
    another object of the cube has the same name (``repeated``, casefolded), or, for a normalized
    match, when another object normalizes to the same name (``ambiguous``).
    """
    if name.casefold() in repeated:
        return None
    exact = {column for column in columns if column.casefold() == name.casefold()}
    if len(exact) == 1:
        return exact.pop()
    key = normalized(name)
    if not key or key in ambiguous:
        return None
    matches = {column for column in columns if normalized(column) == key}
    return matches.pop() if len(matches) == 1 else None


def same_table(sql_table: str, other: str) -> bool:
    """
    Whether two dot-joined table names can be the same table: equal table names, and equal
    qualifiers wherever both name one (``sales.orders`` is ``project-x.sales.orders``).
    """
    left, right = sql_table.lower().split("."), other.lower().split(".")
    return all(a == b for a, b in zip(reversed(left), reversed(right), strict=False))


def table_matches(sql_table: str, table_name: str, schema_name: str | None, database_name: str | None) -> bool:
    """Whether a table the SQL names (``[database.][schema.]table``) is this table"""
    qualified = [database_name, schema_name, table_name] if schema_name else [table_name]
    return same_table(sql_table, ".".join(part for part in qualified if part))
