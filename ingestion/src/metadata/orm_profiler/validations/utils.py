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
Validation Utilities
"""

from typing import Optional, Type

from sqlalchemy import inspect
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.orm_profiler.metrics.core import Metric
from metadata.orm_profiler.profiler.core import Profiler


def run_col_metric(
    metric: Type[Metric],
    session: Session,
    table: DeclarativeMeta,
    column: str,
    profile_sample: Optional[float] = None,
) -> int:
    """
    Runs a metric on a table column and returns the results

    :param metric: Metric to run
    :param session: SQLAlchemy session
    :param table:  ORM table
    :param column: column name
    :param profile_sample: % of the data to run the profiler on
    :return: metric result
    """

    col = next(
        iter([col for col in inspect(table).c if col.name == column]),
        None,
    )

    if col is None:
        raise ValueError(
            f"Cannot find the configured column {column} for ColumnValuesToBeNotInSet"
        )

    res = (
        Profiler(
            metric,
            session=session,
            table=table,
            use_cols=[col],
            profile_sample=profile_sample,
        )
        .execute()
        .column_results
    )

    return res.get(col.name)[metric.name()]
