"""Unity Catalog spec for data diff - delegates to Databricks connection"""

from typing import Optional, Union
from urllib.parse import urlparse

from metadata.data_quality.validations.models import TableParameter
from metadata.data_quality.validations.runtime_param_setter.table_diff_params_setter import (
    BaseTableParameter,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.utils import fqn


class UnityCatalogTableParameter(BaseTableParameter):
    """Unity Catalog table parameter setter - uses Unity Catalog connection
    which is databricks-based for data diff operations"""

    def get(
        self,
        service: DatabaseService,
        entity: Table,
        key_columns,
        extra_columns,
        case_sensitive_columns,
        service_url: Optional[Union[str, dict]],
    ) -> TableParameter:
        """Getter table parameter for the table diff test.

        Returns:
            TableParameter
        """
        return TableParameter(
            database_service_type=service.serviceType,
            path=self.get_data_diff_table_path(
                entity.fullyQualifiedName.root, service.serviceType
            ),
            serviceUrl=UnityCatalogTableParameter.get_data_diff_url(
                db_service=service,
                table_fqn=entity.fullyQualifiedName.root,
                override_url=service_url,
            ),
            columns=self.filter_relevant_columns(
                entity.columns,
                key_columns,
                extra_columns,
                case_sensitive=case_sensitive_columns,
            ),
            privateKey=None,
            passPhrase=None,
        )

    @staticmethod
    def _get_service_connection_config(
        service_connection_config,
    ) -> Optional[Union[str, dict]]:
        """Build connection URL directly to avoid WorkspaceClient.url AttributeError"""
        if service_connection_config:
            scheme = getattr(
                service_connection_config, "scheme", "databricks+connector"
            )
            # Handle enum values properly
            if hasattr(scheme, "value"):
                scheme = scheme.value
            host_port = getattr(service_connection_config, "hostPort", "localhost:443")
            token = getattr(service_connection_config, "token", "")
            token_value = (
                token.get_secret_value()
                if hasattr(token, "get_secret_value")
                else str(token)
            )

            # Include httpPath if available (required for data_diff library)
            http_path = getattr(service_connection_config, "httpPath", "")
            if http_path:
                # Ensure http_path starts with /
                if not http_path.startswith("/"):
                    http_path = "/" + http_path
                return f"{scheme}://:{token_value}@{host_port}{http_path}"
            else:
                return f"{scheme}://:{token_value}@{host_port}"
        return None

    @staticmethod
    def get_data_diff_url(
        db_service: DatabaseService,
        table_fqn,
        override_url: Optional[Union[str, dict]] = None,
    ) -> Union[str, dict]:
        """Get the url for the data diff service.

        Args:
            db_service (DatabaseService): The database service entity
            table_fqn (str): The fully qualified name of the table
            override_url (Optional[str], optional): Override the url. Defaults to None.

        Returns:
            str: The url for the data diff service
        """
        source_url = (
            UnityCatalogTableParameter._get_service_connection_config(
                db_service.connection.config
            )
            if not override_url
            else override_url
        )
        if isinstance(source_url, dict):
            source_url["driver"] = source_url["driver"].split("+")[0]
            return source_url
        url = urlparse(source_url)
        # remove the driver name from the url because table-diff doesn't support it
        kwargs = {"scheme": url.scheme.split("+")[0]}
        service, database, schema, table = fqn.split(  # pylint: disable=unused-variable
            table_fqn
        )

        # path needs to include the database AND schema in some of the connectors
        if hasattr(db_service.connection.config, "supportsDatabase"):
            kwargs["query"] = f"catalog={database}"
        return url._replace(**kwargs).geturl()

    BaseTableParameter._get_service_connection_config = _get_service_connection_config
