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

from _openmetadata_testutils.ometa import OM_JWT
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
from metadata.generated.schema.entity.data.dataContract import DataContract
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.datacontract.dataContractResult import (
    DataContractResult,
)
from metadata.generated.schema.entity.datacontract.qualityValidation import (
    QualityValidation,
)
from metadata.generated.schema.entity.datacontract.schemaValidation import (
    SchemaValidation,
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
from metadata.generated.schema.type.status import EntityStatus
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
            jwtToken=OM_JWT,
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()
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
        cls.table_entity: Table = cls.metadata.create_or_update(
            CreateTableRequest(
                name="test-table-datacontract",
                databaseSchema=cls.create_schema_entity.fullyQualifiedName,
                columns=[
                    Column(name="id", dataType=DataType.BIGINT),
                    Column(name="name", dataType=DataType.STRING),
                ],
            )
        )

        cls.create_data_contract = CreateDataContractRequest(
            name=EntityName(root="TestDataContract"),
            description="Test data contract for validation",
            entity=EntityReference(
                id=cls.table_entity.id, type="table"
            ),  # Will be set in setUpClass
            entityStatus=EntityStatus.Draft,
            schema=cls.table_entity.columns[:2],
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
        res: DataContract = self.metadata.create_or_update(
            data=self.create_data_contract
        )
        self.assertEqual(res.name, self.create_data_contract.name)
        self.assertEqual(res.description, self.create_data_contract.description)
        self.assertEqual(res.status, self.create_data_contract.status)
        self.assertEqual(res.entity.id, self.table_entity.id)
        self.assertEqual(res.entity.type, "table")
        self.assertEqual(len(res.schema_), 2)

    def test_get_data_contract_by_name(self):
        """We can fetch DataContract by name"""
        contract: DataContract = self.metadata.create_or_update(
            data=self.create_data_contract
        )

        res: DataContract = self.metadata.get_by_name(
            entity=DataContract, fqn=contract.fullyQualifiedName.root
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
            dataContractFQN=created_contract.fullyQualifiedName,
            timestamp=int(datetime.now().timestamp() * 1000),
            contractExecutionStatus=ContractExecutionStatus.Success,
            schemaValidation=SchemaValidation(
                passed=2,
                failed=0,
                total=2,
            ),
            qualityValidation=QualityValidation(
                passed=0,
                failed=0,
                total=0,
            ),
        )

        # Store the result using the mixin method
        result = self.metadata.put_data_contract_result(
            created_contract.id, contract_result
        )

        self.assertIsNotNone(result)
        self.assertEqual(
            result.contractExecutionStatus, ContractExecutionStatus.Success
        )

        # Verify we can get the latest result
        latest_result = self.metadata.get_latest_data_contract_result(
            created_contract.id
        )
        self.assertIsNotNone(latest_result)
        self.assertEqual(
            latest_result.contractExecutionStatus, ContractExecutionStatus.Success
        )

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
        self.assertEqual(created_contract.entityStatus, EntityStatus.Draft)

        # Update to Active status
        updated_request = CreateDataContractRequest(
            name=self.create_data_contract.name,
            description=self.create_data_contract.description,
            entity=self.create_data_contract.entity,
            entityStatus=EntityStatus.Approved,
            schema=self.create_data_contract.schema_,
        )

        updated_contract: DataContract = self.metadata.create_or_update(
            data=updated_request
        )
        self.assertEqual(updated_contract.entityStatus, EntityStatus.Approved)
        self.assertEqual(updated_contract.id, created_contract.id)
