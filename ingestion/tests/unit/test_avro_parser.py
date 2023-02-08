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
Avro parser tests
"""
from unittest import TestCase

from metadata.parsers.avro_parser import parse_avro_schema


class AvroParserTests(TestCase):
    """
    Check methods from avro_parser.py
    """

    sample_avro_schema = """{
        "namespace": "example.avro",
        "type": "record",
        "name": "Order",
        "fields": [
            {
            "name": "order_id",
            "type": "int"
            },
            {
            "name": "api_client_id",
            "type": "int"
            },
            {
            "name": "billing_address_id",
            "type": "int"
            },
            {
            "name": "customer_id",
            "type": "int"
            },
            {
            "name": "location_id",
            "type": "int"
            },
            {
            "name": "shipping_address_id",
            "type": "int"
            },
            {
            "name": "user_id",
            "type": "int"
            },
            {
            "name": "total_price",
            "type": "double"
            },
            {
            "name": "discount_code",
            "type": "string"
            },
            {
            "name": "processed_at",
            "type": "int"
            }
        ]
        }"""

    parsed_schema = parse_avro_schema(sample_avro_schema)

    def test_schema_name(self):
        self.assertEqual(self.parsed_schema[0].name.__root__, "order_id")

    def test_schema_type(self):
        self.assertEqual(self.parsed_schema[0].dataType.name, "INT")

    def test_field_names(self):
        field_names = {str(field.name.__root__) for field in self.parsed_schema}
        self.assertEqual(
            field_names,
            {
                "api_client_id",
                "user_id",
                "order_id",
                "discount_code",
                "location_id",
                "processed_at",
                "total_price",
                "shipping_address_id",
                "billing_address_id",
                "customer_id",
            },
        )

    def test_field_types(self):
        field_types = {str(field.dataType.name) for field in self.parsed_schema}
        self.assertEqual(field_types, {"INT", "STRING", "DOUBLE"})
