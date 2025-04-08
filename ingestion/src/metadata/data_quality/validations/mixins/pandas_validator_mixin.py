#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Validator Mixin for Pandas based tests cases
"""

from typing import Optional

from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.datalake.datalake_utils import GenericDataFrameColumnParser
from metadata.utils.entity_link import get_decoded_column
from metadata.utils.sqa_like_column import SQALikeColumn


class PandasValidatorMixin:
    """Validator mixin for Pandas based test cases"""

    def get_column_name(self, entity_link: str, dfs) -> SQALikeColumn:
        # we'll use the first dataframe chunk to get the column name.
        column = dfs[0][get_decoded_column(entity_link)]
        _type = GenericDataFrameColumnParser.fetch_col_types(
            dfs[0], get_decoded_column(entity_link)
        )
        sqa_like_column = SQALikeColumn(
            name=column.name,
            type=_type,
        )
        return sqa_like_column

    def run_dataframe_results(
        self,
        runner,
        metric: Metrics,
        column: Optional[SQALikeColumn] = None,
        **kwargs,
    ) -> Optional[int]:
        """Run the test case on a dataframe

        Args:
            runner (DataFrame): a dataframe
            metric (Metrics): a metric
            column (SQALikeColumn): a column
        """

        metric_obj = add_props(**kwargs)(metric.value) if kwargs else metric.value
        metric_fn = (
            metric_obj(column).df_fn if column is not None else metric_obj().df_fn
        )

        try:
            return metric_fn(runner)
        except Exception as exc:
            raise RuntimeError(exc)

    def _compute_row_count(self, runner, column: SQALikeColumn, **kwargs):
        """compute row count

        Args:
            runner (List[DataFrame]): runner to run the test case against)
            column (SQALikeColumn): column to compute row count for
        """
        return self.run_dataframe_results(runner, Metrics.ROW_COUNT, column, **kwargs)
