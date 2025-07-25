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
OpenMetadata high-level API DataContract test
"""
import uuid
from datetime import datetime
from unittest import TestCase

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createDataContract import (
    CreateDataContractRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.dataContract import (
    ContractStatus,
    DataContract,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.datacontract.dataContractResult import (
    DataContractResult,
)
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
from metadata.generated.schema.type.basic import EntityName, Uuid
from metadata.generated.schema.type.contractExecutionStatus import (
    ContractExecutionStatus,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaDataContractTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    user = metadata.create_or_update(
        data=CreateUserRequest(name="data-contract-user", email="datacontract@user.com"),
    )
    owners = EntityReferenceList(root=[EntityReference(id=user.id, type="user")])

    service = CreateDatabaseServiceRequest(
        name="test-service-data-contract",
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="username",
                authType=BasicAuth(password="password"),
                hostPort="http://localhost:3306",
            )
        ),
    )

    create_data_contract = CreateDataContractRequest(
        name=EntityName(root="TestDataContract"),
        description="Test data contract for validation",
        entity=EntityReference(id=None, type="table"),  # Will be set in setUpClass
        status=ContractStatus.Draft,
        dataContractSchema=[
            {
                "name": "id",
                "dataType": "BIGINT",
                "required": True,
                "description": "Primary key identifier",
            },
            {
                "name": "name",
                "dataType": "STRING",
                "required": True,
                "description": "Entity name",
            },
        ],
    )

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients - create database service, database, schema, and table
        """
        # Create Database Service
        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        # Create Database
        create_db = CreateDatabaseRequest(
            name="test-db-datacontract",
            service=cls.service_entity.fullyQualifiedName,
        )
        cls.create_db_entity = cls.metadata.create_or_update(data=create_db)

        # Create Database Schema
        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema-datacontract",
            database=cls.create_db_entity.fullyQualifiedName,
        )
        cls.create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        # Create Table
        cls.table_entity = cls.metadata.create_or_update(
            CreateTableRequest(
                name="test-table-datacontract",
                databaseSchema=cls.create_schema_entity.fullyQualifiedName,
                columns=[
                    Column(name="id", dataType=DataType.BIGINT),
                    Column(name="name", dataType=DataType.STRING),
                ],
            )
        )

        # Update the data contract request with the actual table reference
        cls.create_data_contract.entity = EntityReference(
            id=cls.table_entity.id, type="table"
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up - delete service recursively to clean up all child entities
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

    def test_create_data_contract(self):
        """
        We can create a DataContract and we receive it back as Entity
        """
        res: DataContract = self.metadata.create_or_update(data=self.create_data_contract)
        self.assertEqual(res.name, self.create_data_contract.name)
        self.assertEqual(res.description, self.create_data_contract.description)
        self.assertEqual(res.status, self.create_data_contract.status)
        self.assertEqual(res.entity.id, self.table_entity.id)
        self.assertEqual(res.entity.type, "table")
        self.assertEqual(len(res.dataContractSchema), 2)

    def test_get_data_contract_by_name(self):
        """We can fetch DataContract by name"""
        self.metadata.create_or_update(data=self.create_data_contract)

        res: DataContract = self.metadata.get_by_name(
            entity=DataContract, fqn=self.create_data_contract.name.root
        )
        self.assertEqual(res.name, self.create_data_contract.name)
        self.assertEqual(res.description, self.create_data_contract.description)
        self.assertEqual(res.status, self.create_data_contract.status)

    def test_get_data_contract_by_id(self):
        """We can fetch DataContract by ID"""
        created_contract: DataContract = self.metadata.create_or_update(
            data=self.create_data_contract
        )

        res: DataContract = self.metadata.get_by_id(
            entity=DataContract, entity_id=created_contract.id
        )
        self.assertEqual(res.name, self.create_data_contract.name)
        self.assertEqual(res.id, created_contract.id)
        self.assertEqual(res.status, self.create_data_contract.status)

    def test_put_data_contract_result(self):
        """We can create and store DataContract execution results"""
        # First create the data contract
        created_contract: DataContract = self.metadata.create_or_update(
            data=self.create_data_contract
        )

        # Create a data contract result
        contract_result = DataContractResult(
            id=Uuid(root=uuid.uuid4()),
            timestamp=int(datetime.now().timestamp() * 1000),
            dataContract=EntityReference(id=created_contract.id, type="dataContract"),
            status=ContractExecutionStatus.Success,
            executedBy="test-user",
            validationResults={
                "schemaValidation": {
                    "status": "Success",
                    "passedCount": 2,
                    "failedCount": 0,
                    "totalCount": 2,
                },
                "qualityValidation": {
                    "status": "Success", 
                    "passedCount": 0,
                    "failedCount": 0,
                    "totalCount": 0,
                },
            },
        )

        # Store the result using the mixin method
        result = self.metadata.put_data_contract_result(
            contract_result.dataContract.id, contract_result
        )
        
        self.assertIsNotNone(result)
        self.assertEqual(result.status, ContractExecutionStatus.Success)
        self.assertEqual(result.executedBy, "test-user")

        # Verify we can get the latest result
        latest_result = self.metadata.get_latest_data_contract_result(
            created_contract.id
        )
        self.assertIsNotNone(latest_result)
        self.assertEqual(latest_result.status, ContractExecutionStatus.Success)

        # Verify we can get all results
        all_results = self.metadata.get_data_contract_results(created_contract.id)
        self.assertIsNotNone(all_results)
        self.assertGreaterEqual(len(all_results), 1)

    def test_update_data_contract_status(self):
        """We can update DataContract status"""
        # Create data contract in Draft status
        created_contract: DataContract = self.metadata.create_or_update(
            data=self.create_data_contract
        )
        self.assertEqual(created_contract.status, ContractStatus.Draft)

        # Update to Active status
        updated_request = CreateDataContractRequest(
            name=self.create_data_contract.name,
            description=self.create_data_contract.description,
            entity=self.create_data_contract.entity,
            status=ContractStatus.Active,
            dataContractSchema=self.create_data_contract.dataContractSchema,
        )

        updated_contract: DataContract = self.metadata.create_or_update(
            data=updated_request
        )
        self.assertEqual(updated_contract.status, ContractStatus.Active)
        self.assertEqual(updated_contract.id, created_contract.id)