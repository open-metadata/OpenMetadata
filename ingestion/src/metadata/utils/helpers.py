#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Helpers module for ingestion related methods
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from functools import wraps
from time import perf_counter
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union

from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.type.tagLabel import TagLabel
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
        options: List[str],
        arguments: List[str],
        schema: Optional[str] = None,
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
    "dist_bar": ChartType.Bar,
    "bar": ChartType.Bar,
    "box_plot": ChartType.BoxPlot,
    "boxplot": ChartType.BoxPlot,
    "histogram": ChartType.Histogram,
    "treemap": ChartType.Area,
    "area": ChartType.Area,
    "pie": ChartType.Pie,
    "text": ChartType.Text,
    "scatter": ChartType.Scatter,
}


def calculate_execution_time(func):
    """
    Method to calculate workflow execution time
    """

    @wraps(func)
    def calculate_debug_time(*args, **kwargs):
        start = perf_counter()
        func(*args, **kwargs)
        end = perf_counter()
        logger.debug(
            f"{func.__name__} executed in { pretty_print_time_duration(end - start)}"
        )

    return calculate_debug_time


def calculate_execution_time_generator(func):
    """
    Generator method to calculate workflow execution time
    """

    def calculate_debug_time(*args, **kwargs):
        start = perf_counter()
        yield from func(*args, **kwargs)
        end = perf_counter()
        logger.debug(
            f"{func.__name__} executed in { pretty_print_time_duration(end - start)}"
        )

    return calculate_debug_time


def pretty_print_time_duration(duration: Union[int, float]) -> str:
    """
    Method to format and display the time
    """

    days = divmod(duration, 86400)[0]
    hours = divmod(duration, 3600)[0]
    minutes = divmod(duration, 60)[0]
    seconds = round(divmod(duration, 60)[1], 2)
    if days:
        return f"{days}day(s) {hours}h {minutes}m {seconds}s"
    if hours:
        return f"{hours}h {minutes}m {seconds}s"
    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"


def get_start_and_end(duration):
    """
    Method to return start and end time based on duration
    """

    today = datetime.utcnow()
    start = (today + timedelta(0 - duration)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
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


def datetime_to_ts(date: Optional[datetime]) -> Optional[int]:
    """
    Convert a given date to a timestamp as an Int in milliseconds
    """
    return int(date.timestamp() * 1_000) if date else None


def get_formatted_entity_name(name: str) -> Optional[str]:
    """
    Method to get formatted entity name
    """

    return (
        name.replace("[", "").replace("]", "").replace("<default>.", "")
        if name
        else None
    )


def replace_special_with(raw: str, replacement: str) -> str:
    """
    Replace special characters in a string by a hyphen
    :param raw: raw string to clean
    :param replacement: string used to replace
    :return: clean string
    """
    return re.sub(r"[^a-zA-Z0-9]", replacement, raw)


def get_standard_chart_type(raw_chart_type: str) -> str:
    """
    Get standard chart type supported by OpenMetadata based on raw chart type input
    :param raw_chart_type: raw chart type to be standardize
    :return: standard chart type
    """
    return om_chart_type_dict.get(raw_chart_type.lower(), ChartType.Other)


def find_in_iter(element: Any, container: Iterable[Any]) -> Optional[Any]:
    """
    If the element is in the container, return it.
    Otherwise, return None
    :param element: to find
    :param container: container with element
    :return: element or None
    """
    return next((elem for elem in container if elem == element), None)


def find_column_in_table(column_name: str, table: Table) -> Optional[Column]:
    """
    If the column exists in the table, return it
    """
    return next(
        (col for col in table.columns if col.name.__root__ == column_name), None
    )


def find_column_in_table_with_index(
    column_name: str, table: Table
) -> Optional[Tuple[int, Column]]:
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
            if str(col.name.__root__).lower() == column_name.lower()
        ),
        (None, None),
    )

    return col_index, col


def list_to_dict(original: Optional[List[str]], sep: str = "=") -> Dict[str, str]:
    """
    Given a list with strings that have a separator,
    convert that to a dictionary of key-value pairs
    """
    if not original:
        return {}

    split_original = [
        (elem.split(sep)[0], elem.split(sep)[1]) for elem in original if sep in elem
    ]
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

    return re.sub(to_replace, replace_by, raw_str, flags=re.IGNORECASE)


def insensitive_match(raw_str: str, to_match: str) -> bool:
    """Match `to_match` in `raw_str` ignoring the raw_str case.

    Args:
        raw_str:str: Define the string that will be searched
        to_match:str: Specify the string to be matched

    Returns:
        True if `to_match` matches in `raw_str`, ignoring case. Otherwise, false.
    """

    return re.match(to_match, raw_str, flags=re.IGNORECASE) is not None


def get_entity_tier_from_tags(tags: list[TagLabel]) -> Optional[str]:
    """_summary_

    Args:
        tags (list[TagLabel]): list of tags

    Returns:
        Optional[str]
    """
    if not tags:
        return None
    return next(
        (
            tag.tagFQN.__root__
            for tag in tags
            if tag.tagFQN.__root__.lower().startswith("tier")
        ),
        None,
    )
