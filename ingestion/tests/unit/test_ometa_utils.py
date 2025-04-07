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
from unittest import TestCase

from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.connections.headers import render_query_header
from metadata.ingestion.ometa.utils import (
    build_entity_reference,
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
