"""Base class for Databricks-based data diff implementations"""

from typing import Any, Optional, Union

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)


class DatabricksBaseTableParameter(BaseTableParameter):
    """Base class for Databricks-based table parameter setters"""

    @classmethod
    def _get_service_connection_config(
        cls,
        service_connection_config: Any,
    ) -> Optional[Union[str, dict]]:  # noqa: UP007, UP045
        """Build connection URL for Databricks-based connections"""
        if not service_connection_config:
            return None

        scheme = getattr(service_connection_config, "scheme", "databricks")
        # Handle enum values properly
        if hasattr(scheme, "value"):
            scheme = scheme.value

        host_port = getattr(service_connection_config, "hostPort", "localhost:443")
        token_value = cls._extract_pat_token(service_connection_config)

        # Include httpPath if available (required for data_diff library)
        http_path = getattr(service_connection_config, "httpPath", "")
        if http_path:
            # Ensure http_path starts with /
            if not http_path.startswith("/"):
                http_path = "/" + http_path
            return f"{scheme}://:{token_value}@{host_port}{http_path}"
        return f"{scheme}://:{token_value}@{host_port}"

    @staticmethod
    def _extract_pat_token(service_connection_config: Any) -> str:
        """Extract the personal access token for URL-based data-diff auth.

        DatabricksConnection / UnityCatalogConnection nest the token under
        `authType.token` (PersonalAccessToken auth path). A legacy flat
        `token` attribute is also honored for backwards compatibility.

        Raises ValueError when no token is found instead of returning ""
        — the empty-token URL silently falls back to OAuth U2M in the
        Databricks SQL driver, which opens an interactive browser and hangs
        non-interactive runs.
        """
        auth_type = getattr(service_connection_config, "authType", None)
        token = getattr(auth_type, "token", None) if auth_type is not None else None
        if token is None:
            token = getattr(service_connection_config, "token", None)
        # Resolve to the bare string before validating: an empty-string token
        # (e.g. `$E2E_DATABRICKS_TOKEN` set but empty, or `token: ""` in YAML)
        # would otherwise build a URL like `databricks://:@host/...` and the
        # SQL driver would fall back to OAuth U2M, opening a browser. Validate
        # the resolved value so we fail fast in non-interactive environments.
        if token is None:
            token_value = ""
        elif hasattr(token, "get_secret_value"):
            token_value = token.get_secret_value()
        else:
            token_value = str(token)
        if not token_value:
            raise ValueError(
                "Databricks data diff requires Personal Access Token authentication; "
                "no token found on the service connection. OAuth and Azure AD auth "
                "types are not supported by the URL-based data-diff connection."
            )
        return token_value
