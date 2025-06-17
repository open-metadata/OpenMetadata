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
OpenMetadata package initialization.
"""
from typing import Type

from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.registry import MetricRegistry
from metadata.profiler.source.database.base.profiler_resolver import (
    DefaultProfilerResolver,
    ProfilerResolver,
)
from metadata.utils.dependency_injector.dependency_injector import DependencyContainer
from metadata.utils.service_spec.service_spec import DefaultSourceLoader, SourceLoader

# Initialize the dependency container
container = DependencyContainer()

# Register the source loader
container.register(SourceLoader, DefaultSourceLoader)
container.register(Type[MetricRegistry], lambda: Metrics)
container.register(Type[ProfilerResolver], lambda: DefaultProfilerResolver)
