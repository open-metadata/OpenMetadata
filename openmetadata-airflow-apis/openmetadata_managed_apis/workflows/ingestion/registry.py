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
DAG builder registry.

Add a function for each type from PipelineType
"""
from openmetadata_managed_apis.workflows.ingestion.data_insight import (
    build_data_insight_dag,
)
from openmetadata_managed_apis.workflows.ingestion.dbt import build_dbt_dag
from openmetadata_managed_apis.workflows.ingestion.es_reindex import (
    build_es_reindex_dag,
)
from openmetadata_managed_apis.workflows.ingestion.lineage import build_lineage_dag
from openmetadata_managed_apis.workflows.ingestion.metadata import build_metadata_dag
from openmetadata_managed_apis.workflows.ingestion.profiler import build_profiler_dag
from openmetadata_managed_apis.workflows.ingestion.test_suite import (
    build_test_suite_dag,
)
from openmetadata_managed_apis.workflows.ingestion.usage import build_usage_dag

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineType,
)
from metadata.utils.dispatch import enum_register

build_registry = enum_register()

build_registry.add(PipelineType.metadata.value)(build_metadata_dag)
build_registry.add(PipelineType.usage.value)(build_usage_dag)
build_registry.add(PipelineType.lineage.value)(build_lineage_dag)
build_registry.add(PipelineType.dbt.value)(build_dbt_dag)
build_registry.add(PipelineType.profiler.value)(build_profiler_dag)
build_registry.add(PipelineType.TestSuite.value)(build_test_suite_dag)
build_registry.add(PipelineType.dataInsight.value)(build_data_insight_dag)
build_registry.add(PipelineType.elasticSearchReindex.value)(build_es_reindex_dag)
