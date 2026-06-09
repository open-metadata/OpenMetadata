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
Druid connection tests
"""
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.druidConnection import (
    DruidConnection,
    DruidScheme,
)
from metadata.ingestion.source.database.druid.connection import get_connection


class DruidConnectionTest(TestCase):
    @patch("metadata.ingestion.source.database.druid.connection.create_generic_db_connection")
    def test_get_connection_https(self, mock_create_generic_db_connection):
        """
        Test that get_connection injects use_https=True for druid+https scheme
        """
        druid_conn_obj = DruidConnection(
            scheme=DruidScheme.druid_https, hostPort="localhost:8082"
        )
        
        get_connection(druid_conn_obj)
        
        # Verify that use_https=True was added to connectionArguments
        assert druid_conn_obj.connectionArguments.root.get("use_https") is True
        
    @patch("metadata.ingestion.source.database.druid.connection.create_generic_db_connection")
    def test_get_connection_http(self, mock_create_generic_db_connection):
        """
        Test that get_connection does NOT inject use_https for druid scheme
        """
        druid_conn_obj = DruidConnection(
            scheme=DruidScheme.druid, hostPort="localhost:8082"
        )
        
        get_connection(druid_conn_obj)
        
        # Verify that connectionArguments is still None or doesn't have use_https
        if druid_conn_obj.connectionArguments:
             assert druid_conn_obj.connectionArguments.root.get("use_https") is None

    @patch("metadata.ingestion.source.database.druid.connection.create_generic_db_connection")
    def test_get_connection_https_with_existing_args(self, mock_create_generic_db_connection):
        """
        Test that get_connection preserves existing connectionArguments and adds use_https=True
        """
        from metadata.generated.schema.entity.services.connections.connectionBasicType import ConnectionArguments
        
        druid_conn_obj = DruidConnection(
            scheme=DruidScheme.druid_https, 
            hostPort="localhost:8082",
            connectionArguments=ConnectionArguments(root={"foo": "bar"})
        )
        
        get_connection(druid_conn_obj)
        
        # Verify that use_https=True was added AND existing arg was preserved
        assert druid_conn_obj.connectionArguments.root.get("use_https") is True
        assert druid_conn_obj.connectionArguments.root.get("foo") == "bar"
