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
"""Tests for Vertica ischema_names type mapping extensions."""

import pytest
from sqlalchemy import types as sqltypes

sqlalchemy_vertica = pytest.importorskip(
    "sqlalchemy_vertica",
    reason="sqlalchemy_vertica not installed — skipping Vertica type-mapping tests",
)

from sqlalchemy_vertica.base import ischema_names as vertica_ischema_names

# Importing this module triggers the ischema_names.update(...) side-effect
import metadata.ingestion.source.database.vertica.metadata  # noqa: F401


class TestVerticaTypeMappingRegistered:
    """Verify every new type key was added to Vertica's ischema_names."""

    @pytest.mark.parametrize(
        "type_key",
        [
            "UUID",
            "GEOGRAPHY",
            "GEOMETRY",
            "BINARY",
            "VARBINARY",
            "LONG VARBINARY",
            "LONG VARCHAR",
            "ARRAY",
            "NATIVE ARRAY",
            "ROW",
            "SET",
        ],
    )
    def test_type_key_registered(self, type_key):
        assert (
            type_key in vertica_ischema_names
        ), f"'{type_key}' is missing from Vertica ischema_names"


class TestVerticaTypeMappingResolution:
    """Verify each new type resolves to the expected SQLAlchemy supertype."""

    @pytest.mark.parametrize(
        "type_key, expected_sqa_class",
        [
            ("BINARY", sqltypes.LargeBinary),
            ("VARBINARY", sqltypes.LargeBinary),
            ("LONG VARBINARY", sqltypes.LargeBinary),
            ("LONG VARCHAR", sqltypes.Text),
        ],
    )
    def test_standard_type_resolves_to_expected_class(
        self, type_key, expected_sqa_class
    ):
        entry = vertica_ischema_names[type_key]
        assert (
            entry is expected_sqa_class
        ), f"'{type_key}' expected {expected_sqa_class.__name__}, got {entry}"

    @pytest.mark.parametrize(
        "type_key",
        ["GEOMETRY", "ARRAY", "NATIVE ARRAY", "ROW", "SET", "UUID", "GEOGRAPHY"],
    )
    def test_custom_type_is_not_null_type(self, type_key):
        entry = vertica_ischema_names[type_key]
        instance = entry() if isinstance(entry, type) else entry
        assert not isinstance(
            instance, sqltypes.NullType
        ), f"'{type_key}' resolved to NullType — custom type was not registered"
