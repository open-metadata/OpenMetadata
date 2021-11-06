#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
from datetime import datetime, timedelta
from typing import List

from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceEntityRequest,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceEntityRequest,
)
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceEntityRequest,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.ingestion.ometa.ometa_api import OpenMetadata


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


def get_database_service_or_create(config, metadata_config) -> DatabaseService:
    metadata = OpenMetadata(metadata_config)
    service = metadata.get_by_name(entity=DatabaseService, fqdn=config.service_name)
    if service is not None:
        return service
    else:
        service = {
            "jdbc": {
                "connectionUrl": f"jdbc://{config.host_port}",
                "driverClass": "jdbc",
            },
            "name": config.service_name,
            "description": "",
            "serviceType": config.get_service_type(),
        }
        created_service = metadata.create_or_update(
            CreateDatabaseServiceEntityRequest(**service)
        )
        return created_service


def get_messaging_service_or_create(
    service_name: str,
    message_service_type: str,
    schema_registry_url: str,
    brokers: List[str],
    metadata_config,
) -> MessagingService:
    metadata = OpenMetadata(metadata_config)
    service = metadata.get_by_name(entity=MessagingService, fqdn=service_name)
    if service is not None:
        return service
    else:
        created_service = metadata.create_or_update(
            CreateMessagingServiceEntityRequest(
                name=service_name,
                serviceType=message_service_type,
                brokers=brokers,
                schemaRegistry=schema_registry_url,
            )
        )
        return created_service


def get_dashboard_service_or_create(
    service_name: str,
    dashboard_service_type: str,
    username: str,
    password: str,
    dashboard_url: str,
    metadata_config,
) -> DashboardService:
    metadata = OpenMetadata(metadata_config)
    service = metadata.get_by_name(entity=DashboardService, fqdn=service_name)
    if service is not None:
        return service
    else:
        created_service = metadata.create_or_update(
            CreateDashboardServiceEntityRequest(
                name=service_name,
                serviceType=dashboard_service_type,
                username=username,
                password=password,
                dashboardUrl=dashboard_url,
            )
        )
        return created_service


def convert_epoch_to_iso(seconds_since_epoch):
    dt = datetime.utcfromtimestamp(seconds_since_epoch)
    iso_format = dt.isoformat() + "Z"
    return iso_format
