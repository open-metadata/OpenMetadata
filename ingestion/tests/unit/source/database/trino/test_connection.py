#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Unit tests for Trino connection handling
"""

import pytest

from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    ConnectionArguments,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.common.jwtAuth import (
    JwtAuth,
)
from metadata.generated.schema.entity.services.connections.database.common.noConfigAuthenticationTypes import (
    NoConfigAuthenticationTypes,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection as TrinoConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoScheme,
)
from metadata.ingestion.connections.builders import init_empty_connection_arguments
from metadata.ingestion.source.database.trino.connection import TrinoConnection


class TestTrinoConnectionHttpScheme:
    """Test http_scheme handling in Trino connection auth methods"""

    @pytest.fixture
    def basic_connection_config(self) -> TrinoConnectionConfig:
        return TrinoConnectionConfig(
            scheme=TrinoScheme.trino,
            hostPort="localhost:8080",
            username="test_user",
            authType=BasicAuth(password="test_password"),
        )

    @pytest.fixture
    def jwt_connection_config(self) -> TrinoConnectionConfig:
        return TrinoConnectionConfig(
            scheme=TrinoScheme.trino,
            hostPort="localhost:8080",
            username="test_user",
            authType=JwtAuth(jwt="test_jwt_token"),
        )

    @pytest.fixture
    def oauth2_connection_config(self) -> TrinoConnectionConfig:
        return TrinoConnectionConfig(
            scheme=TrinoScheme.trino,
            hostPort="localhost:8080",
            username="test_user",
            authType=NoConfigAuthenticationTypes.OAuth2,
        )

    def test_basic_auth_defaults_to_https(self, basic_connection_config):
        connection_args = init_empty_connection_arguments()

        TrinoConnection.set_basic_auth(basic_connection_config, connection_args)

        assert connection_args.root["http_scheme"] == "https"
        assert "auth" in connection_args.root

    def test_basic_auth_preserves_explicit_http_scheme(self, basic_connection_config):
        connection_args = init_empty_connection_arguments()
        connection_args.root["http_scheme"] = "http"

        TrinoConnection.set_basic_auth(basic_connection_config, connection_args)

        assert connection_args.root["http_scheme"] == "http"
        assert "auth" in connection_args.root

    def test_basic_auth_preserves_custom_https(self, basic_connection_config):
        connection_args = init_empty_connection_arguments()
        connection_args.root["http_scheme"] = "https"

        TrinoConnection.set_basic_auth(basic_connection_config, connection_args)

        assert connection_args.root["http_scheme"] == "https"

    def test_jwt_auth_defaults_to_https(self, jwt_connection_config):
        connection_args = init_empty_connection_arguments()

        TrinoConnection.set_jwt_auth(jwt_connection_config, connection_args)

        assert connection_args.root["http_scheme"] == "https"
        assert "auth" in connection_args.root

    def test_jwt_auth_preserves_explicit_http_scheme(self, jwt_connection_config):
        connection_args = init_empty_connection_arguments()
        connection_args.root["http_scheme"] = "http"

        TrinoConnection.set_jwt_auth(jwt_connection_config, connection_args)

        assert connection_args.root["http_scheme"] == "http"
        assert "auth" in connection_args.root

    def test_oauth2_auth_defaults_to_https(self, oauth2_connection_config):
        connection_args = init_empty_connection_arguments()

        TrinoConnection.set_oauth2_auth(oauth2_connection_config, connection_args)

        assert connection_args.root["http_scheme"] == "https"
        assert "auth" in connection_args.root

    def test_oauth2_auth_preserves_explicit_http_scheme(self, oauth2_connection_config):
        connection_args = init_empty_connection_arguments()
        connection_args.root["http_scheme"] = "http"

        TrinoConnection.set_oauth2_auth(oauth2_connection_config, connection_args)

        assert connection_args.root["http_scheme"] == "http"
        assert "auth" in connection_args.root

    def test_build_connection_args_preserves_http_scheme(self, basic_connection_config):
        basic_connection_config.connectionArguments = ConnectionArguments(
            root={"http_scheme": "http"}
        )

        result = TrinoConnection.build_connection_args(basic_connection_config)

        assert result.root["http_scheme"] == "http"

    def test_build_connection_args_defaults_http_scheme(self, basic_connection_config):
        result = TrinoConnection.build_connection_args(basic_connection_config)

        assert result.root["http_scheme"] == "https"
