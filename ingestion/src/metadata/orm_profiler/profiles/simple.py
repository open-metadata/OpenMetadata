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
Default simple profiler to use
"""

from sqlalchemy.orm.attributes import InstrumentedAttribute
from sqlalchemy.orm.session import Session

from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiles.core import SingleProfiler


class SimpleProfiler(SingleProfiler):
    """
    Pre-built profiler with a simple
    set of metrics that we can use as
    a default.
    """

    def __init__(self, session: Session, col: InstrumentedAttribute, table):
        _metrics = [
            Metrics.MIN(col),
            Metrics.COUNT(col),
            Metrics.STDDEV(col),
            Metrics.NULL_COUNT(col),
            Metrics.NULL_RATIO(col),
        ]
        super().__init__(*_metrics, session=session, table=table)


class SimpleTableProfiler(SingleProfiler):
    """
    Default set of table metrics to run
    """

    def __init__(self, session: Session, table):
        _metrics = [Metrics.ROW_NUMBER()]
        super().__init__(*_metrics, session=session, table=table)
