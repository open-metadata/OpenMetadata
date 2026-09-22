"""Models for the TableDiff test case"""

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
    serviceUrl: str | dict  # noqa: N815
    path: str
    fullyQualifiedName: str | None = None  # noqa: N815
    columns: list[Column]
    database_service_type: DatabaseServiceType
    privateKey: CustomSecretStr | None  # noqa: N815
    passPhrase: CustomSecretStr | None  # noqa: N815
    key_columns: list[str] | None = None
    extra_columns: list[str] | None = None

    @property
    def data_diff_service_url(self) -> str | dict:
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
    keyColumns: list[str] | None = Field(..., deprecated="Please use `tableX.key_columns` instead")  # noqa: N815
    extraColumns: list[str] | None = Field(..., deprecated="Please use `tableX.extra_columns` instead")  # noqa: N815
    whereClause: str | None  # noqa: N815
    table_profile_config: TableProfilerConfig | None


class TableCustomSQLQueryRuntimeParameters(BaseModel):
    conn_config: DatabaseConnection
    entity: Table


class RuleLibrarySqlExpressionRuntimeParameters(BaseModel):
    conn_config: DatabaseConnection
    test_definition: TestDefinition
