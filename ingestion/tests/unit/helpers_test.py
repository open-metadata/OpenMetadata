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
import json
from unittest import TestCase

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseEntityRequest
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.api.services.createDatabaseService import \
    CreateDatabaseServiceEntityRequest
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.openmetadata_rest import OpenMetadataAPIClient
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.generated.schema.api.services.createDashboardService import \
    CreateDashboardServiceEntityRequest
from metadata.generated.schema.api.services.createMessagingService import \
    CreateMessagingServiceEntityRequest


class RestTest(TestCase):
    file_path = 'tests/unit/mysql_test.json'
    with open(file_path) as ingestionFile:
        ingestionData = ingestionFile.read()
    client_config = json.loads(ingestionData).get("metadata_server")
    config = client_config.get("config", {})
    metadata_config = MetadataServerConfig.parse_obj(config)
    openmetadata_client = OpenMetadataAPIClient(metadata_config)
    client = OpenMetadataAPIClient(metadata_config).client

    def test_1_create_service(self):
        data = {
            'jdbc': {'connectionUrl': 'mysql://localhost/openmetadata_db', 'driverClass': 'jdbc'},
            'name': 'local_mysql_test',
            'serviceType': "MySQL",
            'description': 'local mysql env'}
        create_mysql_service = CreateDatabaseServiceEntityRequest(**data)
        mysql_service = self.openmetadata_client.create_database_service(create_mysql_service)
        self.assertEqual(mysql_service.name, create_mysql_service.name)

    def test_2_get_service(self):
        mysql_service = self.openmetadata_client.get_database_service('local_mysql_test')
        self.assertEqual(mysql_service.name, 'local_mysql_test')

    def test_3_get_service_by_id(self):
        mysql_service = self.openmetadata_client.get_database_service('local_mysql_test')
        mysql_service_get_id = self.openmetadata_client.get_database_service_by_id(
            mysql_service.id.__root__
        )
        self.assertEqual(mysql_service.id, mysql_service_get_id.id)

    def test_4_create_update_databases(self):
        mysql_service = self.openmetadata_client.get_database_service('local_mysql_test')
        service_reference = EntityReference(id=mysql_service.id.__root__, type="databaseService")
        create_database_request = CreateDatabaseEntityRequest(
            name="dwh", service=service_reference
        )
        created_database = self.openmetadata_client.create_database(create_database_request)
        created_database.description = "hello world"
        update_database_request = CreateDatabaseEntityRequest(
            name=created_database.name, description=created_database.description,
            service=service_reference
        )
        updated_database = self.openmetadata_client.create_database(update_database_request)
        self.assertEqual(updated_database.description, created_database.description)

    def test_5_create_table(self):
        databases = self.openmetadata_client.list_databases()
        columns = [Column(name="id", columnDataType="INT"),
                   Column(name="name", columnDataType="VARCHAR")]
        table = CreateTableEntityRequest(
            name="test1", columns=columns, database=databases[0].id.__root__
            )
        created_table = self.openmetadata_client.create_or_update_table(table)
        self.client.delete(f"/tables/{created_table.id.__root__}")
        self.client.delete(f"/databases/{databases[0].id.__root__}")
        self.assertEqual(table.name, created_table.name)

    def test_6_delete_service(self):
        mysql_service = self.openmetadata_client.get_database_service('local_mysql_test')
        self.openmetadata_client.delete_database_service(mysql_service.id.__root__)
        self.assertRaises(
            APIError, self.openmetadata_client.get_database_service_by_id,
            mysql_service.id.__root__
        )

    def test_7_create_messaging_service(self):
        create_messaging_service = CreateMessagingServiceEntityRequest(
            name='sample_kafka_test',
            serviceType='Kafka',
            brokers=['localhost:9092'],
            schemaRegistry='http://localhost:8081'
        )
        messaging_service = self.openmetadata_client.create_messaging_service(
            create_messaging_service
        )
        self.assertEqual(create_messaging_service.name, messaging_service.name)

    def test_8_get_messaging_service(self):
        messaging_service = self.openmetadata_client.get_messaging_service('sample_kafka_test')
        self.client.delete(f"/services/messagingServices/{messaging_service.id.__root__}")
        self.assertEqual(messaging_service.name, 'sample_kafka_test')

    def test_9_create_dashboard_service(self):
        create_dashboard_service = CreateDashboardServiceEntityRequest(
            name='sample_superset_test',
            serviceType='Superset',
            username='admin',
            password='admin',
            dashboardUrl='http://localhost:8088'
        )
        dashboard_service = None
        try:
            dashboard_service = self.openmetadata_client.create_dashboard_service(
                create_dashboard_service
            )
        except APIError:
            print(APIError)
        self.assertEqual(create_dashboard_service.name, dashboard_service.name)

    def test_10_get_dashboard_service(self):
        dashboard_service = self.openmetadata_client.get_dashboard_service('sample_superset_test')
        self.client.delete(f"/services/dashboardServices/{dashboard_service.id.__root__}")
        self.assertEqual(dashboard_service.name, 'sample_superset_test')
