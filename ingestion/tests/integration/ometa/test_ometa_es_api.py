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
OMeta ES Mixin integration tests. The API needs to be up
"""
import logging
import time
from unittest import TestCase

from requests.utils import quote

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.basic import SqlQuery
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn

QUERY_CHECKSUM = fqn.get_query_checksum("select * from awesome")


class OMetaESTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    service = CreateDatabaseServiceRequest(
        name="test-service-es",
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="username",
                authType=BasicAuth(
                    password="password",
                ),
                hostPort="http://localhost:1234",
            )
        ),
    )
    another_service = CreateDatabaseServiceRequest(
        name="another-test-service-es",
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="username",
                authType=BasicAuth(
                    password="password",
                ),
                hostPort="http://localhost:1234",
            )
        ),
    )
    service_type = "databaseService"

    @classmethod
    def check_es_index(cls) -> None:
        """
        Wait until the index has been updated with the test table.
        """
        logging.info("Checking ES index status...")
        tries = 0

        table_res = None
        query_res = None
        while not table_res and not query_res and tries <= 5:  # Kill in 5 seconds
            table_res = cls.metadata.es_search_from_fqn(
                entity_type=Table,
                fqn_search_string="test-service-es.test-db-es.test-schema-es.test-es",
            )
            query_res = cls.metadata.es_search_from_fqn(
                entity_type=Query,
                fqn_search_string=fqn.build(
                    metadata=None,
                    entity_type=Query,
                    service_name="test-service-es",
                    query_checksum=QUERY_CHECKSUM,
                ),
            )
            if not table_res or query_res:
                tries += 1
                time.sleep(1)

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        create_db = CreateDatabaseRequest(
            name="test-db-es",
            service=cls.service_entity.fullyQualifiedName,
        )

        cls.create_db_entity = cls.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema-es",
            database=cls.create_db_entity.fullyQualifiedName,
        )

        cls.create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        create = CreateTableRequest(
            name="test-es",
            databaseSchema=cls.create_schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.entity = cls.metadata.create_or_update(create)

        # Create queries for the given service
        query = CreateQueryRequest(
            query=SqlQuery(__root__="select * from awesome"),
            service=cls.service_entity.fullyQualifiedName,
            processedLineage=True,  # Only 1 with processed lineage
        )
        cls.metadata.create_or_update(query)

        query2 = CreateQueryRequest(
            query=SqlQuery(__root__="select * from another_awesome"),
            service=cls.service_entity.fullyQualifiedName,
        )
        cls.metadata.create_or_update(query2)

        # Create queries for another service
        cls.another_service_entity = cls.metadata.create_or_update(
            data=cls.another_service
        )

        another_query = CreateQueryRequest(
            query=SqlQuery(__root__="select * from awesome"),
            service=cls.another_service_entity.fullyQualifiedName,
            processedLineage=True,
        )
        cls.metadata.create_or_update(another_query)

        # Leave some time for indexes to get updated, otherwise this happens too fast
        cls.check_es_index()

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=cls.service.name.__root__
            ).id.__root__
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

        another_service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=cls.another_service.name.__root__
            ).id.__root__
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=another_service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_es_search_from_service_table(self):
        """
        We can fetch tables from a service
        """

        fqn_search_string = fqn._build(
            self.service.name.__root__, "*", "*", self.entity.name.__root__
        )

        res = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            size=100,
        )

        # We get the created table back
        self.assertIsNotNone(res)
        self.assertIn(self.entity, res)

        fqn_search_string = fqn._build(
            self.service.name.__root__,
            self.create_db_entity.name.__root__,
            "*",
            self.entity.name.__root__,
        )

        res = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            size=100,
        )

        self.assertIsNotNone(res)
        self.assertIn(self.entity, res)

        fqn_search_string = fqn._build(
            self.service.name.__root__,
            self.create_db_entity.name.__root__,
            self.create_schema_entity.name.__root__,
            self.entity.name.__root__,
        )

        res = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            size=100,
        )

        self.assertIsNotNone(res)
        self.assertIn(self.entity, res)

    def test_es_search_from_service_table_empty(self):
        """
        Wrong filters return none
        """
        res = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string="random",
        )

        self.assertIsNone(res)

    def test_get_query_with_lineage_filter(self):
        """Check we are building the proper filter"""
        res = self.metadata.get_query_with_lineage_filter("my_service")
        expected = (
            '{"query": {"bool": {"must": [{"term": {"processedLineage": true}},'
            ' {"term": {"service.name.keyword": "my_service"}}]}}}'
        )
        self.assertEquals(res, quote(expected))

    def test_get_queries_with_lineage(self):
        """Check the payload from ES"""
        res = self.metadata.es_get_queries_with_lineage(self.service.name.__root__)
        self.assertIn(QUERY_CHECKSUM, res)
