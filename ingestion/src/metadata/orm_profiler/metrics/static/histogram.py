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

import numpy as np
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from metadata.orm_profiler.metrics.core import QueryMetric
from metadata.orm_profiler.orm.functions.concat import ConcatFn
from metadata.orm_profiler.orm.registry import is_quantifiable
from metadata.orm_profiler.utils import logger

logger = logger()


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

    def query(self, session: Optional[Session] = None):
        """
        Build the histogram query
        """

        if not session:
            raise AttributeError(
                "We are missing the session attribute to compute the Histogram."
            )

        if not is_quantifiable(self.col.type):
            return None

        num_bins = self.bins if hasattr(self, "bins") else 5

        bins = session.query(
            ((func.max(self.col) - func.min(self.col)) / float(num_bins - 1)).label(
                "step"
            )
        )
        bins_cte = bins.cte("bins")

        ranges = session.query(
            (func.round(self.col / bins_cte.c.step - 0.5, 0) * bins_cte.c.step).label(
                "bin_floor"
            ),
            (
                func.round(self.col / bins_cte.c.step - 0.5, 0) * bins_cte.c.step
                + bins_cte.c.step
            ).label("bin_ceil"),
        ).join(
            bins_cte, and_(True)
        )  # join on 1 = 1 -> we just want the step info
        ranges_cte = ranges.cte("ranges")

        hist = (
            session.query(
                ConcatFn(ranges_cte.c.bin_floor, " to ", ranges_cte.c.bin_ceil).label(
                    "boundaries"
                ),
                func.count().label("frequencies"),
            )
            .group_by(
                ranges_cte.c.bin_floor,
                ranges_cte.c.bin_ceil,
                ConcatFn(ranges_cte.c.bin_floor, " to ", ranges_cte.c.bin_ceil).label(
                    "boundaries"
                ),
            )
            .order_by(ranges_cte.c.bin_floor)
        )

        return hist
