"""
Test helpers for SQL lineage testing across multiple parsers.
"""

from typing import List, NamedTuple, Optional, Set, Tuple

import networkx as nx
from collate_sqllineage.core.models import Column, SubQuery, Table
from collate_sqllineage.core.parser.sqlfluff.analyzer import SqlFluffLineageAnalyzer
from collate_sqllineage.core.parser.sqlglot.analyzer import SqlGlotLineageAnalyzer
from collate_sqllineage.core.parser.sqlparse.analyzer import SqlParseLineageAnalyzer
from collate_sqllineage.runner import LineageRunner

from metadata.ingestion.lineage.masker import mask_query, masked_query_cache

PARSER_MAP = {
    "SqlGlot": SqlGlotLineageAnalyzer,
    "SqlFluff": SqlFluffLineageAnalyzer,
    "SqlParse": SqlParseLineageAnalyzer,
}


class TestColumnQualifierTuple(NamedTuple):
    column: str
    qualifier: Optional[str]
    is_subquery: Optional[bool] = False
    subquery: Optional[str] = None


def assert_table_lineage(
    lr: LineageRunner,
    source_tables: Optional[Set[str]] = None,
    target_tables: Optional[Set[str]] = None,
    parser_name: str = None,
):
    """
    Assert table lineage matches expected values.

    :param lr: LineageRunner instance
    :param source_tables: Expected source tables
    :param target_tables: Expected target tables
    :param parser_name: Name of parser being tested (for error messages)
    """
    parser_prefix = f"[{parser_name}] " if parser_name else ""

    for _type, actual, expected in zip(
        ["Source", "Target"],
        [lr.source_tables, lr.target_tables],
        [source_tables, target_tables],
    ):
        actual = set(actual)
        expected = (
            set()
            if expected is None
            else {Table(t) if isinstance(t, str) else t for t in expected}
        )
        assert (
            actual == expected
        ), f"\n\t{parser_prefix}Expected {_type} Table: {expected}\n\t{parser_prefix}Actual {_type} Table: {actual}"


def assert_column_lineage(
    lr: LineageRunner,
    column_lineages: Optional[
        List[Tuple[TestColumnQualifierTuple, TestColumnQualifierTuple]]
    ] = None,
    parser_name: str = None,
):
    """
    Assert column lineage matches expected values.

    :param lr: LineageRunner instance
    :param column_lineages: Expected column lineages
    :param parser_name: Name of parser being tested (for error messages)
    """
    parser_prefix = f"[{parser_name}] " if parser_name else ""

    expected = set()
    if column_lineages:
        for src, tgt in column_lineages:
            src_col: Column = Column(src.column)
            if src.qualifier is not None:
                if not src.is_subquery:
                    src_col.parent = Table(src.qualifier)
                else:
                    src_col.parent = SubQuery(
                        subquery=src.subquery,
                        subquery_raw=src.subquery,
                        alias=src.qualifier,
                    )
            tgt_col: Column = Column(tgt.column)
            if not tgt.is_subquery:
                tgt_col.parent = Table(tgt.qualifier)
            else:
                tgt_col.parent = SubQuery(
                    subquery=tgt.subquery,
                    subquery_raw=tgt.subquery,
                    alias=tgt.qualifier,
                )
            expected.add((src_col, tgt_col))
    actual = {(lineage[0], lineage[-1]) for lineage in set(lr.get_column_lineage())}

    assert set(actual) == expected, (
        f"\n\t{parser_prefix}Expected Lineage: {expected}\n\t{parser_prefix}Actual Lineage: {actual}"
        f"\n\t{parser_prefix}Differences: {expected-actual} vs {actual-expected}"
    )


def assert_table_lineage_equal(
    sql: str,
    source_tables: Optional[Set[str]] = None,
    target_tables: Optional[Set[str]] = None,
    dialect: str = "ansi",
    test_sqlglot: bool = True,
    test_sqlfluff: bool = True,
    test_sqlparse: bool = True,
    skip_graph_check: bool = False,
):
    """
    Test table lineage across all three parsers in order: SqlGlot, SqlFluff, SqlParse.

    All three parsers must pass for the test to succeed.

    :param sql: SQL statement to test
    :param source_tables: Expected source tables
    :param target_tables: Expected target tables
    :param dialect: SQL dialect to use (for SqlGlot and SqlFluff)
    :param test_sqlglot: Whether to test with SqlGlot parser
    :param test_sqlfluff: Whether to test with SqlFluff parser
    :param test_sqlparse: Whether to test with SqlParse parser
    :param skip_graph_check: Skip graph isomorphism check (useful when parsers differ in column lineage)
    """
    runners = []

    # SqlGlot (first)
    if test_sqlglot:
        lr_sqlglot = LineageRunner(
            sql, dialect=dialect, analyzer=SqlGlotLineageAnalyzer
        )
        assert_table_lineage(
            lr_sqlglot, source_tables, target_tables, parser_name="SqlGlot"
        )
        runners.append(("sqlglot", lr_sqlglot))

    # SqlFluff (second)
    if test_sqlfluff:
        lr_sqlfluff = LineageRunner(
            sql, dialect=dialect, analyzer=SqlFluffLineageAnalyzer
        )
        assert_table_lineage(
            lr_sqlfluff, source_tables, target_tables, parser_name="SqlFluff"
        )
        runners.append(("sqlfluff", lr_sqlfluff))

    # SqlParse (third)
    if test_sqlparse:
        lr_sqlparse = LineageRunner(
            sql, dialect=dialect, analyzer=SqlParseLineageAnalyzer
        )
        assert_table_lineage(
            lr_sqlparse, source_tables, target_tables, parser_name="SqlParse"
        )
        runners.append(("sqlparse", lr_sqlparse))

    # Compare graphs between all enabled parsers - ALL must match
    if len(runners) > 1 and not skip_graph_check:
        for i in range(len(runners) - 1):
            for j in range(i + 1, len(runners)):
                name1, runner1 = runners[i]
                name2, runner2 = runners[j]

                # For table lineage tests, extract table-only subgraphs
                # (exclude Column nodes to avoid mismatches when parsers differ in column lineage)
                graph1 = runner1._sql_holder.graph
                graph2 = runner2._sql_holder.graph

                # Create subgraphs excluding Column nodes
                table_graph1 = graph1.subgraph(
                    [n for n in graph1.nodes() if not isinstance(n, Column)]
                )
                table_graph2 = graph2.subgraph(
                    [n for n in graph2.nodes() if not isinstance(n, Column)]
                )

                assert nx.is_isomorphic(table_graph1, table_graph2), (
                    f"\n\tTable-level graph with {name1}: {table_graph1}\n\t"
                    f"Table-level graph with {name2}: {table_graph2}"
                )


def assert_column_lineage_equal(
    sql: str,
    column_lineages: Optional[
        List[Tuple[TestColumnQualifierTuple, TestColumnQualifierTuple]]
    ] = None,
    dialect: str = "ansi",
    test_sqlglot: bool = True,
    test_sqlfluff: bool = True,
    test_sqlparse: bool = True,
    skip_graph_check: bool = False,
):
    """
    Test column lineage across all three parsers in order: SqlGlot, SqlFluff, SqlParse.

    All three parsers must pass for the test to succeed.

    :param sql: SQL statement to test
    :param column_lineages: Expected column lineages
    :param dialect: SQL dialect to use (for SqlGlot and SqlFluff)
    :param test_sqlglot: Whether to test with SqlGlot parser
    :param test_sqlfluff: Whether to test with SqlFluff parser
    :param test_sqlparse: Whether to test with SqlParse parser
    :param skip_graph_check: Skip graph isomorphism check (useful when parsers differ in column lineage)
    """
    runners = []

    # SqlGlot (first)
    if test_sqlglot:
        lr_sqlglot = LineageRunner(
            sql, dialect=dialect, analyzer=SqlGlotLineageAnalyzer
        )
        assert_column_lineage(lr_sqlglot, column_lineages, parser_name="SqlGlot")
        runners.append(("sqlglot", lr_sqlglot))

    # SqlFluff (second)
    if test_sqlfluff:
        lr_sqlfluff = LineageRunner(
            sql, dialect=dialect, analyzer=SqlFluffLineageAnalyzer
        )
        assert_column_lineage(lr_sqlfluff, column_lineages, parser_name="SqlFluff")
        runners.append(("sqlfluff", lr_sqlfluff))

    # SqlParse (third)
    if test_sqlparse:
        lr_sqlparse = LineageRunner(
            sql, dialect=dialect, analyzer=SqlParseLineageAnalyzer
        )
        assert_column_lineage(lr_sqlparse, column_lineages, parser_name="SqlParse")
        runners.append(("sqlparse", lr_sqlparse))

    # Compare graphs between all enabled parsers - ALL must match
    if not skip_graph_check:
        for i in range(len(runners) - 1):
            for j in range(i + 1, len(runners)):
                name1, runner1 = runners[i]
                name2, runner2 = runners[j]
                assert nx.is_isomorphic(
                    runner1._sql_holder.graph, runner2._sql_holder.graph
                ), (
                    f"\n\tGraph with {name1}: {runner1._sql_holder.graph}\n\t"
                    f"Graph with {name2}: {runner2._sql_holder.graph}"
                )


def assert_lr_graphs_match(
    lr1: LineageRunner,
    lr2: LineageRunner,
    name1: str = "parser1",
    name2: str = "parser2",
) -> None:
    """
    Assert that two LineageRunner graphs are isomorphic.

    :param lr1: First LineageRunner
    :param lr2: Second LineageRunner
    :param name1: Name of first parser (for error messages)
    :param name2: Name of second parser (for error messages)
    """
    assert nx.is_isomorphic(lr1._sql_holder.graph, lr2._sql_holder.graph), (
        f"\n\tGraph with {name1}: {lr1._sql_holder.graph}\n\t"
        f"Graph with {name2}: {lr2._sql_holder.graph}"
    )


def assert_masked_query(sql: str, masked_query: str, dialect: str, parser_name: str):
    """
    Helper function to test query masking with a specific parser and assert the result.

    :param sql: SQL statement to test
    :param masked_query: Expected masked query
    :param dialect: SQL dialect to use (for SqlGlot and SqlFluff)
    :param parser_name: Name of parser being tested (for error messages)
    """
    analyzer_class = PARSER_MAP[parser_name]

    parser_prefix = f"[{parser_name}] " if parser_name else ""

    # clear cache before each test
    masked_query_cache.clear()

    parser = LineageRunner(sql, dialect=dialect, analyzer=analyzer_class)
    len(parser.source_tables)  # Force parsing

    actual = mask_query(sql, dialect=dialect, parser=parser)
    expected = masked_query

    assert (
        actual == expected
    ), f"\n\t{parser_prefix}Expected Masked Query: {expected}\n\t{parser_prefix}Actual Masked Query: {actual}"
