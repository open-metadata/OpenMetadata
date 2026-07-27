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
Tests for Unity Catalog valueless-tag handling.

Covers the (tag_name, tag_value) -> (classification, tag) mapping introduced
to support Unity Catalog system-generated / user-defined tags that carry only
a name and no value (issue #28245).
"""

from metadata.ingestion.source.database.unitycatalog.metadata import (
    UNITY_CATALOG_TAG,
    UNITY_CATALOG_TAG_CLASSIFICATION,
    UNITY_CATALOG_VALUELESS_CLASSIFICATION,
    UNITY_CATALOG_VALUELESS_CLASSIFICATION_DESCRIPTION,
    UnitycatalogSource,
)


class TestUnitycatalogOmetaTagCallArgs:
    """_ometa_tag_call_args maps Unity Catalog (tag_name, tag_value) onto the
    classification/tag arguments passed to get_ometa_tag_and_classification.
    """

    def test_valued_tag_uses_tag_name_as_classification(self):
        args = UnitycatalogSource._ometa_tag_call_args("pii", "ssn")

        assert args == {
            "tags": ["ssn"],
            "classification_name": "pii",
            "tag_description": UNITY_CATALOG_TAG,
            "classification_description": UNITY_CATALOG_TAG_CLASSIFICATION,
        }

    def test_valueless_tag_falls_back_to_valueless_classification(self):
        args = UnitycatalogSource._ometa_tag_call_args("class.us_ssn", None)

        assert args == {
            "tags": ["class.us_ssn"],
            "classification_name": UNITY_CATALOG_VALUELESS_CLASSIFICATION,
            "tag_description": UNITY_CATALOG_VALUELESS_CLASSIFICATION_DESCRIPTION,
            "classification_description": UNITY_CATALOG_VALUELESS_CLASSIFICATION_DESCRIPTION,
        }

    def test_empty_string_tag_value_is_treated_as_valueless(self):
        args = UnitycatalogSource._ometa_tag_call_args("plain_tag", "")

        assert args["classification_name"] == UNITY_CATALOG_VALUELESS_CLASSIFICATION
        assert args["tags"] == ["plain_tag"]

    def test_whitespace_only_tag_value_is_treated_as_valueless(self):
        args = UnitycatalogSource._ometa_tag_call_args("plain_tag", "   ")

        assert args["classification_name"] == UNITY_CATALOG_VALUELESS_CLASSIFICATION
        assert args["tags"] == ["plain_tag"]

    def test_valueless_tag_without_dot_uses_tag_name_verbatim(self):
        args = UnitycatalogSource._ometa_tag_call_args("simple_label", None)

        assert args["classification_name"] == UNITY_CATALOG_VALUELESS_CLASSIFICATION
        assert args["tags"] == ["simple_label"]

    def test_valueless_classification_constant_value(self):
        assert UNITY_CATALOG_VALUELESS_CLASSIFICATION == "UNITY_CATALOG_TAGS"
