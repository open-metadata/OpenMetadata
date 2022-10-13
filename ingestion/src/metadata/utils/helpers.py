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
Helpers module for ingestion related methods
"""

import re
import traceback
from datetime import datetime, timedelta
from functools import wraps
from time import perf_counter
from typing import Any, Dict, Iterable, List, Optional

from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceRequest,
)
from metadata.generated.schema.api.services.createStorageService import (
    CreateStorageServiceRequest,
)
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import (
    EntityReference,
    EntityReferenceList,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.logger import utils_logger

logger = utils_logger()

om_chart_type_dict = {
    "line": ChartType.Line,
    "big_number": ChartType.Line,
    "big_number_total": ChartType.Line,
    "dual_line": ChartType.Line,
    "line_multi": ChartType.Line,
    "table": ChartType.Table,
    "dist_bar": ChartType.Bar,
    "bar": ChartType.Bar,
    "box_plot": ChartType.BoxPlot,
    "boxplot": ChartType.BoxPlot,
    "histogram": ChartType.Histogram,
    "treemap": ChartType.Area,
    "area": ChartType.Area,
    "pie": ChartType.Pie,
    "text": ChartType.Text,
    "scatter": ChartType.Scatter,
}


def calculate_execution_time(func):
    """
    Method to calculate workflow execution time
    """

    @wraps(func)
    def calculate_debug_time(*args, **kwargs):
        start = perf_counter()
        func(*args, **kwargs)
        end = perf_counter()
        logger.debug(
            f"{func.__name__} executed in { pretty_print_time_duration(end - start)}"
        )

    return calculate_debug_time


def calculate_execution_time_generator(func):
    """
    Generator method to calculate workflow execution time
    """

    def calculate_debug_time(*args, **kwargs):
        start = perf_counter()
        yield from func(*args, **kwargs)
        end = perf_counter()
        logger.debug(
            f"{func.__name__} executed in { pretty_print_time_duration(end - start)}"
        )

    return calculate_debug_time


def pretty_print_time_duration(duration: int) -> str:
    """
    Method to format and display the time
    """

    days = divmod(duration, 86400)[0]
    hours = divmod(duration, 3600)[0]
    minutes = divmod(duration, 60)[0]
    seconds = round(divmod(duration, 60)[1], 2)
    if days:
        return f"{days}day(s) {hours}h {minutes}m {seconds}s"
    if hours:
        return f"{hours}h {minutes}m {seconds}s"
    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"


def get_start_and_end(duration):
    """
    Method to return start and end time based on duration
    """

    today = datetime.utcnow()
    start = (today + timedelta(0 - duration)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    # Add one day to make sure we are handling today's queries
    end = (today + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, end


def snake_to_camel(snake_str):
    """
    Method to convert snake case text to camel case
    """
    split_str = snake_str.split("_")
    split_str[0] = split_str[0].capitalize()
    if len(split_str) > 1:
        split_str[1:] = [u.title() for u in split_str[1:]]
    return "".join(split_str)


def get_database_service_or_create(
    config: WorkflowSource, metadata_config, service_name=None
) -> DatabaseService:
    """
    Get an existing database service or create a new one based on the config provided
    """

    metadata = OpenMetadata(metadata_config)
    if not service_name:
        service_name = config.serviceName
    service: DatabaseService = metadata.get_by_name(
        entity=DatabaseService, fqn=service_name
    )
    if not service:
        config_dict = config.dict()
        service_connection_config = config_dict.get("serviceConnection").get("config")
        password = (
            service_connection_config.get("password").get_secret_value()
            if service_connection_config and service_connection_config.get("password")
            else None
        )

        # Use a JSON to dynamically parse the pydantic model
        # based on the serviceType
        # TODO revisit me
        service_json = {
            "connection": {
                "config": {
                    "hostPort": service_connection_config.get("hostPort")
                    if service_connection_config
                    else None,
                    "username": service_connection_config.get("username")
                    if service_connection_config
                    else None,
                    "password": password,
                    "database": service_connection_config.get("database")
                    if service_connection_config
                    else None,
                    "connectionOptions": service_connection_config.get(
                        "connectionOptions"
                    )
                    if service_connection_config
                    else None,
                    "connectionArguments": service_connection_config.get(
                        "connectionArguments"
                    )
                    if service_connection_config
                    else None,
                }
            },
            "name": service_name,
            "description": "",
            "serviceType": service_connection_config.get("type").value
            if service_connection_config
            else None,
        }

        created_service: DatabaseService = metadata.create_or_update(
            CreateDatabaseServiceRequest(**service_json)
        )
        logger.info(f"Creating DatabaseService instance for {service_name}")
        return created_service
    return service


def get_messaging_service_or_create(
    service_name: str,
    message_service_type: str,
    config: dict,
    metadata_config,
) -> MessagingService:
    """
    Get an existing messaging service or create a new one based on the config provided
    """

    metadata = OpenMetadata(metadata_config)
    service: MessagingService = metadata.get_by_name(
        entity=MessagingService, fqn=service_name
    )
    if service is not None:
        return service
    created_service = metadata.create_or_update(
        CreateMessagingServiceRequest(
            name=service_name, serviceType=message_service_type, connection=config
        )
    )
    return created_service


def get_dashboard_service_or_create(
    service_name: str,
    dashboard_service_type: str,
    config: dict,
    metadata_config,
) -> DashboardService:
    """
    Get an existing dashboard service or create a new one based on the config provided
    """

    metadata = OpenMetadata(metadata_config)
    service: DashboardService = metadata.get_by_name(
        entity=DashboardService, fqn=service_name
    )
    if service is not None:
        return service
    dashboard_config = {"config": config}
    created_service = metadata.create_or_update(
        CreateDashboardServiceRequest(
            name=service_name,
            serviceType=dashboard_service_type,
            connection=dashboard_config,
        )
    )
    return created_service


def get_storage_service_or_create(service_json, metadata_config) -> StorageService:
    """
    Get an existing storage service or create a new one based on the config provided
    """

    metadata = OpenMetadata(metadata_config)
    service: StorageService = metadata.get_by_name(
        entity=StorageService, fqn=service_json["name"]
    )
    if service is not None:
        return service
    created_service = metadata.create_or_update(
        CreateStorageServiceRequest(**service_json)
    )
    return created_service


def datetime_to_ts(date: Optional[datetime]) -> Optional[int]:
    """
    Convert a given date to a timestamp as an Int in milliseconds
    """
    return int(date.timestamp() * 1_000) if date else None


def get_formatted_entity_name(name: str) -> Optional[str]:
    """
    Method to get formatted entity name
    """

    return (
        name.replace("[", "").replace("]", "").replace("<default>.", "")
        if name
        else None
    )


def get_raw_extract_iter(alchemy_helper) -> Iterable[Dict[str, Any]]:
    """
    Provides iterator of result row from SQLAlchemy helper
    :return:
    """
    rows = alchemy_helper.execute_query()
    for row in rows:
        yield row


def replace_special_with(raw: str, replacement: str) -> str:
    """
    Replace special characters in a string by a hyphen
    :param raw: raw string to clean
    :param replacement: string used to replace
    :return: clean string
    """
    return re.sub(r"[^a-zA-Z0-9]", replacement, raw)


def get_standard_chart_type(raw_chart_type: str) -> str:
    """
    Get standard chart type supported by OpenMetadata based on raw chart type input
    :param raw_chart_type: raw chart type to be standardize
    :return: standard chart type
    """
    return om_chart_type_dict.get(raw_chart_type.lower(), ChartType.Other)


def get_chart_entities_from_id(
    chart_ids: List[str], metadata: OpenMetadata, service_name: str
) -> List[EntityReferenceList]:
    """
    Method to get the chart entity using get_by_name api
    """

    entities = []
    for chart_id in chart_ids:
        chart: Chart = metadata.get_by_name(
            entity=Chart,
            fqn=fqn.build(
                metadata, Chart, chart_name=str(chart_id), service_name=service_name
            ),
        )
        if chart:
            entity = EntityReference(id=chart.id, type="chart")
            entities.append(entity)
    return entities


def find_in_list(element: Any, container: Iterable[Any]) -> Optional[Any]:
    """
    If the element is in the container, return it.
    Otherwise, return None
    :param element: to find
    :param container: container with element
    :return: element or None
    """
    return next(iter([elem for elem in container if elem == element]), None)


def find_column_in_table(column_name: str, table: Table) -> Optional[Column]:
    """
    If the column exists in the table, return it
    """
    return next(
        (col for col in table.columns if col.name.__root__ == column_name), None
    )


def list_to_dict(original: Optional[List[str]], sep: str = "=") -> Dict[str, str]:
    """
    Given a list with strings that have a separator,
    convert that to a dictionary of key-value pairs
    """
    if not original:
        return {}

    split_original = [
        (elem.split(sep)[0], elem.split(sep)[1]) for elem in original if sep in elem
    ]
    return dict(split_original)


def create_ometa_client(
    metadata_config: OpenMetadataConnection,
) -> OpenMetadata:
    """Create an OpenMetadata client

    Args:
        metadata_config (OpenMetadataConnection): OM connection config

    Returns:
        OpenMetadata: an OM client
    """
    try:
        metadata = OpenMetadata(metadata_config)
        metadata.health_check()
        return metadata
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(
            f"No OpenMetadata server configuration found. "
            f"Setting client to `None`. You won't be able to access the server from the client: {exc}"
        )
        raise ValueError(exc)


def clean_up_starting_ending_double_quotes_in_string(string: str) -> str:
    """Remove start and ending double quotes in a string

    Args:
        string (str): a string

    Raises:
        TypeError: An error occure checking the type of `string`

    Returns:
        str: a string with no double quotes
    """
    if not isinstance(string, str):
        raise TypeError(f"{string}, must be of type str, instead got `{type(string)}`")

    return string.strip('"')
