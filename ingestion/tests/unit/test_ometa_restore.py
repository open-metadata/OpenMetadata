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
Unit tests for OpenMetadata restore functionality
"""
from unittest import TestCase
from unittest.mock import MagicMock

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.basic import Uuid
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaRestoreTest(TestCase):
    """
    Test the restore method in OpenMetadata API
    """

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )

    def test_restore_entity_success(self):
        """
        Test successful entity restoration
        """
        metadata = OpenMetadata(self.server_config)

        entity_id = Uuid("b67eac63-9e43-41f5-afb9-387c85df1d8b")
        entity_id_str = "b67eac63-9e43-41f5-afb9-387c85df1d8b"
        mock_response = {
            "id": entity_id_str,
            "name": "test-table",
            "fullyQualifiedName": "test-service.test-db.test-schema.test-table",
            "deleted": False,
            "columns": [],
        }

        metadata.client.put = MagicMock(return_value=mock_response)

        result = metadata.restore(entity=Table, entity_id=entity_id)

        self.assertIsNotNone(result)
        self.assertIsInstance(result, Table)
        self.assertEqual(str(result.id.root), entity_id_str)
        self.assertFalse(result.deleted)

        metadata.client.put.assert_called_once()
        call_args = metadata.client.put.call_args
        self.assertEqual(call_args[0][0], "/tables/restore")
        self.assertEqual(call_args[1]["json"]["id"], entity_id_str)

    def test_restore_entity_with_string_id(self):
        """
        Test entity restoration with string ID
        """
        metadata = OpenMetadata(self.server_config)

        entity_id = "b67eac63-9e43-41f5-afb9-387c85df1d8b"
        mock_response = {
            "id": entity_id,
            "name": "test-table",
            "fullyQualifiedName": "test-service.test-db.test-schema.test-table",
            "deleted": False,
            "columns": [],
        }

        metadata.client.put = MagicMock(return_value=mock_response)

        result = metadata.restore(entity=Table, entity_id=entity_id)

        self.assertIsNotNone(result)
        self.assertIsInstance(result, Table)
        metadata.client.put.assert_called_once()
        call_args = metadata.client.put.call_args
        self.assertEqual(call_args[1]["json"], {"id": entity_id})

    def test_restore_entity_empty_response(self):
        """
        Test restore with empty response returns None
        """
        from metadata.ingestion.ometa.ometa_api import EmptyPayloadException

        metadata = OpenMetadata(self.server_config)
        metadata.client.put = MagicMock(return_value=None)

        entity_id = Uuid("b67eac63-9e43-41f5-afb9-387c85df1d8b")

        with self.assertRaises(EmptyPayloadException):
            metadata.restore(entity=Table, entity_id=entity_id)

    def test_restore_entity_api_error(self):
        """
        Test restore handles API errors gracefully
        """
        from metadata.ingestion.ometa.client import APIError

        metadata = OpenMetadata(self.server_config)

        entity_id = Uuid("b67eac63-9e43-41f5-afb9-387c85df1d8b")
        metadata.client.put = MagicMock(
            side_effect=APIError({"code": 404, "message": "Entity not found"})
        )

        result = metadata.restore(entity=Table, entity_id=entity_id)

        self.assertIsNone(result)

    def test_restore_endpoint_suffix(self):
        """
        Test that restore uses correct endpoint suffix
        """
        metadata = OpenMetadata(self.server_config)
        suffix = metadata.get_suffix(Table)
        expected_restore_endpoint = f"{suffix}/restore"
        self.assertEqual(expected_restore_endpoint, "/tables/restore")
