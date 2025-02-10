"""Snowflake spec for data diff"""

from typing import Optional, cast

from metadata.data_quality.validations.models import TableParameter
from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeConnection


class SnowflakeTableParameter(BaseTableParameter):
    """SnowflakeTableParameter class for setting runtime parameters for data diff"""

    def get(
        self,
        service: DatabaseService,
        entity: Table,
        key_columns,
        extra_columns,
        case_sensitive_columns,
        service_url: Optional[str],
    ) -> TableParameter:
        table_param: TableParameter = super().get(
            service,
            entity,
            key_columns,
            extra_columns,
            case_sensitive_columns,
            service_url,
        )
        connection_config = cast(SnowflakeConnection, service.connection.config)
        table_param.privateKey = connection_config.privateKey
        table_param.passPhrase = connection_config.snowflakePrivatekeyPassphrase
        return table_param
