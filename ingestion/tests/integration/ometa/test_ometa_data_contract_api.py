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
import time
import uuid
from datetime import datetime

import pytest

from metadata.generated.schema.api.data.createDataContract import (
    CreateDataContractRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
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
from metadata.generated.schema.type.basic import EntityName, Uuid
from metadata.generated.schema.type.contractExecutionStatus import (
    ContractExecutionStatus,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.status import EntityStatus


@pytest.fixture(scope="module")
def test_database(metadata, database_service):
    """Module-scoped database for data contract tests."""
    from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
    from metadata.generated.schema.entity.data.database import Database

    database_request = CreateDatabaseRequest(
        name="test-db-datacontract",
        service=database_service.fullyQualifiedName,
    )
    database = metadata.create_or_update(data=database_request)

    yield database

    metadata.delete(entity=Database, entity_id=database.id, hard_delete=True)


@pytest.fixture(scope="module")
def test_schema(metadata, test_database):
    """Module-scoped database schema for data contract tests."""
    from metadata.generated.schema.api.data.createDatabaseSchema import (
        CreateDatabaseSchemaRequest,
    )
    from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema

    schema_request = CreateDatabaseSchemaRequest(
        name="test-schema-datacontract",
        database=test_database.fullyQualifiedName,
    )
    schema = metadata.create_or_update(data=schema_request)

    yield schema

    metadata.delete(
        entity=DatabaseSchema, entity_id=schema.id, recursive=True, hard_delete=True
    )


@pytest.fixture(scope="module")
def test_table(metadata, test_schema):
    """Module-scoped table for data contract tests."""
    table_request = CreateTableRequest(
        name="test-table-datacontract",
        databaseSchema=test_schema.fullyQualifiedName,
        columns=[
            Column(name="id", dataType=DataType.BIGINT),
            Column(name="name", dataType=DataType.STRING),
        ],
    )
    table = metadata.create_or_update(data=table_request)

    yield table

    metadata.delete(entity=Table, entity_id=table.id, hard_delete=True)


@pytest.fixture
def data_contract_request(test_table):
    """Create data contract request."""
    return CreateDataContractRequest(
        name=EntityName(root="TestDataContract"),
        description="Test data contract for validation",
        entity=EntityReference(id=test_table.id, type="table"),
        entityStatus=EntityStatus.Draft,
        schema=test_table.columns[:2],
    )


class TestOMetaDataContractAPI:
    """
    Data Contract API integration tests.
    Tests CRUD operations, execution results, and status updates.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - database_service: DatabaseService (module scope)
    """

    def test_create_data_contract(self, metadata, test_table, data_contract_request):
        """
        We can create a DataContract and we receive it back as Entity
        """
        res = metadata.create_or_update(data=data_contract_request)

        assert res.name == data_contract_request.name
        assert res.description == data_contract_request.description
        assert res.entityStatus == data_contract_request.entityStatus
        assert res.entity.id == test_table.id
        assert res.entity.type == "table"
        assert len(res.schema_) == 2

        metadata.delete(entity=DataContract, entity_id=res.id, hard_delete=True)

    def test_get_data_contract_by_name(self, metadata, data_contract_request):
        """
        We can fetch DataContract by name
        """
        contract = metadata.create_or_update(data=data_contract_request)

        res = metadata.get_by_name(
            entity=DataContract, fqn=contract.fullyQualifiedName.root
        )
        assert res.name == data_contract_request.name
        assert res.description == data_contract_request.description
        assert res.entityStatus == data_contract_request.entityStatus

        metadata.delete(entity=DataContract, entity_id=res.id, hard_delete=True)

    def test_get_data_contract_by_id(self, metadata, data_contract_request):
        """
        We can fetch DataContract by ID
        """
        created_contract = metadata.create_or_update(data=data_contract_request)

        res = metadata.get_by_id(entity=DataContract, entity_id=created_contract.id)
        assert res.name == data_contract_request.name
        assert res.id == created_contract.id
        assert res.entityStatus == data_contract_request.entityStatus

        metadata.delete(entity=DataContract, entity_id=res.id, hard_delete=True)

    def test_put_data_contract_result(self, metadata, data_contract_request):
        """
        We can create and store DataContract execution results
        """
        created_contract = metadata.create_or_update(data=data_contract_request)

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

        result = metadata.put_data_contract_result(created_contract.id, contract_result)

        assert result is not None
        assert result.contractExecutionStatus == ContractExecutionStatus.Success

        latest_result = metadata.get_latest_data_contract_result(created_contract.id)
        assert latest_result is not None
        assert latest_result.contractExecutionStatus == ContractExecutionStatus.Success

        # Retry logic for eventual consistency - backend may take time to index results
        all_results = None
        for attempt in range(5):
            all_results = metadata.get_data_contract_results(created_contract.id)
            if all_results and len(all_results) >= 1:
                break
            time.sleep(0.5)  # Wait 500ms before retry

        assert all_results is not None
        assert len(all_results) >= 1

        metadata.delete(
            entity=DataContract, entity_id=created_contract.id, hard_delete=True
        )

    def test_update_data_contract_status(
        self, metadata, test_table, data_contract_request
    ):
        """
        We can update DataContract status
        """
        created_contract = metadata.create_or_update(data=data_contract_request)
        assert created_contract.entityStatus == EntityStatus.Draft

        updated_request = CreateDataContractRequest(
            name=data_contract_request.name,
            description=data_contract_request.description,
            entity=data_contract_request.entity,
            entityStatus=EntityStatus.Approved,
            schema=data_contract_request.schema_,
        )

        updated_contract = metadata.create_or_update(data=updated_request)
        assert updated_contract.entityStatus == EntityStatus.Approved
        assert updated_contract.id == created_contract.id

        metadata.delete(
            entity=DataContract, entity_id=updated_contract.id, hard_delete=True
        )
