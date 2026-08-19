"""Models for the TableDiff test case"""

from typing import List, Optional, Union  # noqa: UP035

from pydantic import BaseModel, Field
from sqlalchemy.engine import make_url

from metadata.data_quality.validations.utils import render_url_for_data_diff
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
    serviceUrl: Union[str, dict]  # noqa: N815, UP007
    path: str
    fullyQualifiedName: Optional[str] = None  # noqa: N815, UP045
    columns: List[Column]  # noqa: UP006
    database_service_type: DatabaseServiceType
    privateKey: Optional[CustomSecretStr]  # noqa: N815, UP045
    passPhrase: Optional[CustomSecretStr]  # noqa: N815, UP045
    key_columns: Optional[list[str]] = None  # noqa: UP045
    extra_columns: Optional[list[str]] = None  # noqa: UP045

    @property
    def data_diff_service_url(self) -> Union[str, dict]:  # noqa: UP007
        """`serviceUrl` rendered for data-diff's own URI parser.

        `serviceUrl` is a canonical SQLAlchemy URL, which encodes more than data-diff decodes.
        Connection dicts are passed through: data-diff reads their values verbatim.
        """
        if isinstance(self.serviceUrl, dict):
            return self.serviceUrl
        return render_url_for_data_diff(make_url(self.serviceUrl))


class TableDiffRuntimeParameters(BaseModel):
    table1: TableParameter
    table2: TableParameter
    keyColumns: Optional[List[str]] = Field(..., deprecated="Please use `tableX.key_columns` instead")  # noqa: N815, UP006, UP045
    extraColumns: Optional[List[str]] = Field(..., deprecated="Please use `tableX.extra_columns` instead")  # noqa: N815, UP006, UP045
    whereClause: Optional[str]  # noqa: N815, UP045
    table_profile_config: Optional[TableProfilerConfig]  # noqa: UP045


class TableCustomSQLQueryRuntimeParameters(BaseModel):
    conn_config: DatabaseConnection
    entity: Table


class RuleLibrarySqlExpressionRuntimeParameters(BaseModel):
    conn_config: DatabaseConnection
    test_definition: TestDefinition
