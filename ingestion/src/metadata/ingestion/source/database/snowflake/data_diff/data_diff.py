"""Snowflake spec for data diff"""

from typing import cast

from sqlalchemy.engine import URL, make_url

from metadata.data_quality.validations.models import TableParameter
from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeConnection
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class SnowflakeTableParameter(BaseTableParameter):
    """SnowflakeTableParameter class for setting runtime parameters for data diff"""

    def get(
        self,
        service: DatabaseService,
        entity: Table,
        key_columns,
        extra_columns,
        case_sensitive_columns,
        service_url: str | None,
    ) -> TableParameter:
        table_param: TableParameter = super().get(
            service,
            entity,
            key_columns,
            extra_columns,
            case_sensitive_columns,
            service_url,
        )
        connection_config = cast(SnowflakeConnection, service.connection.config)  # noqa: TC006
        table_param.privateKey = connection_config.privateKey
        table_param.passPhrase = connection_config.snowflakePrivatekeyPassphrase
        if table_param.privateKey and isinstance(table_param.serviceUrl, str):
            url = make_url(table_param.serviceUrl)
            # data-diff refuses a password and a private key at once. The private key wins, as it
            # does for ingestion, where the connector passes it as a connection argument.
            if url.password:
                logger.warning(
                    "[Data Diff]: Service %s is configured with both a password and a private key. "
                    "Using the private key.",
                    service.name.root,
                )
                # URL.set(password=None) leaves the password untouched, so rebuild the url without it
                table_param.serviceUrl = URL.create(
                    drivername=url.drivername,
                    username=url.username,
                    host=url.host,
                    port=url.port,
                    database=url.database,
                    query=url.query,
                ).render_as_string(hide_password=False)
        return table_param
