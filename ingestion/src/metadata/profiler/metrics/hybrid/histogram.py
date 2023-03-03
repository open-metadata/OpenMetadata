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
import math
from typing import Any, Dict, Optional, Union, cast

from sqlalchemy import and_, case, column, func
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.profiler.metrics.composed.iqr import InterQuartileRange
from metadata.profiler.metrics.core import HybridMetric
from metadata.profiler.metrics.static.count import Count
from metadata.profiler.metrics.static.max import Max
from metadata.profiler.metrics.static.min import Min
from metadata.profiler.orm.registry import is_quantifiable
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class Histogram(HybridMetric):
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

    @staticmethod
    def _get_bin_width(iqr: float, row_count: float) -> Union[float, int]:
        """
        Compute the bin width for the histogram using Freedman-Diaconis rule
        """
        if iqr == 0:
            return 1
        return 2 * iqr * row_count ** (-1 / 3)

    def fn(
        self,
        sample: Optional[DeclarativeMeta],
        res: Dict[str, Any],
        session: Optional[Session] = None,
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

        # get the metric need for the freedman-diaconis rule
        res_iqr = res.get(InterQuartileRange.name())
        res_row_count = res.get(Count.name())
        res_min = res.get(Min.name())
        res_max = res.get(Max.name())

        if any(var is None for var in [res_iqr, res_row_count, res_min, res_max]):
            return None

        # compute the bin width and the number of bins
        bind_width = self._get_bin_width(float(res_iqr), res_row_count)  # type: ignore
        num_bins = math.ceil((res_max - res_min) / bind_width)  # type: ignore

        if num_bins == 0:
            return None

        # set starting and ending bin bounds for the first bin
        starting_bin_bound = res_min
        res_min = cast(Union[float, int], res_min)  # satisfy mypy
        ending_bin_bound = res_min + bind_width
        col = column(self.col.name)  # type: ignore

        case_stmts = []
        for bin_num in range(num_bins):
            if bin_num < num_bins - 1:
                condition = and_(col >= starting_bin_bound, col < ending_bin_bound)
            else:
                # for the last bin we won't add the upper bound
                condition = and_(col >= starting_bin_bound)
                case_stmts.append(
                    func.count(case([(condition, col)])).label(
                        f"{starting_bin_bound:.2f} and up"
                    )
                )
                continue

            case_stmts.append(
                func.count(case([(condition, col)])).label(
                    f"{starting_bin_bound:.2f} to {ending_bin_bound:.2f}"
                )
            )
            starting_bin_bound = ending_bin_bound
            ending_bin_bound += bind_width

        rows = session.query(*case_stmts).select_from(sample).first()
        if rows:
            return {
                "boundaries": list(rows.keys()),
                "frequencies": list(rows)
            }
        return None
