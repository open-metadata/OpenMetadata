#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Regression checks for schema-derived ODCS export model inputs."""

import importlib.util
import json
import os
import tempfile
from unittest.mock import patch
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "odcs_models", ROOT / "scripts/generate_odcs_export_models.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class OdcsExportModelProjectionTest(unittest.TestCase):
    def setUp(self):
        self.source = json.loads(
            (
                ROOT
                / "openmetadata-service/src/test/resources/odcs/odcs-json-schema-v3.1.0.json"
            ).read_text()
        )

    def test_repeated_generation_does_not_touch_unchanged_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            vendor = root / "vendor"
            source = vendor / "v3.1.0/schema.json"
            source.parent.mkdir(parents=True)
            source.write_text(json.dumps(self.source))
            models = root / "models"
            with (
                patch.object(MODULE, "ROOT", root),
                patch.object(MODULE, "VENDOR", vendor),
                patch.object(MODULE, "MODELS", models),
            ):
                self.assertTrue(MODULE.generate(False))
                target = models / "v310/odcsContract.json"
                os.utime(target, ns=(1_000_000_000, 1_000_000_000))
                self.assertTrue(MODULE.generate(False))
                self.assertEqual(1_000_000_000, target.stat().st_mtime_ns)
                self.assertTrue(MODULE.generate(True))

    def test_table_and_column_models_derive_their_distinct_fields(self):
        model = MODULE.project_model(self.source, "v3.1.0")
        table = model["definitions"]["SchemaObject"]["properties"]
        column = model["definitions"]["SchemaProperty"]["properties"]
        self.assertIn("name", table)
        self.assertNotIn("primaryKey", table)
        self.assertIn("primaryKey", column)
        self.assertIn("name", column)
        self.assertIn("items", column)
        self.assertNotIn("long", column["logicalType"]["enum"])
        self.assertIn("integer", column["logicalType"]["enum"])

    def test_conditional_quality_fields_are_available_to_the_mapper(self):
        quality = MODULE.project_model(self.source, "v3.1.0")["definitions"][
            "DataQuality"
        ]["properties"]
        for field in [
            "metric",
            "mustBe",
            "mustBeBetween",
            "query",
            "engine",
            "implementation",
        ]:
            self.assertIn(field, quality)
        self.assertNotIn("column", quality)

    def test_unset_collections_start_absent_in_generated_models(self):
        model = MODULE.project_model(self.source, "v3.1.0")
        self.assertIsNone(model["properties"]["schema"]["default"])
        self.assertIsNone(model["properties"]["tags"]["default"])
        self.assertIsNone(
            model["definitions"]["SchemaProperty"]["properties"]["quality"]["default"]
        )

    def test_wire_timestamps_remain_strings_in_generated_models(self):
        model = MODULE.project_model(self.source, "v3.1.0")
        self.assertEqual(
            "java.lang.String", model["properties"]["contractCreatedTs"]["javaType"]
        )

    def test_schema_additions_appear_without_adding_projection_rules(self):
        self.source["$defs"]["SchemaElement"]["properties"]["futureAttribute"] = {
            "type": "string"
        }
        table = MODULE.project_model(self.source, "v3.1.0")["definitions"][
            "SchemaObject"
        ]
        self.assertEqual({"type": "string"}, table["properties"]["futureAttribute"])

    def test_annotation_defaults_are_not_materialized_but_default_named_fields_survive(
        self,
    ):
        self.source["$defs"]["SchemaElement"]["properties"]["default"] = {
            "type": "string",
            "default": "example",
        }
        model = MODULE.project_model(self.source, "v3.1.0")
        table = model["definitions"]["SchemaObject"]["properties"]
        self.assertEqual({"type": "string"}, table["default"])
        self.assertNotIn("default", model["properties"]["apiVersion"])
        self.assertNotIn(
            "default", model["definitions"]["SchemaProperty"]["properties"]["required"]
        )
        self.assertIn("default", self.source["properties"]["apiVersion"])


if __name__ == "__main__":
    unittest.main()
