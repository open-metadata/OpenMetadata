import logging
from enum import Enum
from logging.handlers import RotatingFileHandler

from airflow.configuration import conf

BASE_LOGGING_FORMAT = (
    "[%(asctime)s] %(levelname)-8s {%(name)s:%(module)s:%(lineno)d} - %(message)s"
)

logging.basicConfig(
    handlers=[
        RotatingFileHandler(
            f"{conf.get('logging', 'base_log_folder', fallback='.')}/openmetadata_airflow_api.log",
            maxBytes=1000000,
            backupCount=10,
        )
    ],
    format=BASE_LOGGING_FORMAT,
    level=logging.DEBUG,
)


class Loggers(Enum):
    API_ROUTES = "AirflowAPIRoutes"
    API = "AirflowAPI"
    OPERATIONS = "AirflowOperations"
    WORKFLOW = "AirflowWorkflow"


def routes_logger():
    return logging.getLogger(Loggers.API_ROUTES.value)


def api_logger():
    return logging.getLogger(Loggers.API.value)


def operations_logger():
    return logging.getLogger(Loggers.OPERATIONS.value)


def workflow_logger():
    return logging.getLogger(Loggers.WORKFLOW.value)
