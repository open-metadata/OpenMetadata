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
"""Connector-neutral Metric ingestion contracts and feature.

:mod:`records` owns the normalized shapes; :mod:`feature` is the runnable
``MetricIngestionFeature`` a connector calls ``accept()`` / ``drain()`` on.
Connector-specific adapters that produce these records live *inside* each
connector package.
"""

from metadata.domain.metrics.feature import (
    DEFAULT_MAX_DEFINITIONS,
    MetricFeatureOverflowError,
    MetricIngestionFeature,
)
from metadata.domain.metrics.records import (
    MetricDefinition,
    MetricKey,
    MetricOrigin,
    MetricSourceType,
)

__all__ = [
    "DEFAULT_MAX_DEFINITIONS",
    "MetricDefinition",
    "MetricFeatureOverflowError",
    "MetricIngestionFeature",
    "MetricKey",
    "MetricOrigin",
    "MetricSourceType",
]
