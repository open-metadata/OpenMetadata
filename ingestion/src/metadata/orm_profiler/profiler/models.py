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
Models to map profiler definitions
JSON workflows to the profiler
"""
from typing import List, Optional

from pydantic import BaseModel, validator

from metadata.orm_profiler.metrics.registry import Metrics


class ProfilerDef(BaseModel):
    """
    Incoming profiler definition from the
    JSON workflow
    """

    name: str  # Profiler name
    timeout_seconds: Optional[
        int
    ] = None  # Stop running a query after X seconds and continue
    metrics: Optional[
        List[str]
    ] = None  # names of currently supported Static and Composed metrics
    # TBD:
    # time_metrics: List[TimeMetricDef] = None
    # custom_metrics: List[CustomMetricDef] = None
    # rule_metrics: ...

    # pylint: disable=no-self-argument
    @validator("metrics", each_item=True)
    def valid_metric(cls, value):
        """
        We are using cls as per pydantic docs

        Validate that the input metrics are correctly named
        and can be found in the Registry
        """
        if not Metrics.get(value.upper()):
            raise ValueError(
                f"Metric name {value} is not a proper metric name from the Registry"
            )

        return value.upper()
