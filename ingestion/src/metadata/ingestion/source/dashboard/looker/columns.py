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
Looker general utilities
"""
from functools import singledispatch
from typing import List, Sequence, Union, cast

from looker_sdk.sdk.api40.models import LookmlModelExplore, LookmlModelExploreField

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.ingestion.source.dashboard.looker.models import LookMlField, LookMlView

# Some docs on types https://cloud.google.com/looker/docs/reference/param-dimension-filter-parameter-types
LOOKER_TYPE_MAP = {
    "average": DataType.NUMBER,
    "average_distinct": DataType.NUMBER,
    "bin": DataType.ARRAY,
    "count": DataType.NUMBER,
    "count_distinct": DataType.NUMBER,
    "date": DataType.DATE,
    "date_date": DataType.DATE,
    "date_day_of_month": DataType.NUMBER,
    "date_day_of_week": DataType.NUMBER,
    "date_day_of_week_index": DataType.NUMBER,
    "date_fiscal_month_num": DataType.NUMBER,
    "date_fiscal_quarter": DataType.DATE,
    "date_fiscal_quarter_of_year": DataType.NUMBER,
    "date_hour": DataType.TIME,
    "date_hour_of_day": DataType.NUMBER,
    "date_month": DataType.DATE,
    "date_month_num": DataType.NUMBER,
    "date_month_name": DataType.NUMBER,
    "date_quarter": DataType.DATE,
    "date_quarter_of_year": DataType.DATE,
    "date_time": DataType.TIME,
    "date_time_of_day": DataType.TIME,
    "date_microsecond": DataType.TIME,
    "date_millisecond": DataType.TIME,
    "date_minute": DataType.TIME,
    "date_raw": DataType.STRING,
    "date_second": DataType.TIME,
    "date_week": DataType.TIME,
    "date_year": DataType.TIME,
    "date_day_of_year": DataType.NUMBER,
    "date_week_of_year": DataType.NUMBER,
    "date_fiscal_year": DataType.DATE,
    "duration_day": DataType.STRING,
    "duration_hour": DataType.STRING,
    "duration_minute": DataType.STRING,
    "duration_month": DataType.STRING,
    "duration_quarter": DataType.STRING,
    "duration_second": DataType.STRING,
    "duration_week": DataType.STRING,
    "duration_year": DataType.STRING,
    "distance": DataType.NUMBER,
    "duration": DataType.NUMBER,
    "int": DataType.NUMBER,
    "list": DataType.ARRAY,
    "location": DataType.UNION,
    "max": DataType.NUMBER,
    "median": DataType.NUMBER,
    "median_distinct": DataType.NUMBER,
    "min": DataType.NUMBER,
    "number": DataType.NUMBER,
    "percent_of_previous": DataType.NUMBER,
    "percent_of_total": DataType.NUMBER,
    "percentile": DataType.NUMBER,
    "percentile_distinct": DataType.NUMBER,
    "running_total": DataType.NUMBER,
    "sum": DataType.NUMBER,
    "sum_distinct": DataType.NUMBER,
    "string": DataType.STRING,
    "tier": DataType.ENUM,
    "time": DataType.TIME,
    "unknown": DataType.UNKNOWN,
    "unquoted": DataType.STRING,
    "yesno": DataType.BOOLEAN,
    "zipcode": DataType.STRING,
}


def get_columns_from_model(
    model: Union[LookmlModelExplore, LookMlView]
) -> List[Column]:
    """
    Obtain the column (measures and dimensions) from the models
    """
    columns = []
    all_fields = get_model_fields(model)
    for field in cast(Sequence[LookmlModelExploreField], all_fields):
        type_ = LOOKER_TYPE_MAP.get(field.type, DataType.UNKNOWN)
        columns.append(
            Column(
                name=field.name,
                displayName=getattr(field, "label_short", None) or field.label,
                dataType=type_,
                # We cannot get the inner type from the sdk of .lkml
                arrayDataType=DataType.UNKNOWN if type_ == DataType.ARRAY else None,
                dataTypeDisplay=field.type,
                description=field.description,
            )
        )

    return columns


@singledispatch
def get_model_fields(
    model: Union[LookmlModelExplore, LookMlView]
) -> List[Union[LookmlModelExploreField, LookMlField]]:
    raise NotImplementedError(f"Missing implementation for type {type(model)}")


@get_model_fields.register
def _(model: LookmlModelExplore) -> List[LookmlModelExploreField]:
    return (model.fields.dimensions or []) + (model.fields.measures or [])


@get_model_fields.register
def _(model: LookMlView) -> List[LookMlField]:
    return (model.dimensions or []) + (model.measures or [])
