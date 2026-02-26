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
Test all metrics are properly registered in the json schema and registry
"""

from metadata.profiler.metrics.registry import Metrics
from metadata.generated.schema.configuration.profilerConfiguration import MetricType


def test_metric_registry():
    """
    Validate that all metrics in the registry have their definition in the
    schema MetricType
    """
    registry_set = {m.value.schema_metric_type for m in Metrics}
    schema_set = set(MetricType)

    registry_has_all = registry_set - schema_set
    schema_has_all = schema_set - registry_set

    missing = False
    for t in [registry_has_all, schema_has_all]:
        if t:
            missing = True

    assert not missing, f"registry: {registry_has_all}\nschema: {schema_has_all}"
