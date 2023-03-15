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
from typing import Any, Dict, List, Optional, Union, cast

from sqlalchemy import and_, case, column, func
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.profiler.metrics.composed.iqr import InterQuartileRange
from metadata.profiler.metrics.core import HybridMetric
from metadata.profiler.metrics.static.count import Count
from metadata.profiler.metrics.static.max import Max
from metadata.profiler.metrics.static.min import Min
from metadata.profiler.orm.registry import is_quantifiable
from metadata.utils.helpers import format_large_string_numbers
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class Histogram(HybridMetric):
    """
    AVG Metric

    Given a column, return the Histogram value.

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

    @staticmethod
    def _get_res(res: Dict[str, Any]):
        # get the metric need for the freedman-diaconis rule
        res_iqr = res.get(InterQuartileRange.name())
        res_row_count = res.get(Count.name())
        res_min = res.get(Min.name())
        res_max = res.get(Max.name())

        if any(var is None for var in [res_iqr, res_row_count, res_min, res_max]):
            return None

        return (
            float(res_iqr),
            float(res_row_count),
            float(res_min),
            float(res_max),
        )  # Decimal to float

    @staticmethod
    def _format_bin_labels(
        lower_bin: Union[float, int], upper_bin: Optional[Union[float, int]] = None
    ) -> str:
        """format bin labels

        Args:
            lower_bin: lower bin
            upper_bin: upper bin. Defaults to None.

        Returns:
            str: formatted bin labels
        """
        if lower_bin is None:
            formatted_lower_bin = "null"
        else:
            formatted_lower_bin = format_large_string_numbers(lower_bin)
        if upper_bin is None:
            return f"{formatted_lower_bin} and up"
        return f"{formatted_lower_bin} to {format_large_string_numbers(upper_bin)}"

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
        results = self._get_res(res)
        if not results:
            return None
        res_iqr, res_row_count, res_min, res_max = results

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
                        self._format_bin_labels(starting_bin_bound)
                    )
                )
                continue

            case_stmts.append(
                func.count(case([(condition, col)])).label(
                    self._format_bin_labels(
                        starting_bin_bound,
                        ending_bin_bound,
                    )
                )
            )
            starting_bin_bound = ending_bin_bound
            ending_bin_bound += bind_width

        rows = session.query(*case_stmts).select_from(sample).first()
        if rows:
            return {"boundaries": list(rows.keys()), "frequencies": list(rows)}
        return None

    def df_fn(
        self,
        res: Dict[str, Any],
        dfs=None,
    ):
        """_summary_

        Args:
            res (Dict[str, Any]): dictionnary of columns values
            dfs (List[DataFrame]): list of dataframes

        Returns:
            Dict
        """
        # pylint: disable=import-outside-toplevel
        import numpy as np
        import pandas as pd

        dfs = cast(List[pd.DataFrame], dfs)  # satisfy mypy

        if not is_quantifiable(self.col.type):
            return None

        # get the metric need for the freedman-diaconis rule
        results = self._get_res(res)
        if not results:
            return None
        res_iqr, res_row_count, res_min, res_max = results

        # compute the bin width and the number of bins
        bind_width = self._get_bin_width(float(res_iqr), res_row_count)  # type: ignore
        num_bins = math.ceil((res_max - res_min) / bind_width)  # type: ignore

        if num_bins == 0:
            return None

        bins = list(np.arange(num_bins) * bind_width + res_min)
        bins_label = [
            self._format_bin_labels(bins[i], bins[i + 1])
            if i < len(bins) - 1
            else self._format_bin_labels(bins[i])
            for i in range(len(bins))
        ]

        bins.append(np.inf)  # add the last bin

        frequencies = None

        for df in dfs:
            if not type(frequencies) == np.ndarray:
                frequencies = (
                    pd.cut(df[self.col.name], bins, right=False).value_counts().values
                )  # right boundary is exclusive
                continue
            frequencies += (
                pd.cut(df[self.col.name], bins, right=False).value_counts().values
            )  # right boundary is exclusive

        if frequencies.size > 0:
            return {"boundaries": bins_label, "frequencies": frequencies.tolist()}
        return None
