"""Models for the TableDiff test case"""

from pydantic import BaseModel, Field
from sqlalchemy.engine import make_url

from metadata.data_quality.validations.utils import render_url_for_data_diff
from metadata.generated.schema.entity.data.table import (
    Column,
    PartitionProfilerConfig,
    Table,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.generated.schema.type.basic import ProfileSampleType
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


class EvaluationScopeRuntimeParameters(BaseModel):
    """What the test case was actually measured against.

    A test case run against a sampled or partitioned table is evaluated on that subset, and
    nothing extrapolates the verdict back to the table. The subset is therefore part of the
    result: `EvaluationScopeParamsSetter` resolves it from the sampler and every validator
    renders it into `TestCaseResult.result`.

    The defaults describe a test case run against everything, which is what a table with no
    sampling and no partitioning gives and what an unset scope has to fall back to.
    """

    profile_sample: float | None = None
    profile_sample_type: ProfileSampleType | None = None
    partition_details: PartitionProfilerConfig | None = None
    partition_predicate: str | None = Field(
        None,
        description="The partition filter as SQL, when the sampler can compile one. Rendered "
        "verbatim into the result message; falls back to `partition_details` when absent.",
    )
    sample_query: str | None = None

    @property
    def is_sampled(self) -> bool:
        """Whether only part of the table was read"""
        return bool(self.profile_sample) or bool(self.sample_query)

    @property
    def is_partitioned(self) -> bool:
        """Whether the rows read were restricted to a partition"""
        return bool(self.partition_details and self.partition_details.enablePartitioning)

    @property
    def is_full_table(self) -> bool:
        """Whether the test case saw the whole table"""
        return not self.is_sampled and not self.is_partitioned
