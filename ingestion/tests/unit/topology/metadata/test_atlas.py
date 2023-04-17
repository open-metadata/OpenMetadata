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
Test Atlas using the topology
"""
import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from pydantic import AnyUrl

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import Href
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.metadata.atlas.client import AtlasClient
from metadata.ingestion.source.metadata.atlas.metadata import AtlasSource

mock_atlas_config = {
    "source": {
        "type": "Atlas",
        "serviceName": "local_atlas",
        "serviceConnection": {
            "config": {
                "type": "Atlas",
                "hostPort": "http://192.168.1.8:21000",
                "username": "username",
                "password": "password",
                "databaseServiceName": ["hive"],
                "messagingServiceName": [],
                "entity_type": "NotTable",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
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


mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/atlas_dataset.json"
)
with open(mock_file_path, encoding="UTF-8") as file:
    mock_data: dict = json.load(file)


LIST_ENTITIES = [
    "b233b2ae-8a4a-44a3-b446-4027462b2cc6",
    "eff274ef-f84d-4c58-81d6-c309663b887d",
    "1697e9bc-2fb0-4d11-8294-7e0da9c74830",
    "aabdc6c0-96c1-451c-98b5-7a7e48c319be",
]


def mock_get_entity(self, table):  # pylint: disable=unused-argument
    return mock_data


def mock_list_entities(self):  # pylint: disable=unused-argument
    return LIST_ENTITIES


EXPECTED_DATABASE_DESCRIPTION = "THIS IS TEST_DESCRIPTION FOR DATABASE"

EXPTECTED_DATABASE_SCHEMA_DESCRIPTION = "THIS IS TEST_DESCRIPTION FOR DATABASE"

EXPTECTED_TABLE = Table(
    id="124d078d-dcf2-43a8-b59e-33bc7953f680",
    name="delta_test_table",
    displayName=None,
    fullyQualifiedName="hive.Reporting.Reporting.delta_test_table",
    description="sales fact daily materialized view",
    version=0.1,
    updatedAt=1673413042524,
    updatedBy="admin",
    href=Href(
        __root__=AnyUrl(
            "http://localhost:8585/api/v1/tables/124d078d-dcf2-43a8-b59e-33bc7953f680",
            scheme="http",
            host="localhost",
            host_type="int_domain",
            port="8585",
            path="/api/v1/tables/124d078d-dcf2-43a8-b59e-33bc7953f680",
        )
    ),
    tableType="Regular",
    columns=[
        Column(
            name="col2",
            displayName=None,
            dataType="STRUCT",
            arrayDataType=None,
            dataLength=1,
            precision=None,
            scale=None,
            dataTypeDisplay="struct<col3:string,col4:bigint>",
            description="col2 nested delta column",
            fullyQualifiedName="hive.Reporting.Reporting.delta_test_table.col2",
            tags=None,
            constraint=None,
            ordinalPosition=None,
            jsonSchema=None,
            children=[
                Column(
                    name="col3",
                    displayName=None,
                    dataType="STRING",
                    arrayDataType=None,
                    dataLength=None,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="string",
                    description=None,
                    fullyQualifiedName="hive.Reporting.Reporting.delta_test_table.col2.col3",
                    tags=None,
                    constraint=None,
                    ordinalPosition=None,
                    jsonSchema=None,
                    children=None,
                    customMetrics=None,
                    profile=None,
                ),
                Column(
                    name="col4",
                    displayName=None,
                    dataType="BIGINT",
                    arrayDataType=None,
                    dataLength=None,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="bigint",
                    description=None,
                    fullyQualifiedName="hive.Reporting.Reporting.delta_test_table.col2.col4",
                    tags=None,
                    constraint=None,
                    ordinalPosition=None,
                    jsonSchema=None,
                    children=None,
                    customMetrics=None,
                    profile=None,
                ),
            ],
            customMetrics=None,
            profile=None,
        ),
        Column(
            name="col1",
            displayName=None,
            dataType="BIGINT",
            arrayDataType=None,
            dataLength=1,
            precision=None,
            scale=None,
            dataTypeDisplay="bigint",
            description="col1 description",
            fullyQualifiedName="hive.Reporting.Reporting.delta_test_table.col1",
            tags=None,
            constraint=None,
            ordinalPosition=None,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
    ],
    tableConstraints=None,
    tablePartition=None,
    owner=None,
    databaseSchema=EntityReference(
        id="4cf6ee7e-9d24-4153-9318-82aa1167259b",
        type="databaseSchema",
        name="Reporting",
        fullyQualifiedName="hive.Reporting.Reporting",
        description="THIS IS TEST_DESCRIPTION FOR DATABASE",
        displayName=None,
        deleted=False,
        href=Href(
            __root__=AnyUrl(
                "http://localhost:8585/api/v1/databaseSchemas/4cf6ee7e-9d24-4153-9318-82aa1167259b",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/databaseSchemas/4cf6ee7e-9d24-4153-9318-82aa1167259b",
            )
        ),
    ),
    database=EntityReference(
        id="367f53b5-d6c2-44be-bf5d-a0a1dc98a9dd",
        type="database",
        name="Reporting",
        fullyQualifiedName="hive.Reporting",
        description="THIS IS TEST_DESCRIPTION FOR DATABASE",
        displayName=None,
        deleted=False,
        href=Href(
            __root__=AnyUrl(
                "http://localhost:8585/api/v1/databases/367f53b5-d6c2-44be-bf5d-a0a1dc98a9dd",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/databases/367f53b5-d6c2-44be-bf5d-a0a1dc98a9dd",
            )
        ),
    ),
    service=EntityReference(
        id="f2ab0e7a-5224-4acb-a189-74158851733f",
        type="databaseService",
        name="hive",
        fullyQualifiedName="hive",
        description=None,
        displayName=None,
        deleted=False,
        href=Href(
            __root__=AnyUrl(
                "http://localhost:8585/api/v1/services/databaseServices/f2ab0e7a-5224-4acb-a189-74158851733f",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/services/databaseServices/f2ab0e7a-5224-4acb-a189-74158851733f",
            )
        ),
    ),
    serviceType="Hive",
    location=None,
    viewDefinition=None,
    tags=[
        TagLabel(
            tagFQN="AtlasMetadata.atlas_table",
            description="test tag",
            source="Classification",
            labelType="Automated",
            state="Confirmed",
            href=None,
        )
    ],
    usageSummary=None,
    followers=None,
    joins=None,
    sampleData=None,
    tableProfilerConfig=None,
    profile=None,
    dataModel=None,
    changeDescription=None,
    deleted=False,
    extension=None,
)


class AtlasUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Atlas Metadata Unit Test
    """

    @patch(
        "metadata.ingestion.source.metadata.atlas.metadata.AtlasSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_atlas_config)
        self.atlas_source = AtlasSource.create(
            mock_atlas_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.metadata = OpenMetadata(
            OpenMetadataConnection.parse_obj(
                mock_atlas_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )

        self.database_service = (
            mock_database_service_object
        ) = self.metadata.create_or_update(
            CreateDatabaseServiceRequest(
                name="hive",
                serviceType="Hive",
                connection=DatabaseConnection(
                    config=HiveConnection(
                        type="Hive",
                        scheme="hive",
                        username=None,
                        password=None,
                        hostPort="http://nohost:6000",
                    )
                ),
            )
        )

        mock_database_object = self.metadata.create_or_update(
            CreateDatabaseRequest(
                name="Reporting",
                displayName=None,
                description=None,
                tags=None,
                owner=None,
                service=mock_database_service_object.fullyQualifiedName,
            )
        )
        mock_database_schema_object = self.metadata.create_or_update(
            CreateDatabaseSchemaRequest(
                name="Reporting",
                database=mock_database_object.fullyQualifiedName,
            )
        )
        _ = self.metadata.create_or_update(
            CreateTableRequest(
                name="sales_fact_daily_mv",
                tableType="Regular",
                columns=[
                    Column(
                        name="col2",
                        displayName=None,
                        dataType="STRUCT",
                        arrayDataType=None,
                        dataLength=1,
                        precision=None,
                        scale=None,
                        dataTypeDisplay="struct<col3:string,col4:bigint>",
                        description="col2 nested delta column",
                        fullyQualifiedName="delta.default.test_schema.delta_test_table.col2",
                        tags=None,
                        constraint=None,
                        ordinalPosition=None,
                        jsonSchema=None,
                        children=[
                            Column(
                                name="col3",
                                displayName=None,
                                dataType="STRING",
                                arrayDataType=None,
                                dataLength=None,
                                precision=None,
                                scale=None,
                                dataTypeDisplay="string",
                                description=None,
                                fullyQualifiedName="delta.default.test_schema.delta_test_table.col2.col3",
                                tags=None,
                                constraint=None,
                                ordinalPosition=None,
                                jsonSchema=None,
                                children=None,
                                customMetrics=None,
                                profile=None,
                            ),
                            Column(
                                name="col4",
                                displayName=None,
                                dataType="BIGINT",
                                arrayDataType=None,
                                dataLength=None,
                                precision=None,
                                scale=None,
                                dataTypeDisplay="bigint",
                                description=None,
                                fullyQualifiedName="delta.default.test_schema.delta_test_table.col2.col4",
                                tags=None,
                                constraint=None,
                                ordinalPosition=None,
                                jsonSchema=None,
                                children=None,
                                customMetrics=None,
                                profile=None,
                            ),
                        ],
                        customMetrics=None,
                        profile=None,
                    ),
                    Column(
                        name="col1",
                        displayName=None,
                        dataType="BIGINT",
                        arrayDataType=None,
                        dataLength=1,
                        precision=None,
                        scale=None,
                        dataTypeDisplay="bigint",
                        description="col1 description",
                        fullyQualifiedName="delta.default.test_schema.delta_test_table.col1",
                        tags=None,
                        constraint=None,
                        ordinalPosition=None,
                        jsonSchema=None,
                        children=None,
                        customMetrics=None,
                        profile=None,
                    ),
                ],
                databaseSchema=mock_database_schema_object.fullyQualifiedName,
            ),
        )

    def mock_ingest_lineage(self, source_guid, name):  # pylint: disable=unused-argument
        return []

    def mock_create_tag(self):
        classification = CreateClassificationRequest(
            description="test tag", name="AtlasMetadata"
        )

        self.metadata.create_or_update(classification)
        self.metadata.create_or_update(
            CreateTagRequest(
                classification="AtlasMetadata",
                name="atlas_table",
                description="test tag",
            )
        )

    @patch.object(AtlasClient, "list_entities", mock_list_entities)
    @patch.object(AtlasClient, "get_entity", mock_get_entity)
    @patch.object(AtlasSource, "ingest_lineage", mock_ingest_lineage)
    @patch.object(AtlasSource, "create_tag", mock_create_tag)
    def test_description(self):
        """
        Testing description updated for database, databaseSchema, table
        """
        _ = list(self.atlas_source.next_record())
        updated_database = self.metadata.get_by_name(
            entity=Database, fqn="hive.Reporting"
        )
        assert updated_database.description.__root__ == EXPECTED_DATABASE_DESCRIPTION

        updated_database_schema = self.metadata.get_by_name(
            entity=DatabaseSchema, fqn="hive.Reporting.Reporting"
        )
        assert (
            updated_database_schema.description.__root__
            == EXPTECTED_DATABASE_SCHEMA_DESCRIPTION
        )

        updated_table = self.metadata.get_by_name(
            entity=Table,
            fqn="hive.Reporting.Reporting.sales_fact_daily_mv",
            fields=["tags"],
        )

        assert updated_table.description == EXPTECTED_TABLE.description

        assert updated_table.tags == EXPTECTED_TABLE.tags

        self.metadata.delete(
            entity=DatabaseService,
            entity_id=self.atlas_source.service.id,
            recursive=True,
            hard_delete=True,
        )
