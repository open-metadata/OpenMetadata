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

from unittest import mock, TestCase

from requests import HTTPError

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseEntityRequest
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import REST, APIError


class RestTest(TestCase):

    @classmethod
    def setUpClass(cls) -> None:
        cls._client = REST("http://localhost:8585/api", 'test', 'none')

    @classmethod
    def tearDownClass(cls) -> None:
        pass

    def test_get_and_delete_service(self):
        mysql_service = self._client.get_database_service('local_mysql')
        self.assertEqual(mysql_service.name, 'local_mysql')
        self._client.delete_database_service(mysql_service.id.__root__)
        self.assertRaises(APIError, self._client.get_database_service_by_id, mysql_service.id.__root__)

    def test_create_service(self):
        data = {'jdbc': {'connectionUrl': 'mysql://localhost/catalog_db', 'driverClass': 'jdbc'},
                'name': 'local_mysql',
                'description': 'local mysql env'}
        create_mysql_service = CreateDatabaseServiceEntityRequest(**data)
        mysql_service = self._client.create_database_service(create_mysql_service)
        print(mysql_service)
        self.assertEqual(mysql_service.name, create_mysql_service.name)

    def test_get_service_by_id(self):
        mysql_service = self._client.get_database_service('local_mysql')
        self.assertEqual(mysql_service.name, 'local_mysql')
        mysql_service_get_id = self._client.get_database_service_by_id(mysql_service.id.__root__)
        self.assertEqual(mysql_service.id, mysql_service_get_id.id)

    def test_create_get_list_databases(self):
        mysql_service = self._client.get_database_service('local_mysql')
        service_reference = EntityReference(id=mysql_service.id, entity='mysql')
        create_database_request = CreateDatabaseEntityRequest(name="dwh", service=service_reference)
        created_database = self._client.create_database(create_database_request)
        self.assertEqual(create_database_request.name, created_database.name)
        created_database.description = "hello world"
        update_database_request = CreateDatabaseEntityRequest(name=created_database.name, description=created_database.description,
                                                              service=service_reference)
        updated_database = self._client.create_database(update_database_request)
        self.assertEqual(updated_database.description, created_database.description)

    def test_create_update_table(self):
        databases = self._client.list_databases()
        columns = [Column(name="id", columnDataType="INT"), Column(name="name", columnDataType="VARCHAR")]
        table = CreateTableEntityRequest(name="test1", columns=columns, database=databases[0].id)
        created_table = self._client.create_or_update_table(table)
        self.assertEqual(table.name, created_table.name)
