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
import re
from datetime import datetime, timedelta
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


def get_start_and_end(duration):
    today = datetime.utcnow()
    start = (today + timedelta(0 - duration)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    # Add one day to make sure we are handling today's queries
    end = (today + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, end


def snake_to_camel(s):
    a = s.split("_")
    a[0] = a[0].capitalize()
    if len(a) > 1:
        a[1:] = [u.title() for u in a[1:]]
    return "".join(a)


def get_database_service_or_create(
    config: WorkflowSource, metadata_config, service_name=None
) -> DatabaseService:
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
    metadata = OpenMetadata(metadata_config)
    service: MessagingService = metadata.get_by_name(
        entity=MessagingService, fqn=service_name
    )
    if service is not None:
        return service
    else:
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
    metadata = OpenMetadata(metadata_config)
    service: DashboardService = metadata.get_by_name(
        entity=DashboardService, fqn=service_name
    )
    if service is not None:
        return service
    else:
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
    metadata = OpenMetadata(metadata_config)
    service: StorageService = metadata.get_by_name(
        entity=StorageService, fqn=service_json["name"]
    )
    if service is not None:
        return service
    else:
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
    entities = []
    for id in chart_ids:
        chart: Chart = metadata.get_by_name(
            entity=Chart,
            fqn=fqn.build(
                metadata, Chart, chart_name=str(id), service_name=service_name
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
