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
Histogram Metric definition
"""
from typing import Optional

from sqlalchemy import column, func
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.orm_profiler.metrics.core import QueryMetric
from metadata.orm_profiler.orm.functions.concat import ConcatFn
from metadata.orm_profiler.orm.registry import is_quantifiable
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class Histogram(QueryMetric):
    """
    AVG Metric

    Given a column, return the AVG value.

    - For a quantifiable value, return the usual AVG
    - For a concatenable (str, text...) return the AVG length
    """

    @classmethod
    def name(cls):
        return "histogram"

    @property
    def metric_type(self):
        return dict

    def query(
        self, sample: Optional[DeclarativeMeta], session: Optional[Session] = None
    ):
        """
        Build the histogram query
        """

        if not session:
            raise AttributeError(
                "We are missing the session attribute to compute the Histogram."
            )

        if not is_quantifiable(self.col.type):
            return None

        # Run all queries on top of the sampled data
        col = column(self.col.name)

        num_bins = self.bins if hasattr(self, "bins") else 5

        bins = session.query(
            ((func.max(col) - func.min(col)) / float(num_bins - 1)).label("step"),
        ).select_from(sample)

        raw_step = dict(bins.first())["step"]

        if not raw_step:  # step == 0 or None for empty tables
            logger.debug(
                f"MIN({col.name}) == MAX({col.name}) or EMPTY table. Aborting histogram computation."
            )
            return None

        step = float(raw_step)

        ranges = session.query(
            sample,
            (func.round(col / step - 0.5, 0) * step).label("bin_floor"),
            (func.round(col / step - 0.5, 0) * step + step).label("bin_ceil"),
        )
        ranges_cte = ranges.cte("ranges")

        hist = (
            session.query(
                ConcatFn(
                    str(ranges_cte.c.bin_floor), " to ", str(ranges_cte.c.bin_ceil)
                ).label("boundaries"),
                func.count().label("frequencies"),
            )
            .select_from(ranges_cte)
            .group_by(
                ranges_cte.c.bin_floor,
                ranges_cte.c.bin_ceil,
                ConcatFn(
                    str(ranges_cte.c.bin_floor), " to ", str(ranges_cte.c.bin_ceil)
                ).label("boundaries"),
            )
            .order_by("boundaries")
        )

        return hist
