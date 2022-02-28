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
Null Count Metric definition
"""
from sqlalchemy import case, func

from metadata.orm_profiler.metrics.core import StaticMetric, _label


class NullCount(StaticMetric):
    """
    NULL COUNT Metric

    Given a column, return the null count.

    We are building a CASE WHEN structure:
    ```
    SUM(
        CASE is not null THEN 1
        ELSE 0
    )
    ```
    """

    @classmethod
    def name(cls):
        return "nullCount"

    def metric_type(self):
        return int

    @_label
    def fn(self):
        return func.sum(case([(self.col.is_(None), 1)], else_=0))
