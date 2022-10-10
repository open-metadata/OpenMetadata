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
    WorkflowConfig,
)
from metadata.ingestion.ometa.provider_registry import PROVIDER_CLASS_MAP
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

T = TypeVar("T", bound=BaseModel)

# Sources which contain inner connections to validate
HAS_INNER_CONNECTION = {"Airflow"}

# Build a service type map dynamically from JSON Schema covered types
SERVICE_TYPE_MAP = {
    **{service: DatabaseConnection for service in DatabaseServiceType.__members__},
    **{service: DashboardConnection for service in DashboardServiceType.__members__},
    **{service: MessagingConnection for service in MessagingServiceType.__members__},
    **{service: MetadataConnection for service in MetadataServiceType.__members__},
    **{service: PipelineConnection for service in PipelineServiceType.__members__},
    **{service: MlModelConnection for service in MlModelServiceType.__members__},
}

SOURCE_CONFIG_CLASS_MAP = {
    DashboardMetadataConfigType.DashboardMetadata.value: DashboardServiceMetadataPipeline,
    ProfilerConfigType.Profiler.value: DatabaseServiceProfilerPipeline,
    DatabaseUsageConfigType.DatabaseUsage.value: DatabaseServiceQueryUsagePipeline,
    MessagingMetadataConfigType.MessagingMetadata.value: MessagingServiceMetadataPipeline,
    PipelineMetadataConfigType.PipelineMetadata.value: PipelineServiceMetadataPipeline,
    MlModelMetadataConfigType.MlModelMetadata.value: MlModelServiceMetadataPipeline,
    DatabaseMetadataConfigType.DatabaseMetadata.value: DatabaseServiceMetadataPipeline,
}


class ParsingConfigurationError(Exception):
    """A parsing configuration error has happened"""


class InvalidWorkflowException(Exception):
    """
    Raise when encountering errors with the workflow configuration
    """


def get_service_type(
    source_type: str,
) -> Union[
    Type[DashboardConnection],
    Type[DatabaseConnection],
    Type[MessagingConnection],
    Type[MetadataConnection],
    Type[PipelineConnection],
    Type[MlModelConnection],
]:
    """
    Return the service type for a source string
    :param source_type: source string
    :return: service connection type
    """
    service_tye = SERVICE_TYPE_MAP.get(source_type)

    if service_tye:
        return service_tye

    raise ValueError(f"Cannot find the service type of {source_type}")


def get_source_config_class(
    source_config_type: str,
) -> Union[
    Type[DashboardServiceMetadataPipeline],
    Type[DatabaseServiceProfilerPipeline],
    Type[DatabaseServiceQueryUsagePipeline],
    Type[MessagingServiceMetadataPipeline],
    Type[PipelineServiceMetadataPipeline],
    Type[MlModelServiceMetadataPipeline],
    Type[DatabaseServiceMetadataPipeline],
]:
    """
    Return the source config type for a source string
    :param source_config_type: source config type string
    :return: source config class
    """
    source_config_class = SOURCE_CONFIG_CLASS_MAP.get(source_config_type)

    if source_config_type:
        return source_config_class

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


def _parse_validation_err(validation_error: ValidationError) -> str:
    """
    Convert the validation error into a message to log
    """
    missing_fields = [
        f"Extra parameter '{err.get('loc')[0]}'"
        if len(err.get("loc")) == 1
        else f"Extra parameter in {err.get('loc')}"
        for err in validation_error.errors()
        if err.get("type") == "value_error.extra"
    ]

    extra_fields = [
        f"Missing parameter '{err.get('loc')[0]}'"
        if len(err.get("loc")) == 1
        else f"Missing parameter in {err.get('loc')}"
        for err in validation_error.errors()
        if err.get("type") == "value_error.missing"
    ]

    return "\t - " + "\n\t - ".join(missing_fields + extra_fields)


def _unsafe_parse_config(config: dict, cls: T, message: str) -> None:
    """
    Given a config dictionary and the class it should match,
    try to parse it or log the given message
    """
    logger.debug(f"Parsing message: [{message}]")
    # Parse the service connection dictionary with the scoped class
    try:
        cls.parse_obj(config)
    except ValidationError as err:
        logger.debug(
            f"The supported properties for {cls.__name__} are {list(cls.__fields__.keys())}"
        )
        raise err


def _parse_inner_connection(config_dict: dict, source_type: str) -> None:
    """
    Parse the inner connection of the flagged connectors

    :param config_dict: JSON configuration
    :param source_type: source type name, e.g., Airflow.
    """
    inner_source_type = config_dict["source"]["serviceConnection"]["config"][
        "connection"
    ]["type"]
    inner_service_type = get_service_type(inner_source_type)
    inner_connection_class = get_connection_class(inner_source_type, inner_service_type)
    _unsafe_parse_config(
        config=config_dict["source"]["serviceConnection"]["config"]["connection"],
        cls=inner_connection_class,
        message=f"Error parsing the inner service connection for {source_type}",
    )


def parse_service_connection(config_dict: dict) -> None:
    """
    Parse the service connection and raise any scoped
    errors during the validation process

    :param config_dict: JSON configuration
    """
    # Unsafe access to the keys. Allow a KeyError if the config is not well formatted
    source_type = config_dict["source"]["serviceConnection"]["config"].get("type")
    if source_type is None:
        raise InvalidWorkflowException("Missing type in the serviceConnection config")

    logger.debug(
        f"Error parsing the Workflow Configuration for {source_type} ingestion"
    )

    service_type = get_service_type(source_type)
    connection_class = get_connection_class(source_type, service_type)

    if source_type in HAS_INNER_CONNECTION:
        # We will first parse the inner `connection` configuration
        _parse_inner_connection(config_dict, source_type)

    # Parse the service connection dictionary with the scoped class
    _unsafe_parse_config(
        config=config_dict["source"]["serviceConnection"]["config"],
        cls=connection_class,
        message="Error parsing the service connection",
    )


def parse_source_config(config_dict: dict) -> None:
    """
    Parse the sourceConfig to help catch any config
    misconfigurations

    :param config_dict: JSON configuration
    """
    # Parse the source config
    source_config_type = config_dict["source"]["sourceConfig"]["config"].get("type")

    if source_config_type is None:
        raise InvalidWorkflowException("Missing type in the sourceConfig config")

    source_config_class = get_source_config_class(source_config_type)

    _unsafe_parse_config(
        config=config_dict["source"]["sourceConfig"]["config"],
        cls=source_config_class,
        message="Error parsing the source config",
    )


def parse_workflow_source(config_dict: dict) -> None:
    """
    Validate the parsing of the source in the config dict.
    This is our first stop as most issues happen when
    passing the source information.

    :param config_dict: JSON configuration
    """
    parse_service_connection(config_dict)
    parse_source_config(config_dict)


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
    logger.debug(
        f"Error parsing the Workflow Server Configuration with {auth_provider} auth provider"
    )

    # If the error comes from the security config:
    auth_class = PROVIDER_CLASS_MAP.get(auth_provider)
    # throw an error if the keys are not present
    security_config = config_dict["workflowConfig"]["openMetadataServerConfig"][
        "securityConfig"
    ]

    _unsafe_parse_config(
        config=security_config,
        cls=auth_class,
        message="Error parsing the workflow security config",
    )

    # If the security config is properly configured, let's raise the ValidationError of the whole WorkflowConfig
    WorkflowConfig.parse_obj(config_dict["workflowConfig"])


def parse_workflow_config_gracefully(
    config_dict: dict,
) -> Optional[OpenMetadataWorkflowConfig]:
    """
    This function either correctly parses the pydantic class, or
    throws a scoped error while fetching the required source connection
    class.

    If there is a validation error, two things can happen:
    - We find out the ValidationError scoping the search to serviceConnection, sourceConfig or securityConfig
    - There is something strange going on with the config, and we find another wild Exception.

    Therefore, we first need to catch any ValidationError and raise that immediately (this is the expected case).
    Otherwise, we throw a message and raise the original ValidationError to point to the root cause.

    :param config_dict: JSON workflow config
    :return:workflow config or scoped error
    """

    try:
        workflow_config = OpenMetadataWorkflowConfig.parse_obj(config_dict)
        return workflow_config

    except ValidationError as original_error:
        try:
            parse_workflow_source(config_dict)
            parse_server_config(config_dict)
        except (ValidationError, InvalidWorkflowException) as scoped_error:
            if isinstance(scoped_error, ValidationError):
                # Let's catch validations of internal Workflow models, not the Workflow itself
                object_error = (
                    scoped_error.model.__name__
                    if scoped_error.model is not None
                    else "workflow"
                )
                raise ParsingConfigurationError(
                    f"We encountered an error parsing the configuration of your {object_error}.\n"
                    "You might need to review your config based on the original cause of this failure:\n"
                    f"{_parse_validation_err(scoped_error)}"
                )
            raise scoped_error
        except Exception:  # Let's just raise the original error if any internal logic fails
            raise ParsingConfigurationError(
                f"We encountered an error parsing the configuration of your workflow.\n"
                "You might need to review your config based on the original cause of this failure:\n"
                f"{_parse_validation_err(original_error)}"
            )

    raise ParsingConfigurationError("Uncaught error when parsing the workflow!")


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

    except ValidationError as err:
        # Unsafe access to the keys. Allow a KeyError if the config is not well formatted
        source_type = config_dict["connection"]["config"]["type"]
        logger.warning(
            f"Error parsing the Workflow Configuration for {source_type} ingestion: {err}"
        )

        service_type = get_service_type(source_type)
        connection_class = get_connection_class(source_type, service_type)

        # Parse the dictionary with the scoped class
        _unsafe_parse_config(
            config=config_dict["connection"]["config"],
            cls=connection_class,
            message="Error parsing the connection config",
        )

    raise ParsingConfigurationError("Uncaught error when parsing the workflow!")
