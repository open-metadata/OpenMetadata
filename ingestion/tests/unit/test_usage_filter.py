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
#  pylint: disable=line-too-long,unused-argument

"""
Usage query database and schema filter tests
"""

from typing import Dict, List, Optional, Type, TypeVar
from unittest import TestCase
from unittest.mock import patch

from pydantic import BaseModel

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import (
    EntityReference,
    EntityReferenceList,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.clickhouse.usage import ClickhouseUsageSource

T = TypeVar("T", bound=BaseModel)

mock_clickhouse_config = {
    "source": {
        "type": "clickhouse-usage",
        "serviceName": "local_clickhouse",
        "serviceConnection": {
            "config": {
                "hostPort": "localhost:8123",
                "username": "usernames",
                "password": "password",
                "type": "Clickhouse",
                "databaseSchema": "default",
            }
        },
        "sourceConfig": {"config": {"queryLogDuration": "1"}},
    },
    "stage": {"type": "table-usage", "config": {"filename": "/tmp/mssql_usage"}},
    "bulkSink": {"type": "metadata-usage", "config": {"filename": "/tmp/mssql_usage"}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}


def mock_list_entities(
    self,
    entity: Type[T],
    fields: Optional[List[str]] = None,
    limit: int = 1000,
    params: Optional[Dict[str, str]] = None,
):
    """
    mock list entities for databases
    """
    schema_list1 = EntityReferenceList(
        __root__=[
            EntityReference(
                id="73129df3-96ed-476d-a9b5-b92091264649",
                name="test_schema_1",
                type="databaseSchema",
            ),
            EntityReference(
                id="73129df3-96ed-476d-a9b5-b92091264649",
                name="test_schema_2",
                type="databaseSchema",
            ),
            EntityReference(
                id="73129df3-96ed-476d-a9b5-b92091264649",
                name="test_schema_3",
                type="databaseSchema",
            ),
        ]
    )

    schema_list2 = EntityReferenceList(
        __root__=[
            EntityReference(
                id="73129df3-96ed-476d-a9b5-b92091264649",
                name="test_schema_4",
                type="databaseSchema",
            ),
            EntityReference(
                id="73129df3-96ed-476d-a9b5-b92091264649",
                name="test_schema_5",
                type="databaseSchema",
            ),
            EntityReference(
                id="73129df3-96ed-476d-a9b5-b92091264649",
                name="test_schema_6",
                type="databaseSchema",
            ),
        ]
    )

    return [
        Database(
            id="6a9b1ade-dff1-4a14-89f9-7842f1e06270",
            name="test_db_1",
            service=EntityReference(
                id="73129df3-96ed-476d-a9b5-b92091264649",
                name="test_db_service",
                type="databaseService",
            ),
            databaseSchemas=schema_list1,
        ),
        Database(
            id="6a9b1ade-dff1-4a14-89f9-7842f1e06270",
            name="test_db_2",
            service=EntityReference(
                id="73129df3-96ed-476d-a9b5-b92091264649",
                name="test_db_service",
                type="databaseService",
            ),
            databaseSchemas=schema_list2,
        ),
    ]


EXPECTED_CLICKHOUSE_FILTER = """
        and query_kind = 'Select'
     AND hasAny(databases, ['test_schema_1','test_schema_2','test_schema_3','test_schema_4','test_schema_5','test_schema_6'])"""


class UsageQueryFilterTests(TestCase):
    """
    Usage filter tests for database and schema filters
    """

    @patch.object(OpenMetadata, "list_all_entities", mock_list_entities)
    def test_prepare_clickhouse(self):
        config = OpenMetadataWorkflowConfig.parse_obj(mock_clickhouse_config)
        clickhouse_source = ClickhouseUsageSource.create(
            mock_clickhouse_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        clickhouse_source.prepare()
        assert clickhouse_source.filters == EXPECTED_CLICKHOUSE_FILTER
