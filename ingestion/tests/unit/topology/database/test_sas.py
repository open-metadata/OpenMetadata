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
Test SAS using the topology
"""
import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from pydantic import AnyUrl

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
from metadata.generated.schema.entity.services.connections.database.sasConnection import (
    SASConnection,
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
from metadata.generated.schema.type.basic import EntityExtension, Href
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.sas.client import SASClient
from metadata.ingestion.source.database.sas.metadata import SasSource

mock_sas_config = {
    "source": {
        "type": "sas",
        "serviceName": "local_sas",
        "serviceConnection": {
            "config": {
                "type": "SAS",
                "serverHost": "http://your-server-host.org",
                "username": "username",
                "password": "password",
                "datatables": True,
                "dataTablesCustomFilter": None,
                "reports": False,
                "reportsCustomFilter": None,
                "dataflows": False,
                "dataflowsCustomFilter": None,
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

mock_search_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/sas_dataset_search.json"
)
mock_view_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/sas_dataset_view.json"
)
with open(mock_search_path, encoding="UTF-8") as search_file:
    mock_search: dict = json.load(search_file)

with open(mock_view_path, encoding="UTF-8") as view_file:
    mock_view: dict = json.load(view_file)


def mock_list_assets(self, table):  # pylint: disable=unused-argument
    return mock_search


def mock_access_token(
    self, base_url, user, password
):  # pylint: disable=unused-argument
    return "access_token"


def mock_get_views(self, query):  # pylint: disable=unused-argument
    return mock_view


EXPECTED_TABLE = Table(
    id="0063116c-577c-0f44-8116-3924506c8f4a",
    name="WATER_CLUSTER.sashdat",
    displayName=None,
    fullyQualifiedName="cas.cas-shared-default.Samples.WATER_CLUSTER.sashdat",
    description='Last analyzed: <b>2023-12-20T20:52:01.453Z</b>. Visit <a target="_blank" '
    'href="http://your-server-host.org/SASInformationCatalog/details/~fs~catalog~fs~instances~fs'
    '~0063116c-577c-0f44-8116-3924506c8f4a">SAS Information Catalog</a> for more information.',
    version=0.1,
    updatedAt=1703105517347,
    updatedBy="admin",
    href=Href(
        root=AnyUrl(
            "http://localhost:8585/api/v1/tables/124d078d-dcf2-43a8-b59e-33bc7953f680",
        )
    ),
    tableType="Regular",
    columns=[
        Column(
            name="Address",
            displayName=None,
            dataType="STRING",
            arrayDataType=None,
            dataLength=1,
            precision=None,
            scale=None,
            dataTypeDisplay="string",
            description="",
            fullyQualifiedName="cas.cas-shared-default.Samples.WATER_CLUSTER.sashdat.Address",
            tags=None,
            constraint=None,
            ordinalPosition=None,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
        Column(
            name="Address",
            displayName=None,
            dataType="STRING",
            arrayDataType=None,
            dataLength=1,
            precision=None,
            scale=None,
            dataTypeDisplay="string",
            description="",
            fullyQualifiedName="cas.cas-shared-default.Samples.WATER_CLUSTER.sashdat.US%20Holidaty",
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
    owners=None,
    databaseSchema=EntityReference(
        id="4cf6ee7e-9d24-4153-9318-82aa1167259b",
        type="databaseSchema",
        name="Samples",
        fullyQualifiedName="cas.cas-shared-default.Samples",
        description="",
        displayName=None,
        deleted=False,
        href=Href(
            AnyUrl(
                "http://localhost:8585/api/v1/databaseSchemas/4cf6ee7e-9d24-4153-9318-82aa1167259b",
            )
        ),
    ),
    database=EntityReference(
        id="367f53b5-d6c2-44be-bf5d-a0a1dc98a9dd",
        type="database",
        name="Samples",
        fullyQualifiedName="cas.cas-shared-default",
        description="",
        displayName=None,
        deleted=False,
        href=Href(
            AnyUrl(
                "http://localhost:8585/api/v1/databases/367f53b5-d6c2-44be-bf5d-a0a1dc98a9dd",
            )
        ),
    ),
    service=EntityReference(
        id="f2ab0e7a-5224-4acb-a189-74158851733f",
        type="databaseService",
        name="cas",
        fullyQualifiedName="cas",
        description=None,
        displayName=None,
        deleted=False,
        href=Href(
            AnyUrl(
                "http://localhost:8585/api/v1/services/databaseServices/f2ab0e7a-5224-4acb-a189-74158851733f",
            )
        ),
    ),
    serviceType="SAS",
    location=None,
    schemaDefinition=None,
    usageSummary=None,
    followers=None,
    joins=None,
    sampleData=None,
    tableProfilerConfig=None,
    profile=None,
    dataModel=None,
    changeDescription=None,
    deleted=False,
    extension=EntityExtension(
        root={
            "analysisTimeStamp": "2023-12-20T20:52:01.453Z",
            "columnCount": 21,
            "completenessPercent": 95,
            "creator": "sas",
            "dataSize": 10091520,
            "dateCreated": "2023-12-20T08:28:18.000Z",
            "dateModified": "2023-12-20T08:28:18.500Z",
            "rowCount": 46720,
        }
    ),
)


class SASUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    SAS Metadata Unit Test
    """

    @patch("metadata.ingestion.source.database.sas.metadata.SasSource.test_connection")
    @patch.object(SASClient, "get_token", mock_access_token)
    def __init__(self, method_name, test_connection) -> None:
        super().__init__(method_name)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_sas_config)
        self.sas_source = SasSource.create(
            mock_sas_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.metadata = OpenMetadata(
            OpenMetadataConnection.model_validate(
                mock_sas_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )

        config_ = mock_sas_config["source"]["serviceConnection"]["config"]
        self.database_service = (
            mock_database_service_object
        ) = self.metadata.create_or_update(
            CreateDatabaseServiceRequest(
                name="local_sas",
                serviceType="SAS",
                connection=DatabaseConnection(
                    config=SASConnection(
                        type=config_["type"],
                        username=config_["username"],
                        password=config_["password"],
                        serverHost=config_["serverHost"],
                        datatables=config_["datatables"],
                        dataTablesCustomFilter=config_["dataTablesCustomFilter"],
                        reports=config_["reports"],
                        reportsCustomFilter=config_["reportsCustomFilter"],
                        dataflows=config_["dataflows"],
                        dataflowsCustomFilter=config_["dataflowsCustomFilter"],
                    )
                ),
            )
        )

        mock_database_object = self.metadata.create_or_update(
            CreateDatabaseRequest(
                name="cas.cas-shared-default",
                displayName=None,
                description=None,
                tags=None,
                owners=None,
                service=mock_database_service_object.fullyQualifiedName,
            )
        )
        mock_database_schema_object = self.metadata.create_or_update(
            CreateDatabaseSchemaRequest(
                name="Samples",
                database=mock_database_object.fullyQualifiedName,
            )
        )
        _ = self.metadata.create_or_update(
            CreateTableRequest(
                name="WATER_CLUSTER.sashdat",
                tableType="Regular",
                columns=[
                    Column(
                        name="Address",
                        displayName=None,
                        dataType="STRING",
                        arrayDataType=None,
                        dataLength=1,
                        precision=None,
                        scale=None,
                        dataTypeDisplay="string",
                        description="",
                        fullyQualifiedName=f"{mock_database_schema_object.fullyQualifiedName}"
                        f'."WATER_CLUSTER.sashdat".Address',
                        tags=None,
                        constraint=None,
                        ordinalPosition=None,
                        jsonSchema=None,
                        children=None,
                        customMetrics=None,
                        profile=None,
                    ),
                    Column(
                        name="US Holiday",
                        displayName=None,
                        dataType="STRING",
                        arrayDataType=None,
                        dataLength=1,
                        precision=None,
                        scale=None,
                        dataTypeDisplay="string",
                        description="",
                        fullyQualifiedName=f"{mock_database_schema_object.fullyQualifiedName}"
                        f'."WATER_CLUSTER.sashdat".US%20Holiday',
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
                sourceUrl="None",
            )
        )

    @patch.object(SASClient, "list_assets", mock_list_assets)
    @patch.object(SASClient, "get_views", mock_get_views)
    def test_loaded_context(self):
        """
        Testing description updated for database, databaseSchema, table
        """
        _ = list(self.sas_source._iter())
        loaded_database = self.metadata.get_by_name(
            entity=Database, fqn='local_sas."cas.cas-shared-default"'
        )

        assert loaded_database
        assert loaded_database.name.root == "cas.cas-shared-default"

        loaded_database_schema = self.metadata.get_by_name(
            entity=DatabaseSchema, fqn='local_sas."cas.cas-shared-default".Samples'
        )

        assert loaded_database_schema
        assert loaded_database_schema.name.root == "Samples"

        loaded_table = self.metadata.get_by_name(
            entity=Table,
            fqn='local_sas."cas.cas-shared-default".Samples."WATER_CLUSTER.sashdat"',
            fields=["extension"],
        )

        assert loaded_table
        assert loaded_table.description == EXPECTED_TABLE.description
        assert loaded_table.extension == EXPECTED_TABLE.extension

        # clean up added database service connector
        self.metadata.delete(
            entity=DatabaseService,
            entity_id=self.database_service.id,
            recursive=True,
            hard_delete=True,
        )
