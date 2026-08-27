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
Helpers module for ingestion related methods
"""

from __future__ import annotations

import ast
import hashlib
import itertools
import pprint
import re
import shutil
import sys
from datetime import datetime, timedelta, timezone
from math import floor, log
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union  # noqa: UP035

import sqlparse
from pydantic_core import Url  # noqa: TC002
from sqlparse import tokens as sql_tokens
from sqlparse.sql import Function, Parenthesis, Statement, TokenList

from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.table import Column, Table  # noqa: TC001
from metadata.generated.schema.entity.feed.suggestion import Suggestion, SuggestionType  # noqa: TC001
from metadata.generated.schema.entity.services.databaseService import DatabaseService  # noqa: TC001
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityLink  # noqa: TC001
from metadata.generated.schema.type.tagLabel import TagLabel  # noqa: TC001
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.logger import utils_logger

logger = utils_logger()


class BackupRestoreArgs:
    def __init__(  # pylint: disable=too-many-arguments
        self,
        host: str,
        user: str,
        password: str,
        database: str,
        port: str,
        options: List[str],  # noqa: UP006
        arguments: List[str],  # noqa: UP006
        schema: Optional[str] = None,  # noqa: UP045
    ):
        self.host = host
        self.user = user
        self.password = password
        self.database = database
        self.port = port
        self.options = options
        self.arguments = arguments
        self.schema = schema


class DockerActions:
    def __init__(
        self,
        start: bool,
        stop: bool,
        pause: bool,
        resume: bool,
        clean: bool,
        reset_db: bool,
    ):
        self.start = start
        self.stop = stop
        self.pause = pause
        self.resume = resume
        self.clean = clean
        self.reset_db = reset_db


om_chart_type_dict = {
    "line": ChartType.Line,
    "big_number": ChartType.Line,
    "big_number_total": ChartType.Line,
    "dual_line": ChartType.Line,
    "line_multi": ChartType.Line,
    "table": ChartType.Table,
    "levelTable": ChartType.Table,
    "dist_bar": ChartType.Bar,
    "bar": ChartType.Bar,
    "vertical_bar": ChartType.Bar,
    "box_plot": ChartType.BoxPlot,
    "box": ChartType.BoxPlot,
    "boxplot": ChartType.BoxPlot,
    "histogram": ChartType.Histogram,
    "treemap": ChartType.Area,
    "area": ChartType.Area,
    "pie": ChartType.Pie,
    "text": ChartType.Text,
    "scatter": ChartType.Scatter,
    "gauge": ChartType.Gauge,
    "map": ChartType.Map,
    "graph": ChartType.Graph,
    "heatmap": ChartType.Heatmap,
    "timeline": ChartType.Timeline,
}


def pretty_print_time_duration(duration: Union[int, float]) -> str:  # noqa: UP007
    """
    Method to format and display the time
    """

    days = divmod(duration, 86400)[0]
    duration = duration - days * 86400
    hours = divmod(duration, 3600)[0]
    duration = duration - hours * 3600
    minutes = divmod(duration, 60)[0]
    duration = duration - minutes * 60
    seconds = divmod(duration, 1)[0]
    duration = duration - seconds
    milliseconds = duration * 1000

    # Format with proper zero-padding for alignment when part of larger time units
    if days:
        return f"{int(days)}day(s) {int(hours):02d}h {int(minutes):02d}m {int(seconds):02d}s {milliseconds:07.3f}ms"
    if hours:
        return f"{int(hours)}h {int(minutes):02d}m {int(seconds):02d}s {milliseconds:07.3f}ms"
    if minutes:
        return f"{int(minutes)}m {int(seconds):02d}s {milliseconds:07.3f}ms"
    if seconds:
        return f"{int(seconds)}s {milliseconds:07.3f}ms"
    return f"{milliseconds:.3f}ms"


def get_start_and_end(duration: int = 0) -> Tuple[datetime, datetime]:  # noqa: UP006
    """
    Method to return start and end time based on duration
    """

    today = datetime.now(timezone.utc).replace(tzinfo=None)
    start = (today + timedelta(0 - duration)).replace(hour=0, minute=0, second=0, microsecond=0)
    # Add one day to make sure we are handling today's queries
    end = (today + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, end


def snake_to_camel(snake_str):
    """
    Method to convert snake case text to camel case
    """
    split_str = snake_str.split("_")
    split_str[0] = split_str[0].capitalize()
    if len(split_str) > 1:
        split_str[1:] = [u.title() for u in split_str[1:]]
    return "".join(split_str)


def datetime_to_ts(date: Optional[datetime]) -> Optional[int]:  # noqa: UP045
    """
    Convert a given date to a timestamp as an Int in milliseconds
    """
    return int(date.timestamp() * 1_000) if date else None


def get_formatted_entity_name(name: str) -> Optional[str]:  # noqa: UP045
    """
    Method to get formatted entity name
    """

    return name.replace("[", "").replace("]", "").replace("<default>.", "") if name else None


def has_table_name(name: Optional[str]) -> bool:  # noqa: UP045
    """
    Check that a table reference coming from a query parser actually holds a table name.

    Query parsers can return references whose table part is empty, e.g. `db.schema.` when
    the query contains an empty identifier (`db.schema.""`). There is nothing to look up in
    those, so they are dropped instead of failing later on while building the FQN.
    """
    return bool(name and name.rsplit(".", maxsplit=1)[-1].strip())


def replace_special_with(raw: str, replacement: str) -> str:
    """
    Replace special characters in a string by a hyphen
    :param raw: raw string to clean
    :param replacement: string used to replace
    :return: clean string
    """
    return re.sub(r"[^a-zA-Z0-9]", replacement, raw)


def get_standard_chart_type(raw_chart_type: str) -> ChartType:
    """
    Get standard chart type supported by OpenMetadata based on raw chart type input
    :param raw_chart_type: raw chart type to be standardize
    :return: standard chart type
    """
    if raw_chart_type is not None:
        return om_chart_type_dict.get(raw_chart_type.lower(), ChartType.Other)
    return ChartType.Other


def find_in_iter(element: Any, container: Iterable[Any]) -> Optional[Any]:  # noqa: UP045
    """
    If the element is in the container, return it.
    Otherwise, return None
    :param element: to find
    :param container: container with element
    :return: element or None
    """
    logger.debug(f"[find_in_iter] Searching for element '{element}'")
    return next((elem for elem in container if elem == element), None)


def find_column_in_table(column_name: str, table: Table, case_sensitive: bool = True) -> Optional[Column]:  # noqa: UP045
    """
    If the column exists in the table, return it
    """

    def equals(first: str, second: str) -> bool:
        if case_sensitive:
            return first == second
        return first.lower() == second.lower()

    return next((col for col in table.columns if equals(col.name.root, column_name)), None)


def find_suggestion(
    suggestions: List[Suggestion],  # noqa: UP006
    suggestion_type: SuggestionType,
    entity_link: EntityLink,
) -> Optional[Suggestion]:  # noqa: UP045
    """Given a list of suggestions, a suggestion type and an entity link, find
    one suggestion in the list that matches the criteria
    """
    return next(
        (sugg for sugg in suggestions if sugg.root.type == suggestion_type and sugg.root.entityLink == entity_link),
        None,
    )


def find_column_in_table_with_index(column_name: str, table: Table) -> Optional[Tuple[int, Column]]:  # noqa: UP006, UP045
    """Return a column and its index in a Table Entity

    Args:
         column_name (str): column to find
         table (Table): Table Entity

    Return:
          A tuple of Index, Column if the column is found
    """
    col_index, col = next(
        (
            (col_index, col)
            for col_index, col in enumerate(table.columns)
            if str(col.name.root).lower() == column_name.lower()
        ),
        (None, None),
    )

    return col_index, col


def list_to_dict(original: Optional[List[str]], sep: str = "=") -> Dict[str, str]:  # noqa: UP006, UP045
    """
    Given a list with strings that have a separator,
    convert that to a dictionary of key-value pairs
    """
    if not original:
        return {}

    split_original = [(elem.split(sep)[0], elem.split(sep)[1]) for elem in original if sep in elem]
    return dict(split_original)


def clean_up_starting_ending_double_quotes_in_string(string: str) -> str:
    """Remove start and ending double quotes in a string

    Args:
        string (str): a string

    Raises:
        TypeError: An error occure checking the type of `string`

    Returns:
        str: a string with no double quotes
    """
    if not isinstance(string, str):
        raise TypeError(f"{string}, must be of type str, instead got `{type(string)}`")

    return string.strip('"')


def insensitive_replace(raw_str: str, to_replace: str, replace_by: str) -> str:
    """Replace `to_replace` by `replace_by` in `raw_str` ignoring the raw_str case.

    Args:
        raw_str:str: Define the string that will be searched
        to_replace:str: Specify the string to be replaced
        replace_by:str: Replace the to_replace:str parameter in the raw_str:str string

    Returns:
        A string where the given to_replace is replaced by replace_by in raw_str, ignoring case
    """

    return re.sub(to_replace, replace_by, raw_str, flags=re.IGNORECASE | re.DOTALL)


def insensitive_match(raw_str: str, to_match: str) -> bool:
    """Match `to_match` in `raw_str` ignoring the raw_str case.

    Args:
        raw_str:str: Define the string that will be searched
        to_match:str: Specify the string to be matched

    Returns:
        True if `to_match` matches in `raw_str`, ignoring case. Otherwise, false.
    """

    return re.match(to_match, raw_str, flags=re.IGNORECASE | re.DOTALL) is not None


def get_entity_tier_from_tags(tags: list[TagLabel]) -> Optional[str]:  # noqa: UP045
    """_summary_

    Args:
        tags (list[TagLabel]): list of tags

    Returns:
        Optional[str]
    """
    if not tags:
        return None
    return next(
        (tag.tagFQN.root for tag in tags if tag.tagFQN.root.lower().startswith("tier")),
        None,
    )


def format_large_string_numbers(number: Union[float, int]) -> str:  # noqa: UP007
    """Format large string number to a human readable format.
    (e.g. 1,000,000 -> 1M, 1,000,000,000 -> 1B, etc)

    Args:
        number: number
    """
    if number == 0:
        return "0"
    units = ["", "K", "M", "B", "T"]
    constant_k = 1000.0
    magnitude = int(floor(log(abs(number), constant_k)))  # noqa: RUF046
    if magnitude >= len(units):
        return f"{int(number / constant_k**magnitude)}e{magnitude * 3}"
    return f"{number / constant_k**magnitude:.3f}{units[magnitude]}"


def clean_uri(uri: Union[str, Url]) -> str:  # noqa: UP007
    """
    if uri is like http://localhost:9000/
    then remove the end / and
    make it http://localhost:9000
    """
    # force a string of the given Uri if needed
    uri = str(uri)
    return uri[:-1] if uri.endswith("/") else uri


def deep_size_of_dict(obj: dict) -> int:
    """Get deepsize of dict data structure

    Args:
        obj (dict): dict data structure
    Returns:
        int: size of dict data structure
    """
    # pylint: disable=unnecessary-lambda-assignment
    dict_handler = lambda elmt: itertools.chain.from_iterable(elmt.items())  # noqa: E731
    handlers = {
        dict: dict_handler,
        list: iter,
    }

    seen = set()

    def sizeof(obj) -> int:
        if id(obj) in seen:
            return 0

        seen.add(id(obj))
        size = sys.getsizeof(obj, 0)
        for type_, handler in handlers.items():
            if isinstance(obj, type_):
                size += sum(map(sizeof, handler(obj)))
                break

        return size

    return sizeof(obj)


_FORBIDDEN_SQL_STATEMENT_TYPES = {
    "CREATE",
    "ALTER",
    "DROP",
    "TRUNCATE",
    "INSERT",
    "UPDATE",
    "DELETE",
    "MERGE",
}
_FORBIDDEN_SQL_STATEMENT_STARTS = _FORBIDDEN_SQL_STATEMENT_TYPES | {
    "COMMENT",
    "RENAME",
    "CALL",
    "GRANT",
    "REVOKE",
    "BEGIN",
    "COMMIT",
    "ROLLBACK",
    "SAVEPOINT",
    "COPY",
    "EXEC",
    "EXECUTE",
}
_FORBIDDEN_SQL_STATEMENT_PREFIXES = {
    ("EXPLAIN", "PLAN"),
    ("LOCK", "TABLE"),
    ("UNLOCK", "TABLE"),
    ("SET", "TRANSACTION"),
}
_FORBIDDEN_SQL_CLAUSES = {
    ("INTO", "OUTFILE"),
    ("INTO", "DUMPFILE"),
}
_FORBIDDEN_SQL_FUNCTIONS = {
    "LOAD_FILE",
    "PG_READ_FILE",
    "PG_WRITE_FILE",
    "PG_READ_BINARY_FILE",
    "LO_IMPORT",
    "LO_EXPORT",
    "LO_FROM_BYTEA",
    "LO_GET",
    "XP_CMDSHELL",
    "XP_REGREAD",
    "XP_REGWRITE",
    "XP_SERVICECONTROL",
    "SP_OACREATE",
    "SP_OAMETHOD",
}


def _significant_sql_tokens(statement: Statement) -> list:
    return [token for token in statement.flatten() if not token.is_whitespace and token.ttype not in sql_tokens.Comment]


def _normalized_sql_values(statement: Statement) -> list[str]:
    return [token.normalized.upper() for token in _significant_sql_tokens(statement)]


def _starts_with_forbidden_sql_statement(statement: Statement) -> bool:
    values = _normalized_sql_values(statement)
    if not values:
        return False
    if statement.get_type().upper() in _FORBIDDEN_SQL_STATEMENT_TYPES:
        return True
    if values[0] in _FORBIDDEN_SQL_STATEMENT_STARTS:
        return True
    return any(values[: len(prefix)] == list(prefix) for prefix in _FORBIDDEN_SQL_STATEMENT_PREFIXES)


def _contains_forbidden_nested_sql_statement(token_list: TokenList) -> bool:
    for token in token_list.tokens:
        if isinstance(token, Parenthesis) and not isinstance(token.parent, Function):
            for nested_statement in sqlparse.parse(token.value[1:-1]):
                if _starts_with_forbidden_sql_statement(nested_statement):
                    return True
                if _contains_forbidden_nested_sql_statement(nested_statement):
                    return True
        elif token.is_group and _contains_forbidden_nested_sql_statement(token):
            return True
    return False


def is_safe_sql_query(sql_query: str) -> bool:
    """Validate SQL query
    Args:
        sql_query (str): SQL query
    Returns:
        bool
    """

    if sql_query is None:
        return True

    parsed_queries: Tuple[Statement] = sqlparse.parse(sql_query)  # noqa: UP006
    for parsed_query in parsed_queries:
        if _starts_with_forbidden_sql_statement(parsed_query):
            return False
        if _contains_forbidden_nested_sql_statement(parsed_query):
            return False

        tokens = _significant_sql_tokens(parsed_query)
        normalized_tokens = [token.normalized.upper() for token in tokens]
        for index, normalized_token in enumerate(normalized_tokens):
            if (
                normalized_token.strip('`"[]') in _FORBIDDEN_SQL_FUNCTIONS
                and index + 1 < len(normalized_tokens)
                and normalized_tokens[index + 1] == "("
            ):
                return False
        if any(
            normalized_tokens[index : index + len(clause)] == list(clause)
            for clause in _FORBIDDEN_SQL_CLAUSES
            for index in range(len(normalized_tokens) - len(clause) + 1)
        ):
            return False
    return True


def is_safe_pandas_query(query_expression: Optional[str]) -> bool:  # noqa: UP045
    """Validate a pandas ``DataFrame.query()`` expression.

    ``DataFrame.query()`` evaluates a Python expression in-process, so a filter must
    not reach any function call, attribute access, or calling-frame variable (those
    allow arbitrary execution, e.g. ``col.to_csv(...)`` or ``@local``). The expression
    is parsed and every node is required to be a comparison, boolean, or arithmetic
    operation over bare column names and literals. Backtick-quoted column identifiers
    are blanked first so unusual column names do not fail the parse, and a ``@name``
    frame reference is rejected because it is not valid Python.

    Args:
        query_expression (str): pandas filter expression
    Returns:
        bool
    """
    if query_expression is None:
        return True

    # Only comparisons, boolean and arithmetic operators over bare column names and
    # literals are allowed. Any Call or Attribute node is rejected, so no Series method
    # (to_csv, values.tofile, .str...) and no @frame variable can be reached. Operators
    # are listed explicitly to exclude MatMult: pandas reserves `@` for calling-frame
    # variable references, so `a @ b` must not be treated as a safe filter.
    allowed_nodes = (
        ast.Expression,
        ast.BoolOp,
        ast.BinOp,
        ast.UnaryOp,
        ast.Compare,
        ast.Name,
        ast.Constant,
        ast.List,
        ast.Tuple,
        ast.Set,
        ast.Load,
        ast.boolop,
        ast.unaryop,
        ast.cmpop,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Mod,
        ast.Pow,
        ast.FloorDiv,
        ast.BitAnd,
        ast.BitOr,
        ast.BitXor,
        ast.LShift,
        ast.RShift,
    )

    # Blank backtick-quoted column identifiers so unusual names do not fail the parse.
    sanitized = re.sub(r"`[^`]*`", "col", query_expression)
    try:
        tree = ast.parse(sanitized, mode="eval")
    except SyntaxError:
        return False
    return all(isinstance(node, allowed_nodes) for node in ast.walk(tree))


def get_database_name_for_lineage(db_service_entity: DatabaseService, default_db_name: Optional[str]) -> Optional[str]:  # noqa: UP045
    # If the database service supports multiple db or
    # database service connection details are not available
    # then pick the database name available from api response
    if db_service_entity.connection is None or hasattr(db_service_entity.connection.config, "supportsDatabase"):
        return default_db_name

    # otherwise if it is an single db source then use "databaseName"
    # and if databaseName field is not available or is empty then use
    # "default" as database name
    return db_service_entity.connection.config.__dict__.get("databaseName") or DEFAULT_DATABASE


def delete_dir_content(directory: str) -> None:
    location = Path(directory)
    if location.is_dir():
        logger.info("Location exists, cleaning it up")
        shutil.rmtree(directory)


def init_staging_dir(directory: str) -> None:
    """
    Prepare the the staging directory
    """
    delete_dir_content(directory=directory)
    location = Path(directory)
    logger.info(f"Creating the directory to store staging data in {location}")
    location.mkdir(parents=True, exist_ok=True)


def retry_with_docker_host(config: Optional[WorkflowSource] = None):  # noqa: UP045
    """
    Retries the function on exception, replacing "localhost" with "host.docker.internal"
    in the `hostPort` config if applicable. Raises the original exception if no `config` is found.
    """

    def decorator(func):
        def wrapper(*args, **kwargs):
            nonlocal config
            try:
                func(*args, **kwargs)
            except Exception as error:
                config = config or kwargs.get("config")
                if not config:
                    for argument in args:
                        if isinstance(argument, WorkflowSource):
                            config = argument
                            break
                    else:
                        raise error  # noqa: TRY201

                service_connection = getattr(config, "serviceConnection", None)
                connection_config = getattr(getattr(service_connection, "root", None), "config", None)
                host_port = getattr(connection_config, "hostPort", None)
                host_port_str = str(host_port or "")
                if connection_config is None or host_port is None or "localhost" not in host_port_str:
                    raise error  # noqa: TRY201

                docker_host_port_str = host_port_str.replace("localhost", "host.docker.internal")
                setattr(  # noqa: B010
                    connection_config, "hostPort", type(host_port)(docker_host_port_str)
                )
                func(*args, **kwargs)

        return wrapper

    return decorator


def get_query_hash(query: str) -> str:
    result = hashlib.md5(query.encode())
    return str(result.hexdigest())


def evaluate_threshold(threshold: int, operator: str, result: int) -> bool:
    """Evaluate the threshold against the result.

    Args:
        threshold: A string representing a comparison threshold (e.g., "< 5", ">= 10").
        result: The integer value to compare against the threshold.

    Returns:
        True if the result satisfies the threshold condition, False otherwise.
        If no comparison operator is provided, it defaults to less than or equal to comparison.
        Returns False for invalid threshold formats.
    """
    import operator as op  # pylint: disable=import-outside-toplevel

    operators = {
        "<": op.lt,
        "<=": op.le,
        ">": op.gt,
        ">=": op.ge,
        "==": op.eq,
        "!=": op.ne,
    }
    op_func = operators.get(operator, op.le)
    try:
        if op_func:
            return op_func(result, threshold)
    except ValueError:
        return False

    # Fallback:
    logger.error(f"Invalid threshold: {threshold}, Allowed format: <, >, <=, >=, ==, !=. Example: >5")
    raise ValueError(f"Invalid threshold: {threshold}, Allowed format: <, >, <=, >=, ==, !=. Example: >5")


def pprint_format_object(data: Any) -> str:
    """
    Pretty print an object in a format that is easy to read
    """
    return pprint.pformat(data, width=150)


def can_spawn_child_process() -> bool:
    """
    Check if the current process can spawn a child process
    """
    # pylint: disable=import-outside-toplevel
    from multiprocessing import Process

    process = Process(target=lambda: None)
    return not process.daemon
