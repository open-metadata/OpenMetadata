#  Copyright 2024 Collate
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
Test OpenAPI schema parser for both JSON and YAML formats
"""

import json
from unittest import TestCase
from unittest.mock import Mock

import yaml

from metadata.ingestion.source.api.rest.parser import (
    OpenAPIParseError,
    parse_openapi_schema,
    validate_openapi_schema,
)


class TestOpenAPIParser(TestCase):
    """Test cases for OpenAPI schema parser"""

    def setUp(self):
        """Set up test data"""
        self.openapi_data = {
            "openapi": "3.0.3",
            "info": {
                "title": "Test API",
                "version": "1.0.0"
            },
            "paths": {
                "/pets": {
                    "get": {
                        "tags": ["pets"],
                        "summary": "List all pets",
                        "operationId": "listPets"
                    }
                }
            },
            "tags": [
                {
                    "name": "pets",
                    "description": "Everything about pets"
                }
            ]
        }
        
        self.swagger_data = {
            "swagger": "2.0",
            "info": {
                "title": "Test API",
                "version": "1.0.0"
            },
            "paths": {
                "/pets": {
                    "get": {
                        "tags": ["pets"],
                        "summary": "List all pets",
                        "operationId": "listPets"
                    }
                }
            },
            "tags": [
                {
                    "name": "pets",
                    "description": "Everything about pets"
                }
            ]
        }

    def test_parse_json_openapi_schema(self):
        """Test parsing valid JSON OpenAPI schema"""
        mock_response = Mock()
        mock_response.text = json.dumps(self.openapi_data)
        mock_response.headers = {'content-type': 'application/json'}
        
        result = parse_openapi_schema(mock_response)
        
        self.assertEqual(result, self.openapi_data)

    def test_parse_yaml_openapi_schema(self):
        """Test parsing valid YAML OpenAPI schema"""
        mock_response = Mock()
        mock_response.text = yaml.dump(self.openapi_data)
        mock_response.headers = {'content-type': 'application/yaml'}
        
        result = parse_openapi_schema(mock_response)
        
        self.assertEqual(result, self.openapi_data)

    def test_parse_json_without_content_type(self):
        """Test parsing JSON when content-type is not specified"""
        mock_response = Mock()
        mock_response.text = json.dumps(self.openapi_data)
        mock_response.headers = {}
        
        result = parse_openapi_schema(mock_response)
        
        self.assertEqual(result, self.openapi_data)

    def test_parse_yaml_without_content_type(self):
        """Test parsing YAML when content-type is not specified"""
        mock_response = Mock()
        # Use YAML format that's not valid JSON to ensure YAML parser is used
        yaml_content = """
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /pets:
    get:
      tags:
        - pets
      summary: List all pets
      operationId: listPets
tags:
  - name: pets
    description: Everything about pets
"""
        mock_response.text = yaml_content
        mock_response.headers = {}
        
        result = parse_openapi_schema(mock_response)
        
        self.assertEqual(result["openapi"], "3.0.3")
        self.assertEqual(result["info"]["title"], "Test API")

    def test_parse_yml_content_type(self):
        """Test parsing with content-type: application/yml"""
        mock_response = Mock()
        mock_response.text = yaml.dump(self.openapi_data)
        mock_response.headers = {'content-type': 'application/yml'}
        
        result = parse_openapi_schema(mock_response)
        
        self.assertEqual(result, self.openapi_data)

    def test_parse_text_yaml_content_type(self):
        """Test parsing with content-type: text/yaml"""
        mock_response = Mock()
        mock_response.text = yaml.dump(self.openapi_data)
        mock_response.headers = {'content-type': 'text/yaml'}
        
        result = parse_openapi_schema(mock_response)
        
        self.assertEqual(result, self.openapi_data)

    def test_parse_invalid_content(self):
        """Test parsing invalid content that's neither JSON nor YAML"""
        mock_response = Mock()
        mock_response.text = "This is neither JSON nor YAML { invalid syntax"
        mock_response.headers = {}
        
        with self.assertRaises(OpenAPIParseError):
            parse_openapi_schema(mock_response)

    def test_parse_empty_content(self):
        """Test parsing empty content"""
        mock_response = Mock()
        mock_response.text = ""
        mock_response.headers = {}
        
        with self.assertRaises(OpenAPIParseError):
            parse_openapi_schema(mock_response)

    def test_parse_none_yaml_content(self):
        """Test parsing YAML that returns None"""
        mock_response = Mock()
        mock_response.text = "# This is just a comment\n"
        mock_response.headers = {}
        
        with self.assertRaises(OpenAPIParseError):
            parse_openapi_schema(mock_response)

    def test_validate_openapi_schema_valid_openapi3(self):
        """Test validation of valid OpenAPI 3.x schema"""
        self.assertTrue(validate_openapi_schema(self.openapi_data))

    def test_validate_openapi_schema_valid_swagger2(self):
        """Test validation of valid Swagger 2.0 schema"""
        self.assertTrue(validate_openapi_schema(self.swagger_data))

    def test_validate_openapi_schema_invalid_not_dict(self):
        """Test validation of invalid schema (not a dictionary)"""
        self.assertFalse(validate_openapi_schema("not a dict"))
        self.assertFalse(validate_openapi_schema(123))
        self.assertFalse(validate_openapi_schema([]))

    def test_validate_openapi_schema_invalid_missing_fields(self):
        """Test validation of invalid schema (missing required fields)"""
        invalid_schema = {
            "info": {
                "title": "Test API",
                "version": "1.0.0"
            }
        }
        self.assertFalse(validate_openapi_schema(invalid_schema))

    def test_parse_json_with_wrong_content_type_fallback(self):
        """Test parsing JSON with wrong content-type, should fallback to JSON parser"""
        mock_response = Mock()
        mock_response.text = json.dumps(self.openapi_data)
        mock_response.headers = {'content-type': 'text/plain'}  # Wrong content-type
        
        result = parse_openapi_schema(mock_response)
        
        self.assertEqual(result, self.openapi_data)

    def test_parse_yaml_with_wrong_content_type_fallback(self):
        """Test parsing YAML with wrong content-type, should fallback to YAML parser"""
        mock_response = Mock()
        # YAML that's not valid JSON
        yaml_content = "openapi: '3.0.3'\ninfo:\n  title: Test\n  version: '1.0'"
        mock_response.text = yaml_content
        mock_response.headers = {'content-type': 'text/plain'}  # Wrong content-type
        
        result = parse_openapi_schema(mock_response)
        
        self.assertEqual(result["openapi"], "3.0.3")
        self.assertEqual(result["info"]["title"], "Test")