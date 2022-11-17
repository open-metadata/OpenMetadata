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
AVG Metric definition
"""
# pylint: disable=duplicate-code

import traceback

from sqlalchemy import column, func
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import GenericFunction

from metadata.orm_profiler.metrics.core import CACHE, StaticMetric, _label
from metadata.orm_profiler.orm.functions.length import LenFn
from metadata.orm_profiler.orm.registry import (
    Dialects,
    is_concatenable,
    is_quantifiable,
)
from metadata.utils.logger import profiler_logger

logger = profiler_logger()

# pylint: disable=invalid-name
class avg(GenericFunction):
    name = "avg"
    inherit_cache = CACHE


@compiles(avg, Dialects.ClickHouse)
def _(element, compiler, **kw):
    """Handle case for empty table. If empty, clickhouse returns NaN"""
    proc = compiler.process(element.clauses, **kw)
    return f"if(isNaN(avg({proc})), null, avg({proc}))"


class Mean(StaticMetric):
    """
    AVG Metric

    Given a column, return the AVG value.

    - For a quantifiable value, return the usual AVG
    - For a concatenable (str, text...) return the AVG length
    """

    @classmethod
    def name(cls):
        return "mean"

    @property
    def metric_type(self):
        return float

    @_label
    def fn(self):
        if is_quantifiable(self.col.type):
            return func.avg(column(self.col.name))

        if is_concatenable(self.col.type):
            return func.avg(LenFn(column(self.col.name)))

        logger.debug(
            f"Don't know how to process type {self.col.type} when computing MEAN"
        )
        return None

    @_label
    def dl_fn(self, data_frame=None):
        """
        Data lake function to calculate mean
        """
        import pandas as pd  # pylint: disable=import-outside-toplevel

        try:
            if is_quantifiable(self.col.datatype):
                return data_frame[self.col.name].mean()

            if is_concatenable(self.col.datatype):
                return (
                    pd.DataFrame(
                        [
                            len(f"{concatenable_data}")
                            for concatenable_data in data_frame[
                                self.col.name
                            ].values.tolist()
                        ]
                    )
                    .mean()
                    .tolist()[0]
                )
            raise NotImplementedError()
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Don't know how to process type {self.col.datatype} when computing MEAN, Error: {err}"
            )
            return 0
