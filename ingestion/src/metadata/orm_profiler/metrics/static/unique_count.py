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

from sqlalchemy import column, func
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.orm_profiler.metrics.core import QueryMetric
from metadata.orm_profiler.orm.registry import NOT_COMPUTE
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


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

    def query(
        self, sample: Optional[DeclarativeMeta], session: Optional[Session] = None
    ):
        """
        Build the Unique Count metric
        """
        if not session:
            raise AttributeError(
                "We are missing the session attribute to compute the UniqueCount."
            )

        if self.col.type.__class__ in NOT_COMPUTE:
            return None

        # Run all queries on top of the sampled data
        col = column(self.col.name)
        only_once = (
            session.query(func.count(col))
            .select_from(sample)
            .group_by(col)
            .having(func.count(col) == 1)  # Values that appear only once
        )

        only_once_cte = only_once.cte("only_once")
        return session.query(func.count().label(self.name())).select_from(only_once_cte)

    def dl_query(self, data_frame):
        """
        Build the Unique Count metric
        """
        try:
            return data_frame[self.col.name].nunique()
        except Exception as err:
            logger.debug(
                f"Don't know how to process type {self.col.datatype}"
                f"when computing Distinct Count.\n Error: {err}"
            )
            return 0
