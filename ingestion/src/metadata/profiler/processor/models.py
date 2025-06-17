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
Models to map profiler definitions
JSON workflows to the profiler
"""
from typing import List, Optional, Type

from pydantic import BaseModel, BeforeValidator
from typing_extensions import Annotated

from metadata.profiler.registry import MetricRegistry
from metadata.utils.dependency_injector.dependency_injector import (
    DependencyNotFoundError,
    Inject,
    inject,
)


@inject
def valid_metric(value: str, metrics: Inject[Type[MetricRegistry]] = None):
    """
    Validate that the input metrics are correctly named
    and can be found in the Registry
    """
    if metrics is None:
        raise DependencyNotFoundError(
            "MetricRegistry dependency not found. Please ensure the MetricRegistry is properly registered."
        )
    if not metrics.get(value.upper()):
        raise ValueError(
            f"Metric name {value} is not a proper metric name from the Registry"
        )

    return value.upper()


ValidMetric = Annotated[str, BeforeValidator(valid_metric)]


class ProfilerDef(BaseModel):
    """
    Incoming profiler definition from the
    JSON workflow
    """

    name: str  # Profiler name
    timeout_seconds: Optional[
        int
    ] = None  # Stop running a query after X seconds and continue
    metrics: Optional[List[ValidMetric]] = None
