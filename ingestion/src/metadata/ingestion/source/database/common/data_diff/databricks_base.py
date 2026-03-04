"""Base class for Databricks-based data diff implementations"""

from typing import Optional, Union

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)


class DatabricksBaseTableParameter(BaseTableParameter):
    """Base class for Databricks-based table parameter setters"""

    @classmethod
    def _get_service_connection_config(
        cls,
        service_connection_config,
    ) -> Optional[Union[str, dict]]:
        """Build connection URL for Databricks-based connections"""
        if not service_connection_config:
            return None

        scheme = getattr(service_connection_config, "scheme", "databricks+connector")
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
        return f"{scheme}://:{token_value}@{host_port}"
