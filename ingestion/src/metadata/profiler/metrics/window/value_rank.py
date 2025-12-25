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
ValueRank Metric definition
"""
from sqlalchemy import column

from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.orm.functions.value_rank import ValueRankFn


class ValueRank(StaticMetric):
    """
    Given a column rank it based on its value occurrences
    """

    @classmethod
    def name(cls):
        return "valueRank"

    @classmethod
    def is_computed_metric(cls) -> bool:
        """
        Indicates that ValueRank is not a computed metric.
        Unlike the base class default, this returns False because ValueRank is a window metric
        that operates over value occurrences rather than being derived from other computed metrics.
        """
        return False

    @classmethod
    def is_window_metric(cls):
        return True

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        """sqlalchemy function"""
        return ValueRankFn(column(self.col.name, self.col.type))
