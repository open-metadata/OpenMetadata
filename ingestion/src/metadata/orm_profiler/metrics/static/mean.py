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
from sqlalchemy import func
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.orm_profiler.metrics.core import CACHE, StaticMetric, _label
from metadata.orm_profiler.orm.registry import is_concatenable, is_quantifiable
from metadata.orm_profiler.utils import logger

logger = logger()


class ConcatAvgFn(FunctionElement):
    name = __qualname__
    inherit_cache = CACHE


@compiles(ConcatAvgFn)
def _(element, compiler, **kw):
    return "AVG(LEN(%s))" % compiler.process(element.clauses, **kw)


@compiles(ConcatAvgFn, DatabaseServiceType.SQLite.value.lower())
def _(element, compiler, **kw):
    return "AVG(LENGTH(%s))" % compiler.process(element.clauses, **kw)


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
            return func.avg(self.col)

        if is_concatenable(self.col.type):
            return ConcatAvgFn(self.col)

        logger.debug(
            f"Don't know how to process type {self.col.type} when computing MEAN"
        )
        return None
