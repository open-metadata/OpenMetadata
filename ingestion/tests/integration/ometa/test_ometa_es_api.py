#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
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
import uuid
from copy import deepcopy
from unittest import TestCase
from unittest.mock import patch

import pytest
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
from metadata.generated.schema.type.basic import EntityName, SqlQuery
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn

from ..integration_base import TIER1_TAG, get_create_entity

FIELDS = "owners,domains"


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
                    query_checksum=cls.checksum,
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

        query_str = str(uuid.uuid4())
        cls.checksum = fqn.get_query_checksum(query_str)
        # Create queries for the given service
        query = CreateQueryRequest(
            query=SqlQuery(query_str),
            service=cls.service_entity.fullyQualifiedName,
            processedLineage=True,  # Only 1 with processed lineage
        )
        cls.metadata.create_or_update(query)

        query2 = CreateQueryRequest(
            query=SqlQuery(str(uuid.uuid4())),
            service=cls.service_entity.fullyQualifiedName,
        )
        cls.metadata.create_or_update(query2)

        # Create queries for another service
        cls.another_service_entity = cls.metadata.create_or_update(
            data=cls.another_service
        )

        another_query = CreateQueryRequest(
            query=SqlQuery(str(uuid.uuid4())),
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
                entity=DatabaseService, fqn=cls.service.name.root
            ).id.root
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

        another_service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=cls.another_service.name.root
            ).id.root
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
            self.service.name.root, "*", "*", self.entity.name.root
        )

        res = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            size=100,
            fields=FIELDS,
        )

        # We get the created table back
        self.assertIsNotNone(res)
        self.assertIn(self.entity, res)

        fqn_search_string = fqn._build(
            self.service.name.root,
            self.create_db_entity.name.root,
            "*",
            self.entity.name.root,
        )

        res = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            size=100,
            fields=FIELDS,
        )

        self.assertIsNotNone(res)
        self.assertIn(self.entity, res)

        fqn_search_string = fqn._build(
            self.service.name.root,
            self.create_db_entity.name.root,
            self.create_schema_entity.name.root,
            self.entity.name.root,
        )

        res = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            size=100,
            fields=FIELDS,
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
        self.assertEqual(res, quote(expected))

    def test_get_queries_with_lineage(self):
        """Check the payload from ES"""
        res = self.metadata.es_get_queries_with_lineage(self.service.name.root)
        self.assertIn(self.checksum, res)

    def test_paginate_no_filter(self):
        """We can paginate all the data"""
        # Since the test can run in parallel with other tables being there, we just
        # want to check we are actually getting some results
        for asset in self.metadata.paginate_es(entity=Table, size=2):
            assert asset
            break

    def test_paginate_with_errors(self):
        """We don't want to stop the ES yields just because a single Entity has an error"""
        # 1. First, prepare some tables
        for name in [f"table_{i}" for i in range(10)]:
            self.metadata.create_or_update(
                data=get_create_entity(
                    entity=Table,
                    name=EntityName(name),
                    reference=self.create_schema_entity.fullyQualifiedName,
                )
            )

        # 2. We'll fetch the entities, but we need to force a failure to ensure we can recover
        error_name = fqn._build(
            self.service_entity.name.root,
            self.create_db_entity.name.root,
            self.create_schema_entity.name.root,
            "table_5",
        )
        ok_name = fqn._build(
            self.service_entity.name.root,
            self.create_db_entity.name.root,
            self.create_schema_entity.name.root,
            "table_6",
        )

        rest_client = self.metadata.client
        original_get = rest_client.get
        with patch.object(rest_client, "get", wraps=rest_client.get) as mock_get:

            def side_effect(path: str, data=None):
                # In case we pass filters as well, use `in path` rather than ==
                if f"/tables/name/{error_name}" in path:
                    raise RuntimeError("Error")
                return original_get(path, data)

            mock_get.side_effect = side_effect

            # Validate we are raising the error
            with pytest.raises(RuntimeError):
                self.metadata.get_by_name(entity=Table, fqn=error_name)

            # This works
            self.metadata.get_by_name(entity=Table, fqn=ok_name)

            query_filter = (
                '{"query":{"bool":{"must":[{"bool":{"should":[{"term":'
                f'{{"service.displayName.keyword":"{self.service_entity.name.root}"}}}}]}}}}]}}}}}}'
            )
            assets = list(
                self.metadata.paginate_es(
                    entity=Table, query_filter=query_filter, size=2
                )
            )
            assert len(assets) == 10

    def test_paginate_with_filters(self):
        """We can paginate only tier 1 tables"""
        # prepare some tables with tier 1 tags
        for idx, name in enumerate([f"filtered_{i}" for i in range(10)]):
            table = self.metadata.create_or_update(
                data=get_create_entity(
                    entity=Table,
                    name=EntityName(name),
                    reference=self.create_schema_entity.fullyQualifiedName,
                )
            )
            if idx % 2 == 0:
                dest = deepcopy(table)
                dest.tags = [TIER1_TAG]
                self.metadata.patch(entity=Table, source=table, destination=dest)

        query_filter = (
            '{"query":{"bool":{"must":[{"bool":{"must":['
            '{"term":{"tier.tagFQN":"Tier.Tier1"}},'
            f'{{"term":{{"service.displayName.keyword":"{self.service_entity.name.root}"}}}}'
            "]}}]}}}"
        )
        assets = list(
            self.metadata.paginate_es(entity=Table, query_filter=query_filter, size=2)
        )
        assert len(assets) == 5
