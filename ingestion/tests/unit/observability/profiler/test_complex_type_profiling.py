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
Test Profiler Complex Data Type Support

Validates that the profiler registry correctly splits types into
NOT_COMPUTE (truly unprofileable) and COMPLEX_TYPES (limited metrics),
and that the COMPLEX_TYPE_METRICS set contains only safe metric names.

These tests are self-contained and only exercise the registry module's
exported sets and helper function, without requiring the full
metadata.generated schema build.

See: https://github.com/open-metadata/OpenMetadata/issues/15627
"""

import importlib
import os
import sys
from unittest import TestCase

import sqlalchemy
from sqlalchemy import JSON
from sqlalchemy.types import NullType


def _import_registry():
    """Import the ORM registry module, ensuring the generated schema
    dependency is available. On local dev environments where
    ``metadata.generated`` may not exist, we create a lightweight stub
    so that ``metadata.profiler.orm.registry`` can be loaded without
    executing the full Maven build pipeline.
    """

    src_dir = os.path.join(
        os.path.dirname(__file__),
        os.pardir,
        os.pardir,
        os.pardir,
        os.pardir,
        "src",
    )
    src_dir = os.path.normpath(src_dir)

    # Ensure the ingestion source root is on sys.path
    if src_dir not in sys.path:
        sys.path.insert(0, src_dir)

    # If metadata.generated is already importable, use it directly.
    try:
        import metadata.generated.schema.entity.data.table  # noqa: F401
    except (ImportError, ModuleNotFoundError, SyntaxError):
        # Provide a minimal stub for DataType so the registry can load.
        _bootstrap_generated_stub(src_dir)

    # Now import what we need.
    from metadata.ingestion.source.sqa_types import (
        SQAMap,
        SQASet,
        SQASGeography,
        SQAStruct,
        SQAUnion,
    )
    from metadata.profiler.orm.registry import (
        COMPLEX_TYPE_METRICS,
        COMPLEX_TYPES,
        NOT_COMPUTE,
        is_complex_type,
    )
    from metadata.profiler.orm.types.custom_array import CustomArray
    from metadata.profiler.orm.types.custom_datetimerange import CustomDateTimeRange
    from metadata.profiler.orm.types.undetermined_type import UndeterminedType

    return {
        "NOT_COMPUTE": NOT_COMPUTE,
        "COMPLEX_TYPES": COMPLEX_TYPES,
        "COMPLEX_TYPE_METRICS": COMPLEX_TYPE_METRICS,
        "is_complex_type": is_complex_type,
        "SQAMap": SQAMap,
        "SQASet": SQASet,
        "SQASGeography": SQASGeography,
        "SQAStruct": SQAStruct,
        "SQAUnion": SQAUnion,
        "CustomArray": CustomArray,
        "CustomDateTimeRange": CustomDateTimeRange,
        "UndeterminedType": UndeterminedType,
    }


def _bootstrap_generated_stub(src_dir):
    """Creates minimal stubs for metadata.generated so that the
    orm.registry module can be imported in environments where
    the full code-generation pipeline has not been run.
    """
    from enum import Enum
    from types import ModuleType

    # Create the DataType enum with values the registry references.
    class DataType(str, Enum):
        INT = "INT"
        BIGINT = "BIGINT"
        SMALLINT = "SMALLINT"
        TINYINT = "TINYINT"
        NUMBER = "NUMBER"
        NUMERIC = "NUMERIC"
        DECIMAL = "DECIMAL"
        DOUBLE = "DOUBLE"
        FLOAT = "FLOAT"
        JSON = "JSON"
        ARRAY = "ARRAY"
        MAP = "MAP"
        STRUCT = "STRUCT"
        UNION = "UNION"
        SET = "SET"
        GEOGRAPHY = "GEOGRAPHY"
        GEOMETRY = "GEOMETRY"
        ENUM = "ENUM"
        STRING = "STRING"
        TEXT = "TEXT"
        CHAR = "CHAR"
        VARCHAR = "VARCHAR"
        BOOLEAN = "BOOLEAN"
        DATE = "DATE"
        DATETIME = "DATETIME"
        TIMESTAMP = "TIMESTAMP"
        TIME = "TIME"
        BINARY = "BINARY"
        VARBINARY = "VARBINARY"
        BLOB = "BLOB"
        BYTEA = "BYTEA"
        MEDIUMTEXT = "MEDIUMTEXT"
        NULL = "NULL"
        SUPER = "SUPER"
        INTERVAL = "INTERVAL"
        XML = "XML"
        FIXED = "FIXED"

    # Wire up stub modules in sys.modules
    for mod_name in [
        "metadata.generated",
        "metadata.generated.schema",
        "metadata.generated.schema.entity",
        "metadata.generated.schema.entity.data",
        "metadata.generated.schema.entity.data.table",
        "metadata.generated.schema.configuration",
        "metadata.generated.schema.configuration.profilerConfiguration",
        "metadata.generated.schema.api",
        "metadata.generated.schema.api.data",
        "metadata.generated.schema.api.data.createTableProfile",
        "metadata.generated.schema.entity.services",
        "metadata.generated.schema.entity.services.databaseService",
        "metadata.generated.schema.entity.services.connections",
        "metadata.generated.schema.entity.services.connections.database",
        "metadata.generated.schema.entity.services.connections.database.sqliteConnection",
        "metadata.generated.schema.entity.services.connections.metadata",
        "metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection",
        "metadata.generated.schema.settings",
        "metadata.generated.schema.settings.settings",
        "metadata.generated.schema.tests",
        "metadata.generated.schema.tests.customMetric",
        "metadata.generated.schema.type",
        "metadata.generated.schema.type.basic",
    ]:
        if mod_name not in sys.modules:
            stub = ModuleType(mod_name)
            sys.modules[mod_name] = stub

    # Populate the table stub with DataType
    table_stub = sys.modules["metadata.generated.schema.entity.data.table"]
    table_stub.DataType = DataType
    table_stub.Column = None
    table_stub.ColumnName = None
    table_stub.Table = None
    table_stub.ColumnProfilerConfig = None
    table_stub.TableType = type("TableType", (), {"Regular": "Regular", "View": "View"})

    # Populate profiler config stub with MetricType
    class MetricType(str, Enum):
        valuesCount = "valuesCount"
        nullCount = "nullCount"
        nullProportion = "nullProportion"
        uniqueCount = "uniqueCount"
        distinctCount = "distinctCount"
        distinctProportion = "distinctProportion"
        min = "min"
        max = "max"
        mean = "mean"
        sum = "sum"
        stddev = "stddev"
        median = "median"
        firstQuartile = "firstQuartile"
        thirdQuartile = "thirdQuartile"
        interQuartileRange = "interQuartileRange"
        nonParametricSkew = "nonParametricSkew"
        columnCount = "columnCount"
        columnNames = "columnNames"
        rowCount = "rowCount"
        histogram = "histogram"
        uniqueProportion = "uniqueProportion"
        duplicateCount = "duplicateCount"
        nullMissingCount = "nullMissingCount"
        system = "system"

    profiler_config_stub = sys.modules[
        "metadata.generated.schema.configuration.profilerConfiguration"
    ]
    profiler_config_stub.MetricType = MetricType
    profiler_config_stub.MetricConfigurationDefinition = None

    # Populate settings stub
    settings_stub = sys.modules["metadata.generated.schema.settings.settings"]
    settings_stub.Settings = None

    # Populate createTableProfile stub
    create_stub = sys.modules["metadata.generated.schema.api.data.createTableProfile"]
    create_stub.CreateTableProfileRequest = None

    # Populate databaseService stub
    db_service_stub = sys.modules[
        "metadata.generated.schema.entity.services.databaseService"
    ]
    db_service_stub.DatabaseService = None

    # Populate basic stub
    basic_stub = sys.modules["metadata.generated.schema.type.basic"]
    basic_stub.Uuid = str

    # Populate custom metric stub
    custom_metric_stub = sys.modules["metadata.generated.schema.tests.customMetric"]
    custom_metric_stub.CustomMetric = None


# ---- Load registry (with stubs if needed) ----
_reg = _import_registry()
NOT_COMPUTE = _reg["NOT_COMPUTE"]
COMPLEX_TYPES = _reg["COMPLEX_TYPES"]
COMPLEX_TYPE_METRICS = _reg["COMPLEX_TYPE_METRICS"]
is_complex_type = _reg["is_complex_type"]
SQAMap = _reg["SQAMap"]
SQASet = _reg["SQASet"]
SQASGeography = _reg["SQASGeography"]
SQAStruct = _reg["SQAStruct"]
SQAUnion = _reg["SQAUnion"]
CustomArray = _reg["CustomArray"]
CustomDateTimeRange = _reg["CustomDateTimeRange"]
UndeterminedType = _reg["UndeterminedType"]


# ============================================================================
# Test Cases
# ============================================================================


class TestNotComputeSetContent(TestCase):
    """Verify NOT_COMPUTE only contains truly unprofileable types."""

    def test_not_compute_contains_null_type(self):
        """NullType should remain in NOT_COMPUTE."""
        self.assertIn(NullType.__name__, NOT_COMPUTE)

    def test_not_compute_contains_undetermined_type(self):
        """UndeterminedType should remain in NOT_COMPUTE."""
        self.assertIn(UndeterminedType.__name__, NOT_COMPUTE)

    def test_not_compute_has_only_two_entries(self):
        """NOT_COMPUTE should only have NullType and UndeterminedType."""
        self.assertEqual(len(NOT_COMPUTE), 2)

    def test_json_not_in_not_compute(self):
        """JSON should NOT be in NOT_COMPUTE (moved to COMPLEX_TYPES)."""
        self.assertNotIn(JSON.__name__, NOT_COMPUTE)

    def test_array_not_in_not_compute(self):
        """ARRAY should NOT be in NOT_COMPUTE (moved to COMPLEX_TYPES)."""
        self.assertNotIn(sqlalchemy.ARRAY.__name__, NOT_COMPUTE)

    def test_geometry_not_in_not_compute(self):
        """GEOMETRY should NOT be in NOT_COMPUTE (moved to COMPLEX_TYPES)."""
        self.assertNotIn("GEOMETRY", NOT_COMPUTE)

    def test_geography_not_in_not_compute(self):
        """SQASGeography should NOT be in NOT_COMPUTE (moved to COMPLEX_TYPES)."""
        self.assertNotIn(SQASGeography.__name__, NOT_COMPUTE)


class TestComplexTypesSetContent(TestCase):
    """Verify COMPLEX_TYPES contains all expected complex data types."""

    def test_json_in_complex_types(self):
        """JSON (sqlalchemy) should be in COMPLEX_TYPES."""
        self.assertIn(JSON.__name__, COMPLEX_TYPES)

    def test_array_in_complex_types(self):
        """ARRAY (sqlalchemy) should be in COMPLEX_TYPES."""
        self.assertIn(sqlalchemy.ARRAY.__name__, COMPLEX_TYPES)

    def test_custom_array_in_complex_types(self):
        """CustomArray should be in COMPLEX_TYPES."""
        self.assertIn(CustomArray.__name__, COMPLEX_TYPES)

    def test_sqa_map_in_complex_types(self):
        """SQAMap should be in COMPLEX_TYPES."""
        self.assertIn(SQAMap.__name__, COMPLEX_TYPES)

    def test_sqa_struct_in_complex_types(self):
        """SQAStruct should be in COMPLEX_TYPES."""
        self.assertIn(SQAStruct.__name__, COMPLEX_TYPES)

    def test_sqa_set_in_complex_types(self):
        """SQASet should be in COMPLEX_TYPES."""
        self.assertIn(SQASet.__name__, COMPLEX_TYPES)

    def test_sqa_union_in_complex_types(self):
        """SQAUnion should be in COMPLEX_TYPES."""
        self.assertIn(SQAUnion.__name__, COMPLEX_TYPES)

    def test_sqa_geography_in_complex_types(self):
        """SQASGeography should be in COMPLEX_TYPES."""
        self.assertIn(SQASGeography.__name__, COMPLEX_TYPES)

    def test_geometry_in_complex_types(self):
        """GEOMETRY should be in COMPLEX_TYPES."""
        self.assertIn("GEOMETRY", COMPLEX_TYPES)

    def test_xml_in_complex_types(self):
        """XML should be in COMPLEX_TYPES."""
        self.assertIn("XML", COMPLEX_TYPES)

    def test_datetimerange_in_complex_types(self):
        """CustomDateTimeRange should be in COMPLEX_TYPES."""
        self.assertIn(CustomDateTimeRange.__name__, COMPLEX_TYPES)


class TestIsComplexTypeHelper(TestCase):
    """Verify the is_complex_type helper function."""

    def test_json_is_complex(self):
        self.assertTrue(is_complex_type(JSON.__name__))

    def test_array_is_complex(self):
        self.assertTrue(is_complex_type(sqlalchemy.ARRAY.__name__))

    def test_sqa_struct_is_complex(self):
        self.assertTrue(is_complex_type(SQAStruct.__name__))

    def test_sqa_geography_is_complex(self):
        self.assertTrue(is_complex_type(SQASGeography.__name__))

    def test_null_type_is_not_complex(self):
        self.assertFalse(is_complex_type(NullType.__name__))

    def test_undetermined_is_not_complex(self):
        self.assertFalse(is_complex_type(UndeterminedType.__name__))

    def test_integer_is_not_complex(self):
        self.assertFalse(is_complex_type("Integer"))

    def test_string_is_not_complex(self):
        self.assertFalse(is_complex_type("String"))

    def test_empty_string_is_not_complex(self):
        self.assertFalse(is_complex_type(""))


class TestComplexTypeMetricsSet(TestCase):
    """Verify COMPLEX_TYPE_METRICS contains the expected safe metrics."""

    def test_null_count_in_safe_metrics(self):
        self.assertIn("nullCount", COMPLEX_TYPE_METRICS)

    def test_values_count_in_safe_metrics(self):
        self.assertIn("valuesCount", COMPLEX_TYPE_METRICS)

    def test_mean_not_in_safe_metrics(self):
        self.assertNotIn("mean", COMPLEX_TYPE_METRICS)

    def test_min_not_in_safe_metrics(self):
        self.assertNotIn("min", COMPLEX_TYPE_METRICS)

    def test_max_not_in_safe_metrics(self):
        self.assertNotIn("max", COMPLEX_TYPE_METRICS)

    def test_stddev_not_in_safe_metrics(self):
        self.assertNotIn("stddev", COMPLEX_TYPE_METRICS)

    def test_distinct_count_not_in_safe_metrics(self):
        self.assertNotIn("distinctCount", COMPLEX_TYPE_METRICS)

    def test_unique_count_not_in_safe_metrics(self):
        self.assertNotIn("uniqueCount", COMPLEX_TYPE_METRICS)

    def test_sum_not_in_safe_metrics(self):
        self.assertNotIn("sum", COMPLEX_TYPE_METRICS)

    def test_safe_metrics_has_exactly_two_entries(self):
        self.assertEqual(len(COMPLEX_TYPE_METRICS), 2)


class TestNoOverlapBetweenSets(TestCase):
    """Verify NOT_COMPUTE and COMPLEX_TYPES don't overlap."""

    def test_no_overlap(self):
        overlap = NOT_COMPUTE & COMPLEX_TYPES
        self.assertEqual(
            len(overlap),
            0,
            f"Found overlap between NOT_COMPUTE and COMPLEX_TYPES: {overlap}",
        )

    def test_regular_types_not_in_either_set(self):
        """Common types like Integer, String should not be in either set."""
        regular_types = ["Integer", "String", "Float", "Boolean", "Date"]
        for type_name in regular_types:
            self.assertNotIn(
                type_name, NOT_COMPUTE, f"{type_name} found in NOT_COMPUTE"
            )
            self.assertNotIn(
                type_name, COMPLEX_TYPES, f"{type_name} found in COMPLEX_TYPES"
            )
