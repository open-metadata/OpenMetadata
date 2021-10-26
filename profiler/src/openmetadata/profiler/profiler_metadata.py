#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#   http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel


def get_group_by_cte(column_name, table_name):
    where = f"{column_name} IS NOT NULL"

    return (
        f"WITH group_by_value AS ( \n"
        f"  SELECT \n"
        f"    {column_name} AS value, \n"
        f"    COUNT(*) AS frequency \n"
        f"  FROM {table_name} \n"
        f"  WHERE {where} \n"
        f"  GROUP BY {column_name} \n"
        f")"
    )


def get_group_by_cte_numeric_value_expression(column, database, validity_format):
    if column.is_number or column.is_time:
        return "value"
    if column.is_column_numeric_text_format:
        return database.sql_expr_cast_text_to_number("value", validity_format)


def get_order_by_cte_value_expression(
    column, database, validity_format, numeric_value_expr: str
):
    if column.is_number or column.is_time:
        return "value"
    if column.is_column_numeric_text_format:
        return database.sql_expr_cast_text_to_number("value", validity_format)
    elif column.is_text:
        return "value"
    return None


class SupportedDataType(Enum):
    NUMERIC = 1
    TEXT = 2
    TIME = 3


class Column(BaseModel):
    """Column Metadata"""

    name: str
    nullable: bool = None
    data_type: str
    logical_type: SupportedDataType

    def is_text(self) -> bool:
        return self.logical_type == SupportedDataType.TEXT

    def is_number(self) -> bool:
        return self.logical_type == SupportedDataType.NUMERIC

    def is_time(self) -> bool:
        return self.logical_type == SupportedDataType.TIME


class Table(BaseModel):
    """Table Metadata"""

    name: str
    columns: List[Column] = []


class GroupValue(BaseModel):
    """Metrinc Group Values"""

    group: Dict = {}
    value: object

    class Config:
        arbitrary_types_allowed = True


class MetricMeasurement(BaseModel):
    """Metric Measurement"""

    name: str
    col_name: str
    value: object = None

    class Config:
        arbitrary_types_allowed = True


class TableProfileResult(BaseModel):
    """Table Profile Result"""

    name: str
    row_count: int = None
    col_count: int = None


class ColumnProfileResult(BaseModel):
    name: str
    measurements: Dict[str, MetricMeasurement] = {}


class ProfileResult(BaseModel):
    """Profile Run Result"""

    profile_date: str
    table_result: TableProfileResult
    columns_result: Dict[str, ColumnProfileResult] = {}
