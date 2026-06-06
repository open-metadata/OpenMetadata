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
Tests for Databricks valueless-tag handling.

Covers the (tag_name, tag_value) -> (classification, tag) mapping introduced
to support Databricks system-generated / user-defined tags that carry only a
name and no value (issue #28245).
"""

from unittest.mock import MagicMock, patch

from metadata.ingestion.source.database.databricks.metadata import (
    DATABRICKS_TAG,
    DATABRICKS_TAG_CLASSIFICATION,
    DATABRICKS_VALUELESS_CLASSIFICATION,
    DATABRICKS_VALUELESS_CLASSIFICATION_DESCRIPTION,
    DatabricksSource,
)


class TestDatabricksOmetaTagCallArgs:
    """_ometa_tag_call_args maps Databricks (tag_name, tag_value) onto the
    classification/tag arguments passed to get_ometa_tag_and_classification.
    """

    def test_valued_tag_uses_tag_name_as_classification(self):
        args = DatabricksSource._ometa_tag_call_args("pii", "ssn")

        assert args == {
            "tags": ["ssn"],
            "classification_name": "pii",
            "tag_description": DATABRICKS_TAG,
            "classification_description": DATABRICKS_TAG_CLASSIFICATION,
        }

    def test_valueless_tag_falls_back_to_valueless_classification(self):
        args = DatabricksSource._ometa_tag_call_args("class.us_ssn", None)

        assert args == {
            "tags": ["class.us_ssn"],
            "classification_name": DATABRICKS_VALUELESS_CLASSIFICATION,
            "tag_description": DATABRICKS_VALUELESS_CLASSIFICATION_DESCRIPTION,
            "classification_description": DATABRICKS_VALUELESS_CLASSIFICATION_DESCRIPTION,
        }

    def test_empty_string_tag_value_is_treated_as_valueless(self):
        args = DatabricksSource._ometa_tag_call_args("plain_tag", "")

        assert args["classification_name"] == DATABRICKS_VALUELESS_CLASSIFICATION
        assert args["tags"] == ["plain_tag"]

    def test_whitespace_only_tag_value_is_treated_as_valueless(self):
        args = DatabricksSource._ometa_tag_call_args("plain_tag", "   ")

        assert args["classification_name"] == DATABRICKS_VALUELESS_CLASSIFICATION
        assert args["tags"] == ["plain_tag"]

    def test_valueless_tag_without_dot_uses_tag_name_verbatim(self):
        args = DatabricksSource._ometa_tag_call_args("simple_label", None)

        assert args["classification_name"] == DATABRICKS_VALUELESS_CLASSIFICATION
        assert args["tags"] == ["simple_label"]

    def test_valueless_classification_constant_value(self):
        assert DATABRICKS_VALUELESS_CLASSIFICATION == "DATABRICKS_TAGS"


class TestDatabricksYieldSkipsEmptyTagName:
    """Rows with an empty/None tag_name are skipped so an empty classification
    name is never sent to the API (parity with the Unity Catalog connector).
    """

    @patch(
        "metadata.ingestion.source.database.databricks.metadata.get_ometa_tag_and_classification",
        return_value=[],
    )
    @patch("metadata.ingestion.source.database.databricks.metadata.fqn")
    def test_empty_or_none_tag_name_is_skipped(self, mock_fqn, mock_get_tag):
        source = DatabricksSource.__new__(DatabricksSource)
        source.metadata = MagicMock()
        source.context = MagicMock()
        source.catalog_tags = {"db": [("", "value"), (None, None), ("real_tag", None)]}

        list(source.yield_database_tag("db"))

        assert mock_get_tag.call_count == 1
        _, kwargs = mock_get_tag.call_args
        assert kwargs["classification_name"] == DATABRICKS_VALUELESS_CLASSIFICATION
        assert kwargs["tags"] == ["real_tag"]
