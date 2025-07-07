#  Copyright 2021 Collate
#  Copyright(c) 2023, TOSHIBA CORPORATION
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
PGSpider Lineage Unit Test
"""

import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.postgres.lineage import PostgresLineageSource
from metadata.ingestion.source.database.postgres.pgspider.lineage import (
    get_lineage_from_multi_tenant_table,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

mock_multi_tenant_file_path = (
    Path(__file__).parent / "resources/datasets/pgspider_multi_tenant_tables.json"
)
with open(mock_multi_tenant_file_path, encoding="utf-8") as file:
    mock_multi_tenant_data: dict = json.load(file)

mock_child_file_path = (
    Path(__file__).parent / "resources/datasets/pgspider_child_tables.json"
)
with open(mock_child_file_path, encoding="utf-8") as file:
    mock_child_data = json.load(file)

EXPECTED_PGSPIDER_DETAILS_1 = [
    AddLineageRequest(
        edge=EntitiesEdge(
            fromEntity=EntityReference(
                id="e3e1649a-97f4-4849-bc02-d8d67eab9722", type="table"
            ),
            toEntity=EntityReference(
                id="b3f7df8e-50de-4555-a497-c7e170f4de8e", type="table"
            ),
            lineageDetails=LineageDetails(
                columnsLineage=[
                    ColumnLineage(
                        fromColumns=[
                            "local_pgspider1.pgspider.public.test1__post_svr__0.id"
                        ],
                        toColumn="local_pgspider1.pgspider.public.test1.id",
                    )
                ]
            ),
        ),
    ),
    AddLineageRequest(
        edge=EntitiesEdge(
            fromEntity=EntityReference(
                id="02f020df-ef8c-4156-9d02-a2ff40b9649b", type="table"
            ),
            toEntity=EntityReference(
                id="b3f7df8e-50de-4555-a497-c7e170f4de8e", type="table"
            ),
            lineageDetails=LineageDetails(
                columnsLineage=[
                    ColumnLineage(
                        fromColumns=[
                            "local_pgspider1.pgspider.public.test1__post_svr__1.id"
                        ],
                        toColumn="local_pgspider1.pgspider.public.test1.id",
                    )
                ]
            ),
        ),
    ),
    AddLineageRequest(
        edge=EntitiesEdge(
            fromEntity=EntityReference(
                id="57ba2523-5424-467f-992a-afe29dc7e23d", type="table"
            ),
            toEntity=EntityReference(
                id="a68492cc-af89-4031-8b8e-bc31f2cedcd5", type="table"
            ),
            lineageDetails=LineageDetails(
                columnsLineage=[
                    ColumnLineage(
                        fromColumns=[
                            "local_pgspider1.pgspider.public.test2__post_svr__0.a"
                        ],
                        toColumn="local_pgspider1.pgspider.public.test2.a",
                    ),
                    ColumnLineage(
                        fromColumns=[
                            "local_pgspider1.pgspider.public.test2__post_svr__0.b"
                        ],
                        toColumn="local_pgspider1.pgspider.public.test2.b",
                    ),
                    ColumnLineage(
                        fromColumns=[
                            "local_pgspider1.pgspider.public.test2__post_svr__0.c"
                        ],
                        toColumn="local_pgspider1.pgspider.public.test2.c",
                    ),
                ]
            ),
        ),
    ),
]

EXPECTED_PGSPIDER_DETAILS_2 = [
    AddLineageRequest(
        edge=EntitiesEdge(
            fromEntity=EntityReference(
                id="e3e1649a-97f4-4849-bc02-d8d67eab9722", type="table"
            ),
            toEntity=EntityReference(
                id="b3f7df8e-50de-4555-a497-c7e170f4de8e", type="table"
            ),
            lineageDetails=LineageDetails(
                columnsLineage=[
                    ColumnLineage(
                        fromColumns=[
                            "local_pgspider1.pgspider.public.test1__post_svr__0.id"
                        ],
                        toColumn="local_pgspider1.pgspider.public.test1.id",
                    )
                ]
            ),
        ),
    ),
    AddLineageRequest(
        edge=EntitiesEdge(
            fromEntity=EntityReference(
                id="02f020df-ef8c-4156-9d02-a2ff40b9649b", type="table"
            ),
            toEntity=EntityReference(
                id="b3f7df8e-50de-4555-a497-c7e170f4de8e", type="table"
            ),
            lineageDetails=LineageDetails(
                columnsLineage=[
                    ColumnLineage(
                        fromColumns=[
                            "local_pgspider1.pgspider.public.test1__post_svr__1.id"
                        ],
                        toColumn="local_pgspider1.pgspider.public.test1.id",
                    )
                ]
            ),
        ),
    ),
    AddLineageRequest(
        edge=EntitiesEdge(
            fromEntity=EntityReference(
                id="57ba2523-5424-467f-992a-afe29dc7e23d", type="table"
            ),
            toEntity=EntityReference(
                id="a68492cc-af89-4031-8b8e-bc31f2cedcd5", type="table"
            ),
            lineageDetails=LineageDetails(
                columnsLineage=[
                    ColumnLineage(
                        fromColumns=[
                            "local_pgspider1.pgspider.public.test2__post_svr__0.a"
                        ],
                        toColumn="local_pgspider1.pgspider.public.test2.a",
                    ),
                    ColumnLineage(
                        fromColumns=[
                            "local_pgspider1.pgspider.public.test2__post_svr__0.b"
                        ],
                        toColumn="local_pgspider1.pgspider.public.test2.b",
                    ),
                ]
            ),
        ),
    ),
]

EXPECTED_PGSPIDER_DETAILS_3 = [
    AddLineageRequest(
        edge=EntitiesEdge(
            fromEntity=EntityReference(
                id="e3e1649a-97f4-4849-bc02-d8d67eab9722", type="table"
            ),
            toEntity=EntityReference(
                id="b3f7df8e-50de-4555-a497-c7e170f4de8e", type="table"
            ),
            lineageDetails=LineageDetails(
                sqlQuery=None, columnsLineage=[], pipeline=None
            ),
        ),
    ),
    AddLineageRequest(
        edge=EntitiesEdge(
            fromEntity=EntityReference(
                id="02f020df-ef8c-4156-9d02-a2ff40b9649b", type="table"
            ),
            toEntity=EntityReference(
                id="b3f7df8e-50de-4555-a497-c7e170f4de8e", type="table"
            ),
            lineageDetails=LineageDetails(
                sqlQuery=None, columnsLineage=[], pipeline=None
            ),
        ),
    ),
    AddLineageRequest(
        edge=EntitiesEdge(
            fromEntity=EntityReference(
                id="57ba2523-5424-467f-992a-afe29dc7e23d", type="table"
            ),
            toEntity=EntityReference(
                id="a68492cc-af89-4031-8b8e-bc31f2cedcd5", type="table"
            ),
            lineageDetails=LineageDetails(
                sqlQuery=None, columnsLineage=[], pipeline=None
            ),
        ),
    ),
]

mock_pgspider_config = {
    "source": {
        "type": "pgspider-lineage",
        "serviceName": "local_pgspider1",
        "serviceConnection": {
            "config": {
                "type": "Postgres",
                "scheme": "pgspider+psycopg2",
                "username": "openmetadata_user",
                "hostPort": "localhost:4813",
                "database": "pgspider",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseLineage",
                "queryLogDuration": 1,
                "resultLimit": 10000,
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

table_entities_1 = [
    [
        Table(
            id="b3f7df8e-50de-4555-a497-c7e170f4de8e",
            name="test1",
            columns=[
                Column(
                    name="id",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1.id",
                ),
                Column(
                    name="__spd_url",
                    dataType=DataType.TEXT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1.__spd_url",
                ),
            ],
        )
    ],
    [
        Table(
            id="e3e1649a-97f4-4849-bc02-d8d67eab9722",
            name="test1__post_svr__0",
            columns=[
                Column(
                    name="id",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1__post_svr__0.id",
                )
            ],
        )
    ],
    [
        Table(
            id="02f020df-ef8c-4156-9d02-a2ff40b9649b",
            name="test1__post_svr__1",
            columns=[
                Column(
                    name="id",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1__post_svr__1.id",
                )
            ],
        )
    ],
    [
        Table(
            id="a68492cc-af89-4031-8b8e-bc31f2cedcd5",
            name="test2",
            columns=[
                Column(
                    name="a",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2.a",
                ),
                Column(
                    name="b",
                    dataType=DataType.TEXT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2.b",
                ),
                Column(
                    name="c",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2.c",
                ),
                Column(
                    name="__spd_url",
                    dataType=DataType.TEXT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2.__spd_url",
                ),
            ],
        )
    ],
    [
        Table(
            id="57ba2523-5424-467f-992a-afe29dc7e23d",
            name="test2__post_svr__0",
            columns=[
                Column(
                    name="a",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2__post_svr__0.a",
                ),
                Column(
                    name="b",
                    dataType=DataType.TEXT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2__post_svr__0.b",
                ),
                Column(
                    name="c",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2__post_svr__0.c",
                ),
            ],
        )
    ],
]

table_entities_2 = [
    [
        Table(
            id="b3f7df8e-50de-4555-a497-c7e170f4de8e",
            name="test1",
            columns=[
                Column(
                    name="id",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1.id",
                ),
                Column(
                    name="__spd_url",
                    dataType=DataType.TEXT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1.__spd_url",
                ),
            ],
        )
    ],
    [
        Table(
            id="e3e1649a-97f4-4849-bc02-d8d67eab9722",
            name="test1__post_svr__0",
            columns=[
                Column(
                    name="id",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1__post_svr__0.id",
                ),
                Column(
                    name="a",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1__post_svr__0.a",
                ),
            ],
        )
    ],
    [
        Table(
            id="02f020df-ef8c-4156-9d02-a2ff40b9649b",
            name="test1__post_svr__1",
            columns=[
                Column(
                    name="id",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1__post_svr__1.id",
                ),
                Column(
                    name="b",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1__post_svr__0.b",
                ),
            ],
        )
    ],
    [
        Table(
            id="a68492cc-af89-4031-8b8e-bc31f2cedcd5",
            name="test2",
            columns=[
                Column(
                    name="a",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2.a",
                ),
                Column(
                    name="b",
                    dataType=DataType.TEXT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2.b",
                ),
                Column(
                    name="c",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2.c",
                ),
                Column(
                    name="__spd_url",
                    dataType=DataType.TEXT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2.__spd_url",
                ),
            ],
        )
    ],
    [
        Table(
            id="57ba2523-5424-467f-992a-afe29dc7e23d",
            name="test2__post_svr__0",
            columns=[
                Column(
                    name="a",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2__post_svr__0.a",
                ),
                Column(
                    name="b",
                    dataType=DataType.TEXT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2__post_svr__0.b",
                ),
                Column(
                    name="d",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2__post_svr__0.d",
                ),
            ],
        )
    ],
]

table_entities_3 = [
    [
        Table(
            id="b3f7df8e-50de-4555-a497-c7e170f4de8e",
            name="test1",
            columns=[
                Column(
                    name="id",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1.id",
                ),
                Column(
                    name="__spd_url",
                    dataType=DataType.TEXT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1.__spd_url",
                ),
            ],
        )
    ],
    [
        Table(
            id="e3e1649a-97f4-4849-bc02-d8d67eab9722",
            name="test1__post_svr__0",
            columns=[
                Column(
                    name="a",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1__post_svr__0.a",
                )
            ],
        )
    ],
    [
        Table(
            id="02f020df-ef8c-4156-9d02-a2ff40b9649b",
            name="test1__post_svr__1",
            columns=[
                Column(
                    name="a",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test1__post_svr__1.a",
                )
            ],
        )
    ],
    [
        Table(
            id="a68492cc-af89-4031-8b8e-bc31f2cedcd5",
            name="test2",
            columns=[
                Column(
                    name="a",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2.a",
                ),
                Column(
                    name="b",
                    dataType=DataType.TEXT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2.b",
                ),
                Column(
                    name="c",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2.c",
                ),
                Column(
                    name="__spd_url",
                    dataType=DataType.TEXT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2.__spd_url",
                ),
            ],
        )
    ],
    [
        Table(
            id="57ba2523-5424-467f-992a-afe29dc7e23d",
            name="test2__post_svr__0",
            columns=[
                Column(
                    name="d",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2__post_svr__0.d",
                ),
                Column(
                    name="e",
                    dataType=DataType.TEXT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2__post_svr__0.e",
                ),
                Column(
                    name="f",
                    dataType=DataType.INT,
                    fullyQualifiedName="local_pgspider1.pgspider.public.test2__post_svr__0.f",
                ),
            ],
        )
    ],
]


class PGSpiderLineageUnitTests(TestCase):
    """
    Implements the necessary methods to extract
    PGSpider lineage test
    """

    def __init__(self, methodName) -> None:
        super().__init__(methodName)
        config = OpenMetadataWorkflowConfig.model_validate(mock_pgspider_config)
        with patch(
            "metadata.ingestion.source.database.postgres.lineage.PostgresLineageSource.test_connection"
        ):
            self.postgres = PostgresLineageSource.create(
                mock_pgspider_config["source"],
                config.workflowConfig.openMetadataServerConfig,
            )
        print(type(self.postgres))

    @patch(
        "metadata.ingestion.source.database.postgres.pgspider.lineage._get_multi_tenant_tables"
    )
    def test_next_record_1(self, multi_tenant_tables):
        """
        Verify normal case:
        There is multi-tenant table and foreign table.
        All columns (except __spd_url) of multi tenant tables and child foreign tables are matched.
        """

        """
        Mock valid values for get_multi_tenant_tables and get_child_tables
        """
        multi_tenant_tables.return_value = mock_multi_tenant_data

        with patch(
            "metadata.ingestion.source.database.postgres.pgspider.lineage.search_table_entities"
        ) as source_entities, patch(
            "metadata.ingestion.source.database.postgres.pgspider.lineage._get_child_tables"
        ) as child_tables:
            child_tables.side_effect = mock_child_data
            source_entities.side_effect = table_entities_1

            requests = []
            for record in get_lineage_from_multi_tenant_table(
                self.postgres.metadata,
                connection=self.postgres.service_connection,
                service_name=self.postgres.config.serviceName,
            ):
                if isinstance(record, AddLineageRequest):
                    requests.append(record)

            """Validate each AddLineageRequest"""
            for _, (expected, original) in enumerate(
                zip(EXPECTED_PGSPIDER_DETAILS_1, requests)
            ):
                self.assertEqual(expected, original)

    @patch(
        "metadata.ingestion.source.database.postgres.pgspider.lineage._get_multi_tenant_tables"
    )
    def test_next_record_2(self, multi_tenant_tables):
        """
        Verify normal case:
        There is multi-tenant table and foreign table.
        Some columns (not at all) of multi tenant tables and child foreign tables are matched.
        """

        """
        Mock valid values for get_multi_tenant_tables and get_child_tables
        """
        multi_tenant_tables.return_value = mock_multi_tenant_data

        with patch(
            "metadata.ingestion.source.database.postgres.pgspider.lineage.search_table_entities"
        ) as source_entities, patch(
            "metadata.ingestion.source.database.postgres.pgspider.lineage._get_child_tables"
        ) as child_tables:
            child_tables.side_effect = mock_child_data
            source_entities.side_effect = table_entities_2

            requests = []
            for record in get_lineage_from_multi_tenant_table(
                self.postgres.metadata,
                connection=self.postgres.service_connection,
                service_name=self.postgres.config.serviceName,
            ):
                if isinstance(record, AddLineageRequest):
                    requests.append(record)

            """Validate each AddLineageRequest"""
            for _, (expected, original) in enumerate(
                zip(EXPECTED_PGSPIDER_DETAILS_2, requests)
            ):
                self.assertEqual(expected, original)

    @patch(
        "metadata.ingestion.source.database.postgres.pgspider.lineage._get_multi_tenant_tables"
    )
    def test_next_record_3(self, multi_tenant_tables):
        """
        Verify normal case:
        There is multi-tenant table and foreign table.
        There is no column of multi tenant tables and child foreign tables are matched.
        """

        """
        Mock valid values for get_multi_tenant_tables and get_child_tables
        """
        multi_tenant_tables.return_value = mock_multi_tenant_data

        with patch(
            "metadata.ingestion.source.database.postgres.pgspider.lineage.search_table_entities"
        ) as source_entities, patch(
            "metadata.ingestion.source.database.postgres.pgspider.lineage._get_child_tables"
        ) as child_tables:
            child_tables.side_effect = mock_child_data
            source_entities.side_effect = table_entities_3

            requests = []
            for record in get_lineage_from_multi_tenant_table(
                self.postgres.metadata,
                connection=self.postgres.service_connection,
                service_name=self.postgres.config.serviceName,
            ):
                if isinstance(record, AddLineageRequest):
                    requests.append(record)

            """Validate each AddLineageRequest"""
            for _, (expected, original) in enumerate(
                zip(EXPECTED_PGSPIDER_DETAILS_3, requests)
            ):
                self.assertEqual(expected, original)

    @patch(
        "metadata.ingestion.source.database.postgres.pgspider.lineage._get_multi_tenant_tables"
    )
    def test_next_record_4(self, multi_tenant_tables):
        """
        Verify abnormal case:
        There is no multi-tenant.
        """

        """
        Mock valid values for get_multi_tenant_tables and get_child_tables
        """
        multi_tenant_tables.return_value = []

        with patch(
            "metadata.ingestion.source.database.postgres.pgspider.lineage.search_table_entities"
        ) as source_entities, patch(
            "metadata.ingestion.source.database.postgres.pgspider.lineage._get_child_tables"
        ) as child_tables:
            child_tables.return_value = mock_child_data
            source_entities.return_value = []

            requests = []
            for record in get_lineage_from_multi_tenant_table(
                self.postgres.metadata,
                connection=self.postgres.service_connection,
                service_name=self.postgres.config.serviceName,
            ):
                if isinstance(record, AddLineageRequest):
                    requests.append(record)

            """Validate number of AddLineageRequest"""
            self.assertEqual(0, len(requests))

    @patch(
        "metadata.ingestion.source.database.postgres.pgspider.lineage._get_multi_tenant_tables"
    )
    def test_next_record_5(self, multi_tenant_tables):
        """
        Verify abnormal case:
        There are multi-tenant tables.
        There is no corresponding child foreign tables of specified multi tenant table.
        """

        """
        Mock valid values for get_multi_tenant_tables and get_child_tables
        """
        multi_tenant_tables.return_value = mock_multi_tenant_data

        with patch(
            "metadata.ingestion.source.database.postgres.pgspider.lineage.search_table_entities"
        ) as source_entities, patch(
            "metadata.ingestion.source.database.postgres.pgspider.lineage._get_child_tables"
        ) as child_tables:
            child_tables.return_value = []

            requests = []
            for record in get_lineage_from_multi_tenant_table(
                self.postgres.metadata,
                connection=self.postgres.service_connection,
                service_name=self.postgres.config.serviceName,
            ):
                if isinstance(record, AddLineageRequest):
                    requests.append(record)

            """Validate number of AddLineageRequest"""
            self.assertEqual(0, len(requests))

    @patch(
        "metadata.ingestion.source.database.postgres.pgspider.lineage._get_multi_tenant_tables"
    )
    def test_next_record_6(self, multi_tenant_tables):
        """
        Verify abnormal case:
        There are multi tenant tables and child foreign tables in remote PGSpider.
        All multi tenant tables and child foreign tables have not been ingested into open-metadata.
        """

        """
        Mock valid values for get_multi_tenant_tables and get_child_tables
        """
        multi_tenant_tables.return_value = mock_multi_tenant_data

        with patch(
            "metadata.ingestion.source.database.postgres.pgspider.lineage.search_table_entities"
        ) as source_entities, patch(
            "metadata.ingestion.source.database.postgres.pgspider.lineage._get_child_tables"
        ) as child_tables:
            child_tables.side_effect = mock_child_data
            source_entities.return_value = []

            requests = []
            for record in get_lineage_from_multi_tenant_table(
                self.postgres.metadata,
                connection=self.postgres.service_connection,
                service_name=self.postgres.config.serviceName,
            ):
                if isinstance(record, AddLineageRequest):
                    requests.append(record)

            """Validate number of AddLineageRequest"""
            self.assertEqual(0, len(requests))
