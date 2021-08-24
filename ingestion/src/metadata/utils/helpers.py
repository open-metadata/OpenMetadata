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

from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest
from metadata.generated.schema.api.services.createMessagingService import CreateMessagingServiceEntityRequest
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.openmetadata_rest import OpenMetadataAPIClient


def get_start_and_end(duration):
    today = datetime.utcnow()
    start = (today + timedelta(0-duration)).replace(hour=0, minute=0, second=0, microsecond=0)
    end = (today + timedelta(3)).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, end


def snake_to_camel(s):
    a = s.split('_')
    a[0] = a[0].capitalize()
    if len(a) > 1:
        a[1:] = [u.title() for u in a[1:]]
    return ''.join(a)


def get_database_service_or_create(config, metadata_config) -> DatabaseService:
    client = OpenMetadataAPIClient(metadata_config)
    service = client.get_database_service(config.service_name)
    if service is not None:
        return service
    else:
        service = {'jdbc': {'connectionUrl': config.get_connection_url(), 'driverClass': 'jdbc'},
                   'name': config.service_name, 'description': '', 'serviceType': config.get_service_type()}
        created_service = client.create_database_service(CreateDatabaseServiceEntityRequest(**service))
        return created_service


def get_messaging_service_or_create(service_name: str,
                                    message_service_type: str,
                                    schema_registry_url: str,
                                    brokers: List[str],
                                    metadata_config) -> MessagingService:
    client = OpenMetadataAPIClient(metadata_config)
    service = client.get_messaging_service(service_name)
    if service is not None:
        return service
    else:
        create_messaging_service_request = CreateMessagingServiceEntityRequest(
            name=service_name,
            serviceType=message_service_type,
            brokers=brokers,
            schemaRegistry=schema_registry_url
        )
        created_service = client.create_messaging_service(create_messaging_service_request)
        return created_service
