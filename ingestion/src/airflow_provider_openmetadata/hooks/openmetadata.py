#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
This hook allows storing the connection to
an OpenMetadata server and use it for your
operators.
"""
from typing import Any

from airflow.hooks.base import BaseHook
from airflow.models import Connection

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.security.ssl.validateSSLClientConfig import (
    ValidateSSLClientConfig,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OpenMetadataHook(BaseHook):
    """
    Airflow hook to store and use an `OpenMetadataConnection`
    """

    conn_name_attr: str = "openmetadata_conn_id"
    default_conn_name = "openmetadata_default"
    conn_type = "openmetadata"
    hook_name = "OpenMetadata"

    def __init__(self, openmetadata_conn_id: str = default_conn_name) -> None:
        super().__init__()
        self.openmetadata_conn_id = openmetadata_conn_id
        # Add defaults
        self.default_schema = "http"
        self.default_port = 8585
        self.default_verify_ssl = VerifySSL.no_ssl
        self.default_ssl_config = None

    def get_conn(self) -> OpenMetadataConnection:

        conn: Connection = self.get_connection(self.openmetadata_conn_id)
        jwt_token = conn.get_password()
        if not jwt_token:
            raise ValueError("JWT Token should be informed.")

        if not conn.host:
            raise ValueError("Host should be informed.")

        port = conn.port if conn.port else self.default_port
        schema = conn.schema if conn.schema else self.default_schema

        extra = conn.extra_dejson if conn.get_extra() else {}
        verify_ssl = extra.get("verifySSL") or self.default_verify_ssl
        ssl_config = (
            ValidateSSLClientConfig(certificatePath=extra["sslConfig"])
            if extra.get("sslConfig")
            else self.default_ssl_config
        )

        om_conn = OpenMetadataConnection(
            hostPort=f"{schema}://{conn.host}:{port}/api",
            authProvider=AuthProvider.openmetadata,
            securityConfig=OpenMetadataJWTClientConfig(jwtToken=jwt_token),
            verifySSL=verify_ssl,
            sslConfig=ssl_config,
        )

        return om_conn

    def test_connection(self):
        """Test that we can instantiate the ometa client with the given connection"""
        try:
            OpenMetadata(self.get_conn())
            return True, "Connection successful"
        except Exception as err:
            return False, str(err)

    @staticmethod
    def get_ui_field_behaviour() -> dict[str, Any]:
        """Returns custom field behaviour"""
        return {
            "hidden_fields": ["login"],
            "relabeling": {"password": "JWT Token"},
        }
