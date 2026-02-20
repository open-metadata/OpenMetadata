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
import json
import logging
import time
import uuid
from copy import deepcopy
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
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.type.basic import EntityName, SqlQuery
from metadata.utils import fqn

from ..integration_base import TIER1_TAG, generate_name, get_create_entity

FIELDS = "owners,domains"


@pytest.fixture(scope="module")
def es_service(metadata):
    """Module-scoped database service for ES tests."""
    service_name = generate_name()
    service_request = CreateDatabaseServiceRequest(
        name=service_name,
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="username",
                authType=BasicAuth(password="password"),
                hostPort="http://localhost:1234",
            )
        ),
    )
    service = metadata.create_or_update(data=service_request)

    yield service

    metadata.delete(
        entity=DatabaseService,
        entity_id=service.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def another_es_service(metadata):
    """Module-scoped second database service for ES tests."""
    service_name = generate_name()
    service_request = CreateDatabaseServiceRequest(
        name=service_name,
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="username",
                authType=BasicAuth(password="password"),
                hostPort="http://localhost:1234",
            )
        ),
    )
    service = metadata.create_or_update(data=service_request)

    yield service

    metadata.delete(
        entity=DatabaseService,
        entity_id=service.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def es_database(metadata, es_service):
    """Module-scoped database for ES tests."""
    database_name = generate_name()
    database_request = CreateDatabaseRequest(
        name=database_name,
        service=es_service.fullyQualifiedName,
    )
    database = metadata.create_or_update(data=database_request)

    yield database

    metadata.delete(entity=Database, entity_id=database.id, hard_delete=True)


@pytest.fixture(scope="module")
def es_schema(metadata, es_database):
    """Module-scoped database schema for ES tests."""
    schema_name = generate_name()
    schema_request = CreateDatabaseSchemaRequest(
        name=schema_name,
        database=es_database.fullyQualifiedName,
    )
    schema = metadata.create_or_update(data=schema_request)

    yield schema

    metadata.delete(
        entity=DatabaseSchema, entity_id=schema.id, recursive=True, hard_delete=True
    )


@pytest.fixture(scope="module")
def es_table(metadata, es_schema):
    """Module-scoped table for ES tests."""
    table_name = generate_name()
    table_request = CreateTableRequest(
        name=table_name,
        databaseSchema=es_schema.fullyQualifiedName,
        columns=[Column(name="id", dataType=DataType.BIGINT)],
    )
    table = metadata.create_or_update(data=table_request)

    yield table

    metadata.delete(entity=Table, entity_id=table.id, hard_delete=True)


@pytest.fixture(scope="module")
def es_queries(metadata, es_service, another_es_service):
    """Module-scoped queries for ES tests."""
    query_str = str(uuid.uuid4())
    checksum = fqn.get_query_checksum(query_str)

    query1 = CreateQueryRequest(
        query=SqlQuery(query_str),
        service=es_service.fullyQualifiedName,
        processedLineage=True,
    )
    q1 = metadata.create_or_update(data=query1)

    query2 = CreateQueryRequest(
        query=SqlQuery(str(uuid.uuid4())),
        service=es_service.fullyQualifiedName,
    )
    q2 = metadata.create_or_update(data=query2)

    another_query = CreateQueryRequest(
        query=SqlQuery(str(uuid.uuid4())),
        service=another_es_service.fullyQualifiedName,
        processedLineage=True,
    )
    q3 = metadata.create_or_update(data=another_query)

    yield {"checksum": checksum, "queries": [q1, q2, q3]}

    for query in [q1, q2, q3]:
        metadata.delete(entity=Query, entity_id=query.id, hard_delete=True)


@pytest.fixture(scope="module")
def wait_for_es_index(metadata, es_table, es_queries, es_service):
    """Wait for ES index to be updated with test data."""
    logging.info("Checking ES index status...")
    tries = 0
    checksum = es_queries["checksum"]

    table_res = None
    query_res = None
    while not table_res and not query_res and tries <= 5:
        table_res = metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=es_table.fullyQualifiedName.root,
        )
        query_res = metadata.es_search_from_fqn(
            entity_type=Query,
            fqn_search_string=fqn.build(
                metadata=None,
                entity_type=Query,
                service_name=es_service.name.root,
                query_checksum=checksum,
            ),
        )
        if not table_res or not query_res:
            tries += 1
            time.sleep(1)

    return True


class TestOMetaESAPI:
    """
    ES API integration tests.
    Tests Elasticsearch search, pagination, filtering, and sorting.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_es_search_from_service_table(
        self,
        metadata,
        es_service,
        es_database,
        es_schema,
        es_table,
        wait_for_es_index,
    ):
        """
        We can fetch tables from a service using ES search with wildcards
        """
        fqn_search_string = fqn._build(
            es_service.name.root, "*", "*", es_table.name.root
        )

        res = metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            size=100,
            fields=FIELDS,
        )

        assert res is not None
        assert es_table in res

        fqn_search_string = fqn._build(
            es_service.name.root,
            es_database.name.root,
            "*",
            es_table.name.root,
        )

        res = metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            size=100,
            fields=FIELDS,
        )

        assert res is not None
        assert es_table in res

        fqn_search_string = es_table.fullyQualifiedName.root

        res = metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            size=100,
            fields=FIELDS,
        )

        assert res is not None
        assert es_table in res

    def test_es_search_from_service_table_empty(self, metadata):
        """
        Wrong filters return none
        """
        res = metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string="random",
        )

        assert res is None

    def test_get_query_with_lineage_filter(self, metadata):
        """Check we are building the proper filter"""
        res = metadata.get_query_with_lineage_filter("my_service")
        expected = (
            '{"query": {"bool": {"must": [{"term": {"processedLineage": true}},'
            ' {"term": {"service.name.keyword": "my_service"}}]}}}'
        )
        assert res == quote(expected)

    def test_get_queries_with_lineage(
        self, metadata, es_service, es_queries, wait_for_es_index
    ):
        """Check the payload from ES"""
        res = metadata.es_get_queries_with_lineage(es_service.name.root)
        assert es_queries["checksum"] in res

    def test_paginate_no_filter(self, metadata):
        """We can paginate all the data"""
        for asset in metadata.paginate_es(entity=Table, size=2):
            assert asset
            break

    def test_paginate_with_errors(self, metadata, es_service, es_database, es_schema):
        """We don't want to stop the ES yields just because a single Entity has an error"""
        created_tables = []
        try:
            for name in [f"table_{i}" for i in range(10)]:
                table = metadata.create_or_update(
                    data=get_create_entity(
                        entity=Table,
                        name=EntityName(name),
                        reference=es_schema.fullyQualifiedName,
                    )
                )
                created_tables.append(table)

            error_name = fqn._build(
                es_service.name.root,
                es_database.name.root,
                es_schema.name.root,
                "table_5",
            )
            ok_name = fqn._build(
                es_service.name.root,
                es_database.name.root,
                es_schema.name.root,
                "table_6",
            )

            rest_client = metadata.client
            original_get = rest_client.get
            with patch.object(rest_client, "get", wraps=rest_client.get) as mock_get:

                def side_effect(path: str, data=None):
                    if f"/tables/name/{error_name}" in path:
                        raise RuntimeError("Error")
                    return original_get(path, data)

                mock_get.side_effect = side_effect

                with pytest.raises(RuntimeError):
                    metadata.get_by_name(entity=Table, fqn=error_name)

                metadata.get_by_name(entity=Table, fqn=ok_name)

                query_filter = (
                    '{"query":{"bool":{"must":[{"bool":{"should":[{"term":'
                    f'{{"service.displayName.keyword":"{es_service.name.root}"}}}}]}}}}]}}}}}}'
                )
                assets = list(
                    metadata.paginate_es(
                        entity=Table, query_filter=query_filter, size=2
                    )
                )
                assert len(assets) == 10
        finally:
            for table in created_tables:
                try:
                    metadata.delete(entity=Table, entity_id=table.id, hard_delete=True)
                except Exception:
                    pass

    def test_paginate_with_filters(self, metadata, es_service, es_schema):
        """We can paginate only tier 1 tables"""
        created_tables = []
        try:
            for idx, name in enumerate([f"filtered_{i}" for i in range(10)]):
                table = metadata.create_or_update(
                    data=get_create_entity(
                        entity=Table,
                        name=EntityName(name),
                        reference=es_schema.fullyQualifiedName,
                    )
                )
                created_tables.append(table)
                if idx % 2 == 0:
                    dest = deepcopy(table)
                    dest.tags = [TIER1_TAG]
                    metadata.patch(entity=Table, source=table, destination=dest)

            query_filter = (
                '{"query":{"bool":{"must":[{"bool":{"must":['
                '{"term":{"tier.tagFQN":"Tier.Tier1"}},'
                f'{{"term":{{"service.displayName.keyword":"{es_service.name.root}"}}}}'
                "]}}]}}}"
            )
            assets = list(
                metadata.paginate_es(entity=Table, query_filter=query_filter, size=2)
            )
            assert len(assets) == 5
        finally:
            for table in created_tables:
                try:
                    metadata.delete(entity=Table, entity_id=table.id, hard_delete=True)
                except Exception:
                    pass

    def test_paginate_with_sorting(self, metadata, es_service, es_schema):
        """Test different sorting options for ES pagination"""
        test_id = str(uuid.uuid4())[:8]
        created_tables = []
        try:
            for name in [f"paginating_table_{test_id}_{i}" for i in range(5)]:
                table = metadata.create_or_update(
                    data=get_create_entity(
                        entity=Table,
                        name=EntityName(name),
                        reference=es_schema.fullyQualifiedName,
                    )
                )
                created_tables.append(table)

            time.sleep(2)

            query_filter_obj = {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "bool": {
                                    "must": [
                                        {
                                            "term": {
                                                "service.name.keyword": (
                                                    es_service.name.root
                                                )
                                            }
                                        },
                                        {
                                            "wildcard": {
                                                "name.keyword": f"paginating_table_{test_id}_*"
                                            }
                                        },
                                    ]
                                }
                            }
                        ]
                    }
                }
            }

            query_filter = json.dumps(query_filter_obj)

            assets = list(
                metadata.paginate_es(entity=Table, query_filter=query_filter, size=2)
            )
            returned_table_names = [
                asset.name.root
                for asset in assets
                if asset.name.root.startswith(f"paginating_table_{test_id}_")
            ]
            assert returned_table_names == [
                f"paginating_table_{test_id}_4",
                f"paginating_table_{test_id}_3",
                f"paginating_table_{test_id}_2",
                f"paginating_table_{test_id}_1",
                f"paginating_table_{test_id}_0",
            ]

            assets = list(
                metadata.paginate_es(
                    entity=Table, query_filter=query_filter, size=2, sort_order="asc"
                )
            )
            returned_table_names = [
                asset.name.root
                for asset in assets
                if asset.name.root.startswith(f"paginating_table_{test_id}_")
            ]
            assert returned_table_names == [
                f"paginating_table_{test_id}_0",
                f"paginating_table_{test_id}_1",
                f"paginating_table_{test_id}_2",
                f"paginating_table_{test_id}_3",
                f"paginating_table_{test_id}_4",
            ]

            assets = list(
                metadata.paginate_es(
                    entity=Table, query_filter=query_filter, size=2, sort_field="_score"
                )
            )
            returned_table_names = {
                asset.name.root
                for asset in assets
                if asset.name.root.startswith(f"paginating_table_{test_id}_")
            }
            # Use set to deduplicate: server-side FieldValue type mismatch in search_after
            # for _score sort can cause ES to return duplicate pages (KNOWN ISSUE)
            assert len(returned_table_names) == 5
        finally:
            for table in created_tables:
                try:
                    metadata.delete(entity=Table, entity_id=table.id, hard_delete=True)
                except Exception:
                    pass

    def test_paginate_invalid_sort_order(self, metadata, es_service):
        """Test that invalid sort_order raises ValueError"""
        query_filter_obj = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "bool": {
                                "must": [
                                    {
                                        "term": {
                                            "service.name.keyword": (
                                                es_service.name.root
                                            )
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            }
        }
        query_filter = json.dumps(query_filter_obj)

        with pytest.raises(ValueError, match="sort_order must be 'asc' or 'desc'"):
            list(
                metadata.paginate_es(
                    entity=Table,
                    query_filter=query_filter,
                    sort_order="invalid",
                )
            )
