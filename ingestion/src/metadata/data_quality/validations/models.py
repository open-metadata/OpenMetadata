"""Models for the TableDiff test case"""

from typing import List, Optional, Union

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.table import (
    Column,
    Table,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.ingestion.models.custom_pydantic import CustomSecretStr


class TableParameter(BaseModel):
    serviceUrl: Union[str, dict]
    path: str
    fullyQualifiedName: Optional[str] = None
    columns: List[Column]
    database_service_type: DatabaseServiceType
    privateKey: Optional[CustomSecretStr]
    passPhrase: Optional[CustomSecretStr]
    key_columns: Optional[list[str]] = None
    extra_columns: Optional[list[str]] = None


class TableDiffRuntimeParameters(BaseModel):
    table1: TableParameter
    table2: TableParameter
    keyColumns: Optional[List[str]] = Field(
        ..., deprecated="Please use `tableX.key_columns` instead"
    )
    extraColumns: Optional[List[str]] = Field(
        ..., deprecated="Please use `tableX.extra_columns` instead"
    )
    whereClause: Optional[str]
    table_profile_config: Optional[TableProfilerConfig]


class TableCustomSQLQueryRuntimeParameters(BaseModel):
    conn_config: DatabaseConnection
    entity: Table


class RuleLibrarySqlExpressionRuntimeParameters(BaseModel):
    conn_config: DatabaseConnection
    test_definition: TestDefinition
