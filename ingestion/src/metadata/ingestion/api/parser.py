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
Helper to parse workflow configurations
"""
from typing import Optional, Type, TypeVar, Union

from pydantic import BaseModel, ValidationError

from metadata.generated.schema.api.services.ingestionPipelines.testServiceConnection import (
    TestServiceConnectionRequest,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingConnection,
    MessagingServiceType,
)
from metadata.generated.schema.entity.services.metadataService import (
    MetadataConnection,
    MetadataServiceType,
)
from metadata.generated.schema.entity.services.mlmodelService import (
    MlModelConnection,
    MlModelServiceType,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardMetadataConfigType,
    DashboardServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseMetadataConfigType,
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
    ProfilerConfigType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryUsagePipeline import (
    DatabaseServiceQueryUsagePipeline,
    DatabaseUsageConfigType,
)
from metadata.generated.schema.metadataIngestion.messagingServiceMetadataPipeline import (
    MessagingMetadataConfigType,
    MessagingServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.mlmodelServiceMetadataPipeline import (
    MlModelMetadataConfigType,
    MlModelServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.pipelineServiceMetadataPipeline import (
    PipelineMetadataConfigType,
    PipelineServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    SourceConfig,
    WorkflowConfig,
)
from metadata.ingestion.ometa.provider_registry import PROVIDER_CLASS_MAP
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

T = TypeVar("T", bound=BaseModel)


def get_service_type(
    source_type: str,
) -> Union[
    Type[DashboardConnection],
    Type[DatabaseConnection],
    Type[MessagingConnection],
    Type[MetadataConnection],
]:
    """
    Return the service type for a source string
    :param source_type: source string
    :return: service connection type
    """
    if source_type in DatabaseServiceType.__members__:
        return DatabaseConnection
    if source_type in DashboardServiceType.__members__:
        return DashboardConnection
    if source_type in MessagingServiceType.__members__:
        return MessagingConnection
    if source_type in MetadataServiceType.__members__:
        return MetadataConnection
    if source_type in PipelineServiceType.__members__:
        return PipelineConnection
    if source_type in MlModelServiceType.__members__:
        return MlModelConnection

    raise ValueError(f"Cannot find the service type of {source_type}")


def get_source_config_class(
    source_config_type: str,
) -> Union[
    Type[DatabaseMetadataConfigType],
    Type[ProfilerConfigType],
    Type[DatabaseUsageConfigType],
    Type[DashboardMetadataConfigType],
    Type[MessagingMetadataConfigType],
    Type[MlModelMetadataConfigType],
    Type[PipelineMetadataConfigType],
]:
    """
    Return the source config type for a source string
    :param source_config_type: source config type string
    :return: source config class
    """
    if source_config_type == DashboardMetadataConfigType.DashboardMetadata.value:
        return DashboardServiceMetadataPipeline
    if source_config_type == ProfilerConfigType.Profiler.value:
        return DatabaseServiceProfilerPipeline
    if source_config_type == DatabaseUsageConfigType.DatabaseUsage.value:
        return DatabaseServiceQueryUsagePipeline
    if source_config_type == MessagingMetadataConfigType.MessagingMetadata.value:
        return MessagingServiceMetadataPipeline
    if source_config_type == PipelineMetadataConfigType.PipelineMetadata.value:
        return PipelineServiceMetadataPipeline
    if source_config_type == MlModelMetadataConfigType.MlModelMetadata.value:
        return MlModelServiceMetadataPipeline
    if source_config_type == DatabaseMetadataConfigType.DatabaseMetadata.value:
        return DatabaseServiceMetadataPipeline
    raise ValueError(f"Cannot find the service type of {source_config_type}")


def get_connection_class(
    source_type: str,
    service_type: Union[
        Type[DashboardConnection],
        Type[DatabaseConnection],
        Type[MessagingConnection],
        Type[MetadataConnection],
        Type[PipelineConnection],
        Type[MlModelConnection],
    ],
) -> T:
    """
    Build the connection class path, import and return it
    :param source_type: e.g., Glue
    :param service_type: e.g., DatabaseConnection
    :return: e.g., GlueConnection
    """

    # Get all the module path minus the file.
    # From metadata.generated.schema.entity.services.databaseService we get metadata.generated.schema.entity.services
    module_path = ".".join(service_type.__module__.split(".")[:-1])
    connection_path = service_type.__name__.lower().replace("connection", "")
    connection_module = source_type[0].lower() + source_type[1:] + "Connection"

    class_name = source_type + "Connection"
    class_path = f"{module_path}.connections.{connection_path}.{connection_module}"

    connection_class = getattr(
        __import__(class_path, globals(), locals(), [class_name]), class_name
    )

    return connection_class


def parse_workflow_source(config_dict: dict) -> None:
    """
    Validate the parsing of the source in the config dict.
    This is our first stop as most issues happen when
    passing the source information.

    :param config_dict: JSON configuration
    """
    # Unsafe access to the keys. Allow a KeyError if the config is not well formatted
    source_type = config_dict["source"]["serviceConnection"]["config"]["type"]
    logger.error(
        f"Error parsing the Workflow Configuration for {source_type} ingestion"
    )

    service_type = get_service_type(source_type)
    connection_class = get_connection_class(source_type, service_type)

    # Parse the dictionary with the scoped class
    connection_class.parse_obj(config_dict["source"]["serviceConnection"]["config"])

    # Parse the source config
    source_config_type = config_dict["source"]["sourceConfig"]["config"]["type"]
    source_config_class = get_source_config_class(source_config_type)
    source_config_class.parse_obj(config_dict["source"]["sourceConfig"]["config"])


def parse_server_config(config_dict: dict) -> None:
    """
    Validate the parsing of openMetadataServerConfig.
    This is valuable to make sure there are no issues
    when setting up auth providers.

    :param config_dict: JSON configuration
    """
    # Unsafe access to the keys. Allow a KeyError if the config is not well formatted
    auth_provider = config_dict["workflowConfig"]["openMetadataServerConfig"][
        "authProvider"
    ]
    logger.error(
        f"Error parsing the Workflow Server Configuration with {auth_provider} auth provider"
    )

    # If the error comes from the security config:
    auth_class = PROVIDER_CLASS_MAP.get(auth_provider)
    security_config = (
        config_dict.get("workflowConfig")
        .get("openMetadataServerConfig")
        .get("securityConfig")
    )
    if auth_class and security_config:
        auth_class.parse_obj(security_config)

    # If the security config is properly configured, let's raise the ValidationError of the whole WorkflowConfig
    WorkflowConfig.parse_obj(config_dict["workflowConfig"])


def parse_workflow_config_gracefully(
    config_dict: dict,
) -> Optional[OpenMetadataWorkflowConfig]:
    """
    This function either correctly parses the pydantic class, or
    throws a scoped error while fetching the required source connection
    class.

    :param config_dict: JSON workflow config
    :return:workflow config or scoped error
    """

    try:
        workflow_config = OpenMetadataWorkflowConfig.parse_obj(config_dict)
        return workflow_config

    except ValidationError:
        parse_workflow_source(config_dict)
        parse_server_config(config_dict)


def parse_test_connection_request_gracefully(
    config_dict: dict,
) -> Optional[TestServiceConnectionRequest]:
    """
    This function either correctly parses the pydantic class,
    or throws a scoped error while fetching the required source
    connection class

    :param config_dict: JSON workflow config
    :return: TestServiceConnectionRequest or scoped error
    """

    try:
        test_service_connection = TestServiceConnectionRequest.parse_obj(config_dict)
        return test_service_connection

    except ValidationError:
        # Unsafe access to the keys. Allow a KeyError if the config is not well formatted
        source_type = config_dict["connection"]["config"]["type"]
        logger.error(
            f"Error parsing the Workflow Configuration for {source_type} ingestion"
        )

        service_type = get_service_type(source_type)
        connection_class = get_connection_class(source_type, service_type)

        # Parse the dictionary with the scoped class
        connection_class.parse_obj(config_dict["connection"]["config"])
