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
Test Trino connection SSL verify parameter handling
"""
from unittest import TestCase

from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection as TrinoConnectionConfig,
)
from metadata.ingestion.source.database.trino.connection import TrinoConnection


class TrinoConnectionSSLVerifyTest(TestCase):
    """
    Test that the SSL verify parameter is correctly passed to connection args
    """

    def test_verify_with_ca_cert_path(self):
        """
        Test that verify parameter with CA cert path is passed directly as string
        """
        connection_config = TrinoConnectionConfig(
            username="test_user",
            authType=BasicAuth(password="test_password"),
            hostPort="localhost:8080",
            verify="/path/to/ca-cert.pem",
        )

        connection_args = TrinoConnection.build_connection_args(connection_config)

        # The verify parameter should be the string path, not a dict
        self.assertEqual(connection_args.root["verify"], "/path/to/ca-cert.pem")
        self.assertIsInstance(connection_args.root["verify"], str)
        self.assertNotIsInstance(connection_args.root["verify"], dict)

    def test_verify_with_false_string(self):
        """
        Test that verify parameter can be set to 'false' string
        """
        connection_config = TrinoConnectionConfig(
            username="test_user",
            authType=BasicAuth(password="test_password"),
            hostPort="localhost:8080",
            verify="false",
        )

        connection_args = TrinoConnection.build_connection_args(connection_config)

        # The verify parameter should be the string 'false', not a dict
        self.assertEqual(connection_args.root["verify"], "false")
        self.assertIsInstance(connection_args.root["verify"], str)
        self.assertNotIsInstance(connection_args.root["verify"], dict)

    def test_verify_not_set(self):
        """
        Test that when verify is not provided, it's not in connection args
        """
        connection_config = TrinoConnectionConfig(
            username="test_user",
            authType=BasicAuth(password="test_password"),
            hostPort="localhost:8080",
        )

        connection_args = TrinoConnection.build_connection_args(connection_config)

        # When verify is not set, it should not be in connection args
        self.assertNotIn("verify", connection_args.root)

    def test_verify_with_empty_string(self):
        """
        Test that verify parameter with empty string is not added to connection args
        """
        connection_config = TrinoConnectionConfig(
            username="test_user",
            authType=BasicAuth(password="test_password"),
            hostPort="localhost:8080",
            verify="",
        )

        connection_args = TrinoConnection.build_connection_args(connection_config)

        # Empty string should be falsy and not added
        self.assertNotIn("verify", connection_args.root)
