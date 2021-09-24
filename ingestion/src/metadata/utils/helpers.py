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
import re
import json
from datetime import datetime, timedelta
from typing import List

from metadata.generated.schema.api.services.createDashboardService import CreateDashboardServiceEntityRequest
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest
from metadata.generated.schema.api.services.createMessagingService import CreateMessagingServiceEntityRequest
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.ingestion.ometa.openmetadata_rest import OpenMetadataAPIClient


def get_start_and_end(duration):
    today = datetime.utcnow()
    start = (today + timedelta(0 - duration)).replace(hour=0, minute=0, second=0, microsecond=0)
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
        service = {'jdbc': {'connectionUrl': f'jdbc://{config.host_port}', 'driverClass': 'jdbc'},
                   'name': config.service_name, 'description': '', 'serviceType': config.get_service_type()}
        print(service)
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


def get_dashboard_service_or_create(service_name: str,
                                    dashboard_service_type: str,
                                    username: str,
                                    password: str,
                                    dashboard_url: str,
                                    metadata_config) -> DashboardService:
    client = OpenMetadataAPIClient(metadata_config)
    service = client.get_dashboard_service(service_name)
    if service is not None:
        return service
    else:
        create_dashboard_service_request = CreateDashboardServiceEntityRequest(
            name=service_name,
            serviceType=dashboard_service_type,
            username=username,
            password=password,
            dashboardUrl=dashboard_url
        )
        created_service = client.create_dashboard_service(create_dashboard_service_request)
        return created_service

    def replace_str(variable, old, new):
        return variable.replace(old, new)

    def get_last_index(hive_str):
        counter = 1
        for index, i in enumerate(hive_str):
            if i == '>':
                counter -= 1
            elif i == '<':
                counter += 1
            if counter == 0:
                break
        return index

    def _handle_complex_data_types(hive_str):
        while '>' in hive_str:
            check_datatype = re.match(
                r'(.*?)(array<|uniontype<|map<|struct<.*?)(.*)', hive_str
                ).groups()
            a, b, c = check_datatype
            if b == 'struct<':
                b = replace_str(b, 'struct<', '{')
                hive_str = a + b + c
                index = get_last_index(hive_str)
                hive_str = hive_str[:index] + '}' + hive_str[index + 1:]
            elif b == 'array<' or b == 'uniontype<':
                b = replace_str(b, 'array<' if b == 'array<' else 'uniontype<', '[')
                hive_str = a + b + c
                index = get_last_index(hive_str)
                hive_str = hive_str[:index] + ']' + hive_str[index + 1:]
            elif b == 'map<':
                get_colon_index = hive_str.index(",", (hive_str.index('map<')))
                b = replace_str(b, 'map<', '{')
                hive_str = a + b + c
                hive_str = hive_str[:get_colon_index - 3] + ':' + hive_str[get_colon_index - 2:]
                index = get_last_index(hive_str)
                hive_str = hive_str[:index] + '}' + hive_str[index + 1:]

        hive_str = re.sub(r'([\w\s\(\)]+)', r'"\1"', hive_str)
        try:
            return json.loads(hive_str)
        except Exception as err:
            print(err)
