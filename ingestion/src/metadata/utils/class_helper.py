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
Helper module to process the service type from the config
"""

from pydoc import locate
from typing import Type

from pydantic import BaseModel

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineType,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryUsagePipeline import (
    DatabaseServiceQueryUsagePipeline,
)
from metadata.generated.schema.metadataIngestion.dataInsightPipeline import (
    DataInsightPipeline,
)
from metadata.generated.schema.metadataIngestion.dbtPipeline import DbtPipeline
from metadata.generated.schema.metadataIngestion.messagingServiceMetadataPipeline import (
    MessagingServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.metadataToElasticSearchPipeline import (
    MetadataToElasticSearchPipeline,
)
from metadata.generated.schema.metadataIngestion.mlmodelServiceMetadataPipeline import (
    MlModelServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.pipelineServiceMetadataPipeline import (
    PipelineServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.searchServiceMetadataPipeline import (
    SearchServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.storageServiceMetadataPipeline import (
    StorageServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig

SERVICE_TYPE_REF = {
    ServiceType.Database.value: "databaseService",
    ServiceType.Dashboard.value: "dashboardService",
    ServiceType.Pipeline.value: "pipelineService",
    ServiceType.Messaging.value: "messagingService",
    ServiceType.MlModel.value: "mlmodelService",
    ServiceType.Metadata.value: "metadataService",
    ServiceType.Search.value: "searchService",
    ServiceType.Storage.value: "storageService",
}

SOURCE_CONFIG_TYPE_INGESTION = {
    DatabaseServiceMetadataPipeline.__name__: PipelineType.metadata,
    DatabaseServiceQueryUsagePipeline.__name__: PipelineType.usage,
    DatabaseServiceQueryLineagePipeline.__name__: PipelineType.lineage,
    DatabaseServiceProfilerPipeline.__name__: PipelineType.profiler,
    DashboardServiceMetadataPipeline.__name__: PipelineType.metadata,
    MessagingServiceMetadataPipeline.__name__: PipelineType.metadata,
    PipelineServiceMetadataPipeline.__name__: PipelineType.metadata,
    MlModelServiceMetadataPipeline.__name__: PipelineType.metadata,
    StorageServiceMetadataPipeline.__name__: PipelineType.metadata,
    SearchServiceMetadataPipeline.__name__: PipelineType.metadata,
    TestSuitePipeline.__name__: PipelineType.TestSuite,
    MetadataToElasticSearchPipeline.__name__: PipelineType.elasticSearchReindex,
    DataInsightPipeline.__name__: PipelineType.dataInsight,
    DbtPipeline.__name__: PipelineType.dbt,
}


def _clean(source_type: str):
    source_type = source_type.replace("-", "_")
    source_type = source_type.replace("_usage", "")
    source_type = source_type.replace("_lineage", "")
    source_type = source_type.replace("_", "")
    if source_type == "metadataelasticsearch":
        source_type = "metadataes"
    return source_type


def get_pipeline_type_from_source_config(source_config: SourceConfig) -> PipelineType:
    """From the YAML serviceType, get the Ingestion Pipeline Type"""
    pipeline_type = SOURCE_CONFIG_TYPE_INGESTION.get(
        source_config.config.__class__.__name__
    )
    if not pipeline_type:
        raise ValueError(
            f"Cannot find Pipeline Type for SourceConfig {source_config.config}"
        )
    return pipeline_type


def _get_service_type_from(  # pylint: disable=inconsistent-return-statements
    service_subtype: str,
) -> ServiceType:
    for service_type in ServiceType:
        if service_subtype.lower() in [
            subtype.value.lower()
            for subtype in locate(
                f"metadata.generated.schema.entity.services.{service_type.name.lower()}Service.{service_type.name}ServiceType"  # pylint: disable=line-too-long
            )
            or []
        ]:
            return service_type


def get_service_type_from_source_type(source_type: str) -> ServiceType:
    """
    Method to get service type from source type
    """

    return _get_service_type_from(_clean(source_type))


def get_reference_type_from_service_type(service_type: ServiceType) -> str:
    """Get the type to build the EntityReference from the service type"""
    service_reference = SERVICE_TYPE_REF.get(service_type.value)
    if not service_type:
        raise ValueError(
            f"Cannot find Service Type reference for service {service_type}"
        )
    return service_reference


def get_service_class_from_service_type(service_type: ServiceType) -> Type[BaseModel]:
    """
    Method to get service class from service type
    """

    return locate(
        f"metadata.generated.schema.entity.services.{service_type.name.lower()}Service.{service_type.name}Service"
    )
