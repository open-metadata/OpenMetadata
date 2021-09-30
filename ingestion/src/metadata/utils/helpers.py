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
from typing import Any, Dict, List, Optional, Set, Type

from metadata.generated.schema.api.services.createDashboardService import CreateDashboardServiceEntityRequest
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest
from metadata.generated.schema.api.services.createMessagingService import CreateMessagingServiceEntityRequest
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.ometa.openmetadata_rest import OpenMetadataAPIClient
from sqlalchemy.sql import sqltypes as types


def register_custom_type(
        tp: Type[types.TypeEngine], output: str = None
) -> None:
    if output:
        _column_type_mapping[tp] = output
    else:
        _known_unknown_column_types.add(tp)


_column_type_mapping: Dict[Type[types.TypeEngine], str] = {
    types.Integer: "INT",
    types.Numeric: "INT",
    types.Boolean: "BOOLEAN",
    types.Enum: "ENUM",
    types._Binary: "BYTES",
    types.LargeBinary: "BYTES",
    types.PickleType: "BYTES",
    types.ARRAY: "ARRAY",
    types.VARCHAR: "VARCHAR",
    types.String: "STRING",
    types.Date: "DATE",
    types.DATE: "DATE",
    types.Time: "TIME",
    types.DateTime: "DATETIME",
    types.DATETIME: "DATETIME",
    types.TIMESTAMP: "TIMESTAMP",
    types.NullType: "NULL",
    types.JSON: "JSON",
    types.CHAR: "CHAR"
}

_known_unknown_column_types: Set[Type[types.TypeEngine]] = {
    types.Interval,
    types.CLOB,
}


def get_column_type(status: SourceStatus, dataset_name: str, column_type: Any) -> str:
    type_class: Optional[str] = None
    for sql_type in _column_type_mapping.keys():
        if isinstance(column_type, sql_type):
            type_class = _column_type_mapping[sql_type]
            break
    if type_class is None:
        for sql_type in _known_unknown_column_types:
            if isinstance(column_type, sql_type):
                type_class = "NULL"
                break
    if type_class is None and column_type == 'CHARACTER VARYING':
        type_class = _column_type_mapping[types.VARCHAR]
    if type_class is None:
        status.warning(
            dataset_name, f"unable to map type {column_type!r} to metadata schema"
        )
        type_class = "NULL"

    return type_class


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

def get_last_index(nested_str):
    counter = 1
    for index, i in enumerate(nested_str):
        if i == '>':
            counter -= 1
        elif i == '<':
            counter += 1
        if counter == 0:
            break
    return index


def get_variable(nested):
    return re.match(r'([\w:\s?()]*)(,?)(?:[>]*)(.*)', nested)


def get_struct(struct_string):
    return re.match(r'^(struct<)(.*)', struct_string)


def _handle_complex_data_types(status, dataset_name, nested_str):
    col = []
    counter = 0
    check_dt = nested_str
    previous_dt = ''
    while check_dt != '':
        if previous_dt == check_dt and counter > 1:
            break
        else:
            previous_dt = check_dt
            counter+=1
        struct = None
        parse_str = None
        if type(check_dt) == str:
            struct = get_struct(check_dt)
            if struct:
                _, nested = struct.groups()
                index = get_last_index(nested)
                nested = nested[:index]
            else:
                parse_str, _, remaining_str = get_variable(check_dt).groups()

        if parse_str is None:
            parse_str, _, remaining_str = get_variable(nested).groups()

        get_datatype = re.match(r'(.*)(:)([\w\s]*)(\(\d*\))?(?:>*)(.*?)', parse_str)
        if parse_str and get_datatype:
            children = {}
            name, _, data_type, length, _ = get_datatype.groups()
            children['name'] = name
            children['dataType'] = get_column_type(status,dataset_name,data_type.upper())
            children['dataLength'] = length.lstrip('(').rstrip(')')
            if data_type.lower() == 'struct':
                children['dataTypeDisplay'] = children['dataType']
                children['children']=(_handle_complex_data_types(status, dataset_name, 
                check_dt.lstrip(name).lstrip(':')))
            else:
                children['dataTypeDisplay'] = children['dataType']
            if not length:
                length = 1
            col.append(children)
        check_dt = remaining_str
    return col


