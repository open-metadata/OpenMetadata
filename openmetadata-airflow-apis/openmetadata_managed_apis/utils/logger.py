import logging
from enum import Enum
from logging.handlers import RotatingFileHandler
from typing import Union

from airflow.configuration import conf

from metadata.generated.schema.metadataIngestion.application import (
    OpenMetadataApplicationConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.utils.logger import set_loggers_level

BASE_LOGGING_FORMAT = (
    "[%(asctime)s] %(levelname)-8s {%(name)s:%(module)s:%(lineno)d} - %(message)s"
)


class Loggers(Enum):
    API_ROUTES = "AirflowAPIRoutes"
    API = "AirflowAPI"
    OPERATIONS = "AirflowOperations"
    WORKFLOW = "AirflowWorkflow"
    UTILS = "AirflowUtils"


def build_logger(logger_name: str) -> logging.Logger:
    logger = logging.getLogger(logger_name)
    log_format = logging.Formatter(BASE_LOGGING_FORMAT)
    rotating_log_handler = RotatingFileHandler(
        f"{conf.get('logging', 'base_log_folder', fallback='')}/openmetadata_airflow_api.log",
        maxBytes=1000000,
        backupCount=10,
    )
    rotating_log_handler.setFormatter(log_format)
    logger.addHandler(rotating_log_handler)
    # We keep the log level as DEBUG to have all the traces in case anything fails
    # during a deployment of a DAG
    logger.setLevel(logging.DEBUG)
    return logger


def routes_logger() -> logging.Logger:
    return build_logger(Loggers.API_ROUTES.value)


def api_logger():
    return build_logger(Loggers.API.value)


def operations_logger():
    return build_logger(Loggers.OPERATIONS.value)


def workflow_logger():
    return build_logger(Loggers.WORKFLOW.value)


def utils_logger():
    return build_logger(Loggers.UTILS.value)


def set_operator_logger(
    workflow_config: Union[OpenMetadataWorkflowConfig, OpenMetadataApplicationConfig]
) -> None:
    """
    Handle logging for the Python Operator that
    will execute the ingestion
    """
    logging.getLogger().setLevel(logging.WARNING)
    set_loggers_level(workflow_config.workflowConfig.loggerLevel.value)
