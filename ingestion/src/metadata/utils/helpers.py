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

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable

from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceRequest,
)
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceRequest,
)
from metadata.generated.schema.api.services.createStorageService import (
    CreateStorageServiceRequest,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

logger = logging.getLogger(__name__)


def get_start_and_end(duration):
    today = datetime.utcnow()
    start = (today + timedelta(0 - duration)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    end = (today + timedelta(3)).replace(hour=0, minute=0, second=0, microsecond=0)
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
        entity=DatabaseService, fqdn=service_name
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
        entity=MessagingService, fqdn=service_name
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
        entity=DashboardService, fqdn=service_name
    )
    if service is not None:
        return service
    else:
        dashboard_config = {"config": config}
        print(dashboard_config)
        created_service = metadata.create_or_update(
            CreateDashboardServiceRequest(
                name=service_name,
                serviceType=dashboard_service_type,
                connection=dashboard_config,
            )
        )
        return created_service


def get_pipeline_service_or_create(service_json, metadata_config) -> PipelineService:
    metadata = OpenMetadata(metadata_config)
    service: PipelineService = metadata.get_by_name(
        entity=PipelineService, fqdn=service_json["name"]
    )
    if service is not None:
        return service
    else:
        created_service = metadata.create_or_update(
            CreatePipelineServiceRequest(**service_json)
        )
        return created_service


def get_storage_service_or_create(service_json, metadata_config) -> StorageService:
    metadata = OpenMetadata(metadata_config)
    service: StorageService = metadata.get_by_name(
        entity=StorageService, fqdn=service_json["name"]
    )
    if service is not None:
        return service
    else:
        created_service = metadata.create_or_update(
            CreateStorageServiceRequest(**service_json)
        )
        return created_service


def datetime_to_ts(date: datetime) -> int:
    """
    Convert a given date to a timestamp as an Int
    """
    return int(date.timestamp())


def _get_formmated_table_name(table_name):
    return table_name.replace("[", "").replace("]", "")


def get_raw_extract_iter(alchemy_helper) -> Iterable[Dict[str, Any]]:
    """
    Provides iterator of result row from SQLAlchemy helper
    :return:
    """
    rows = alchemy_helper.execute_query()
    for row in rows:
        yield row
