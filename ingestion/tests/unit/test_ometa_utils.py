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
OpenMetadata utils tests
"""
import base64
import json
from unittest import TestCase

from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.connections.headers import render_query_header
from metadata.ingestion.ometa.utils import (
    build_entity_reference,
    decode_jwt_token,
    format_name,
    get_entity_type,
    model_str,
)

MOCK_TABLE = Table(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="customers",
    description="description\nwith new line",
    tableType="Regular",
    columns=[
        Column(
            name="customer_id",
            dataType="INT",
        ),
        Column(
            name="first_name",
            dataType="STRING",
        ),
        Column(
            name="last_name",
            dataType="STRING",
        ),
    ],
    databaseSchema=EntityReference(
        id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="databaseSchema"
    ),
)


class OMetaUtilsTest(TestCase):
    def test_format_name(self):
        """
        Check we are properly formatting names
        """

        self.assertEqual(format_name("random"), "random")
        self.assertEqual(format_name("ran dom"), "ran_dom")
        self.assertEqual(format_name("ran_(dom"), "ran__dom")

    def test_get_entity_type(self):
        """
        Check that we return a string or the class name
        """

        self.assertEqual(get_entity_type("hello"), "hello")
        self.assertEqual(get_entity_type(MlModel), "mlmodel")

    def test_model_str(self):
        """
        Return Uuid as str
        """

        self.assertEqual(model_str("random"), "random")
        self.assertEqual(
            model_str(basic.Uuid("9fc58e81-7412-4023-a298-59f2494aab9d")),
            "9fc58e81-7412-4023-a298-59f2494aab9d",
        )

        self.assertEqual(model_str(basic.EntityName("EntityName")), "EntityName")
        self.assertEqual(model_str(basic.FullyQualifiedEntityName("FQDN")), "FQDN")

    def test_render_query_headers_builds_the_right_string(self) -> None:
        assert (
            render_query_header("0.0.1")
            == '/* {"app": "OpenMetadata", "version": "0.0.1"} */'
        )

    def test_build_entity_reference(self) -> None:
        """Check we're building the right class"""
        res = build_entity_reference(MOCK_TABLE)
        self.assertEqual(res.type, "table")
        self.assertEqual(res.id, MOCK_TABLE.id)

    def test_decode_jwt_token_valid(self):
        """Test decoding a valid JWT token"""
        # Create a mock JWT payload
        payload = {
            "sub": "testuser",
            "email": "testuser@example.com",
            "name": "Test User",
            "iat": 1640995200,
            "exp": 1641081600,
        }

        # Encode the payload
        payload_encoded = (
            base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8"))
            .decode("utf-8")
            .rstrip("=")
        )

        # Create a mock JWT token (header.payload.signature)
        jwt_token = f"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.{payload_encoded}.signature"

        result = decode_jwt_token(jwt_token)

        self.assertIsNotNone(result)
        self.assertEqual(result["sub"], "testuser")
        self.assertEqual(result["email"], "testuser@example.com")
        self.assertEqual(result["name"], "Test User")

    def test_decode_jwt_token_with_padding(self):
        """Test decoding a JWT token that needs padding"""
        # Create a payload that will need padding
        payload = {"sub": "admin", "email": "admin@openmetadata.org"}

        # Encode without padding
        payload_encoded = (
            base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8"))
            .decode("utf-8")
            .rstrip("=")
        )

        jwt_token = f"header.{payload_encoded}.signature"

        result = decode_jwt_token(jwt_token)

        self.assertIsNotNone(result)
        self.assertEqual(result["sub"], "admin")
        self.assertEqual(result["email"], "admin@openmetadata.org")

    def test_decode_jwt_token_invalid_format(self):
        """Test decoding an invalid JWT token format"""
        # Test with wrong number of parts
        invalid_token = "header.payload"  # Missing signature
        result = decode_jwt_token(invalid_token)
        self.assertIsNone(result)

        # Test with too many parts
        invalid_token = "header.payload.signature.extra"
        result = decode_jwt_token(invalid_token)
        self.assertIsNone(result)

    def test_decode_jwt_token_invalid_base64(self):
        """Test decoding a JWT token with invalid base64 in payload"""
        invalid_token = "header.invalid-base64.signature"
        result = decode_jwt_token(invalid_token)
        self.assertIsNone(result)

    def test_decode_jwt_token_invalid_json(self):
        """Test decoding a JWT token with invalid JSON in payload"""
        # Create invalid JSON payload
        invalid_json = "invalid json content"
        payload_encoded = base64.urlsafe_b64encode(invalid_json.encode("utf-8")).decode(
            "utf-8"
        )

        jwt_token = f"header.{payload_encoded}.signature"

        result = decode_jwt_token(jwt_token)
        self.assertIsNone(result)

    def test_decode_jwt_token_empty_payload(self):
        """Test decoding a JWT token with empty payload"""
        # Create empty payload
        payload_encoded = base64.urlsafe_b64encode(
            json.dumps({}).encode("utf-8")
        ).decode("utf-8")

        jwt_token = f"header.{payload_encoded}.signature"

        result = decode_jwt_token(jwt_token)
        self.assertIsNotNone(result)
        self.assertEqual(result, {})

    def test_decode_jwt_token_none_input(self):
        """Test decoding with None input"""
        result = decode_jwt_token(None)
        self.assertIsNone(result)

    def test_decode_jwt_token_empty_string(self):
        """Test decoding with empty string input"""
        result = decode_jwt_token("")
        self.assertIsNone(result)

    def test_decode_jwt_token_real_world_example(self):
        """Test with a realistic JWT token structure"""
        # Simulate a real OpenMetadata JWT token payload
        payload = {
            "sub": "ingestion-bot",
            "iss": "open-metadata.org",
            "iat": 1663938462,
            "email": "ingestion-bot@open-metadata.org",
            "isBot": False,
        }

        payload_encoded = (
            base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8"))
            .decode("utf-8")
            .rstrip("=")
        )

        jwt_token = f"eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.{payload_encoded}.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"

        result = decode_jwt_token(jwt_token)

        self.assertIsNotNone(result)
        self.assertEqual(result["sub"], "ingestion-bot")
        self.assertEqual(result["iss"], "open-metadata.org")
        self.assertEqual(result["email"], "ingestion-bot@open-metadata.org")
        self.assertEqual(result["isBot"], False)
