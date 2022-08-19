import logging
from enum import Enum

BASE_LOGGING_FORMAT = (
    "[%(asctime)s] %(levelname)-8s {%(name)s:%(module)s:%(lineno)d} - %(message)s"
)

logging.basicConfig(
    filename="std.out", filemode="a", format=BASE_LOGGING_FORMAT, level=logging.DEBUG
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
