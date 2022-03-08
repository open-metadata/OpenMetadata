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
Unique Count Metric definition
"""
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from metadata.orm_profiler.metrics.core import QueryMetric


class UniqueCount(QueryMetric):
    """
    UNIQUE_COUNT Metric

    Given a column, count the number of values appearing only once
    """

    @classmethod
    def name(cls):
        return "uniqueCount"

    @property
    def metric_type(self):
        return int

    def query(self, session: Optional[Session] = None):
        """
        Build the Unique Count metric
        """
        if not session:
            raise AttributeError(
                "We are missing the session attribute to compute the UniqueCount."
            )

        only_once = (
            session.query(func.count(self.col))
            .group_by(self.col)
            .having(func.count(self.col) == 1)  # Values that appear only once
        )

        only_once_cte = only_once.cte("only_once")

        return session.query(func.count().label(self.name())).select_from(only_once_cte)
