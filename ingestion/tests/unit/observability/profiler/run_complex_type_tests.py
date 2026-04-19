"""
Standalone test runner for complex type profiling changes.

Uses a sys.meta_path finder to intercept ALL metadata.generated.*
imports, returning permissive stubs. The 'metadata' package itself is
replaced with a bare module so its __init__.py never runs.

Usage: python run_complex_type_tests.py
See: https://github.com/open-metadata/OpenMetadata/issues/15627
"""

import sys
import os
import logging
import importlib
from types import ModuleType
from enum import Enum

# ── Prevent script dir from shadowing real packages ──────────────────
_script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path = [p for p in sys.path if os.path.abspath(p) != _script_dir]

# ── Ensure ingestion/src is on path ──────────────────────────────────
_src_dir = os.path.normpath(os.path.join(_script_dir, "..", "..", "..", "..", "src"))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


# ════════════════════════════════════════════════════════════════════════
# 1) Install 'metadata' as a bare package (skip its __init__.py)
# ════════════════════════════════════════════════════════════════════════
_meta_pkg = ModuleType("metadata")
_meta_pkg.__path__ = [os.path.join(_src_dir, "metadata")]
_meta_pkg.__package__ = "metadata"
sys.modules["metadata"] = _meta_pkg


# ════════════════════════════════════════════════════════════════════════
# 2) Meta-path finder: auto-stub ALL metadata.generated.* imports
# ════════════════════════════════════════════════════════════════════════
_null_logger = logging.getLogger("stub")


class _StubModule(ModuleType):
    """A stub module whose attributes are either explicitly set or
    fall back to a dummy class that has .__name__, is iterable, etc."""

    class _Dummy:
        __name__ = "_Dummy"
        def __init_subclass__(cls, **kw): pass
        def __init__(self, *a, **kw): pass
        def __call__(self, *a, **kw): return self
        def __iter__(self): return iter([])
        def __bool__(self): return False
        def __str__(self): return "_Dummy"
        def items(self): return []
        def values(self): return []
        def keys(self): return []

    def __getattr__(self, name):
        # Return the class (not an instance) so it can be used as a
        # type annotation, base class, or called to construct instances.
        return _StubModule._Dummy


class _GeneratedFinder:
    """Intercepts `import metadata.generated.*` and returns stubs."""
    PREFIX = "metadata.generated"

    def find_module(self, fullname, path=None):
        if fullname == self.PREFIX or fullname.startswith(self.PREFIX + "."):
            return self
        return None

    def load_module(self, fullname):
        if fullname in sys.modules:
            return sys.modules[fullname]
        mod = _StubModule(fullname)
        mod.__path__ = []
        mod.__package__ = fullname
        mod.__loader__ = self
        sys.modules[fullname] = mod
        return mod


sys.meta_path.insert(0, _GeneratedFinder())


# ════════════════════════════════════════════════════════════════════════
# 3) Populate the stubs that our code ACTUALLY reads values from
# ════════════════════════════════════════════════════════════════════════

class DataType(str, Enum):
    INT="INT"; BIGINT="BIGINT"; SMALLINT="SMALLINT"; TINYINT="TINYINT"
    NUMBER="NUMBER"; NUMERIC="NUMERIC"; DECIMAL="DECIMAL"
    DOUBLE="DOUBLE"; FLOAT="FLOAT"; JSON="JSON"; ARRAY="ARRAY"
    MAP="MAP"; STRUCT="STRUCT"; UNION="UNION"; SET="SET"
    GEOGRAPHY="GEOGRAPHY"; GEOMETRY="GEOMETRY"; ENUM="ENUM"
    STRING="STRING"; TEXT="TEXT"; CHAR="CHAR"; VARCHAR="VARCHAR"
    BOOLEAN="BOOLEAN"; DATE="DATE"; DATETIME="DATETIME"
    TIMESTAMP="TIMESTAMP"; TIME="TIME"; BINARY="BINARY"
    VARBINARY="VARBINARY"; BLOB="BLOB"; BYTEA="BYTEA"
    MEDIUMTEXT="MEDIUMTEXT"; NULL="NULL"; SUPER="SUPER"
    INTERVAL="INTERVAL"; XML="XML"; FIXED="FIXED"
    LONG="LONG"; BYTES="BYTES"

class MetricType(str, Enum):
    valuesCount="valuesCount"; nullCount="nullCount"
    nullProportion="nullProportion"; uniqueCount="uniqueCount"
    distinctCount="distinctCount"; distinctProportion="distinctProportion"
    min="min"; max="max"; mean="mean"; sum="sum"; stddev="stddev"
    median="median"; firstQuartile="firstQuartile"
    thirdQuartile="thirdQuartile"
    interQuartileRange="interQuartileRange"
    nonParametricSkew="nonParametricSkew"
    columnCount="columnCount"; columnNames="columnNames"
    rowCount="rowCount"; histogram="histogram"
    uniqueProportion="uniqueProportion"
    duplicateCount="duplicateCount"
    nullMissingCount="nullMissingCount"; system="system"

# Force-create the table module via the finder, then populate it
importlib.import_module("metadata.generated.schema.entity.data.table")
_table = sys.modules["metadata.generated.schema.entity.data.table"]
_table.DataType = DataType
_table.Table = type("Table", (), {})
_table.Column = type("Column", (), {})
_table.ColumnName = str
_table.ColumnProfilerConfig = None
_table.TableData = None
_table.TableType = type("TableType", (), {"Regular": "Regular", "View": "View"})

importlib.import_module("metadata.generated.schema.configuration.profilerConfiguration")
_pc = sys.modules["metadata.generated.schema.configuration.profilerConfiguration"]
_pc.MetricType = MetricType
_pc.MetricConfigurationDefinition = type("MetricConfigurationDefinition", (), {})


# ════════════════════════════════════════════════════════════════════════
# 4) Stub metadata.utils.logger to break the biggest import cycle
# ════════════════════════════════════════════════════════════════════════
# logger.py triggers data_quality, ometa, constants, etc. We replace it.
_logger_stub = ModuleType("metadata.utils.logger")
_logger_stub.__package__ = "metadata.utils"
_logger_stub.profiler_logger  = lambda: _null_logger
_logger_stub.ingestion_logger = lambda: _null_logger
_logger_stub.utils_logger     = lambda: _null_logger
_logger_stub.ometa_logger     = lambda: _null_logger
_logger_stub.set_loggers_level = lambda *a, **kw: None
_logger_stub.get_log_name = lambda x: str(x)

# Ensure parent packages exist
for pkg in ["metadata.utils"]:
    if pkg not in sys.modules:
        m = ModuleType(pkg)
        m.__path__ = [os.path.join(_src_dir, pkg.replace(".", os.sep))]
        m.__package__ = pkg
        sys.modules[pkg] = m

sys.modules["metadata.utils.logger"] = _logger_stub


# ════════════════════════════════════════════════════════════════════════
# 5) Now import the REAL modules under test
# ════════════════════════════════════════════════════════════════════════
import sqlalchemy
from sqlalchemy import JSON
from sqlalchemy.types import NullType

from metadata.profiler.orm.registry import (
    COMPLEX_TYPE_METRICS,
    COMPLEX_TYPES,
    NOT_COMPUTE,
    is_complex_type,
)
from metadata.ingestion.source.sqa_types import (
    SQAMap, SQASet, SQASGeography, SQAStruct, SQAUnion,
)
from metadata.profiler.orm.types.custom_array import CustomArray
from metadata.profiler.orm.types.custom_datetimerange import CustomDateTimeRange
from metadata.profiler.orm.types.undetermined_type import UndeterminedType


# ════════════════════════════════════════════════════════════════════════
# Test runner
# ════════════════════════════════════════════════════════════════════════
_passed = _failed = 0
_errors = []

def check(name, cond):
    global _passed, _failed
    if cond:
        _passed += 1; print(f"  PASS  {name}")
    else:
        _failed += 1; _errors.append(name); print(f"  FAIL  {name}")

def section(title):
    print(f"\n{'='*60}\n {title}\n{'='*60}")

# ── 1. NOT_COMPUTE set ──────────────────────────────────────────────
section("NOT_COMPUTE set (should be minimal)")
check("NullType in NOT_COMPUTE",          NullType.__name__ in NOT_COMPUTE)
check("UndeterminedType in NOT_COMPUTE",  UndeterminedType.__name__ in NOT_COMPUTE)
check("exactly 2 entries",               len(NOT_COMPUTE) == 2)
check("JSON removed from NOT_COMPUTE",   JSON.__name__ not in NOT_COMPUTE)
check("ARRAY removed from NOT_COMPUTE",  sqlalchemy.ARRAY.__name__ not in NOT_COMPUTE)
check("GEOMETRY removed",                "GEOMETRY" not in NOT_COMPUTE)
check("SQASGeography removed",           SQASGeography.__name__ not in NOT_COMPUTE)

# ── 2. COMPLEX_TYPES set ────────────────────────────────────────────
section("COMPLEX_TYPES set (complex types getting limited metrics)")
check("JSON in COMPLEX_TYPES",           JSON.__name__ in COMPLEX_TYPES)
check("ARRAY in COMPLEX_TYPES",          sqlalchemy.ARRAY.__name__ in COMPLEX_TYPES)
check("CustomArray in COMPLEX_TYPES",    CustomArray.__name__ in COMPLEX_TYPES)
check("SQAMap in COMPLEX_TYPES",         SQAMap.__name__ in COMPLEX_TYPES)
check("SQAStruct in COMPLEX_TYPES",      SQAStruct.__name__ in COMPLEX_TYPES)
check("SQASet in COMPLEX_TYPES",         SQASet.__name__ in COMPLEX_TYPES)
check("SQAUnion in COMPLEX_TYPES",       SQAUnion.__name__ in COMPLEX_TYPES)
check("SQASGeography in COMPLEX_TYPES",  SQASGeography.__name__ in COMPLEX_TYPES)
check("GEOMETRY in COMPLEX_TYPES",       "GEOMETRY" in COMPLEX_TYPES)
check("XML in COMPLEX_TYPES",            "XML" in COMPLEX_TYPES)
check("DateTimeRange in COMPLEX_TYPES",  CustomDateTimeRange.__name__ in COMPLEX_TYPES)

# ── 3. is_complex_type helper ────────────────────────────────────────
section("is_complex_type() helper function")
check("JSON -> True",          is_complex_type(JSON.__name__))
check("ARRAY -> True",         is_complex_type(sqlalchemy.ARRAY.__name__))
check("SQAStruct -> True",     is_complex_type(SQAStruct.__name__))
check("SQASGeography -> True", is_complex_type(SQASGeography.__name__))
check("NullType -> False",     not is_complex_type(NullType.__name__))
check("Undetermined -> False", not is_complex_type(UndeterminedType.__name__))
check("Integer -> False",      not is_complex_type("Integer"))
check("String -> False",       not is_complex_type("String"))
check("empty -> False",        not is_complex_type(""))

# ── 4. COMPLEX_TYPE_METRICS ─────────────────────────────────────────
section("COMPLEX_TYPE_METRICS (safe metrics for complex types)")
check("nullCount is safe",       "nullCount" in COMPLEX_TYPE_METRICS)
check("valuesCount is safe",     "valuesCount" in COMPLEX_TYPE_METRICS)
check("mean is NOT safe",        "mean" not in COMPLEX_TYPE_METRICS)
check("min is NOT safe",         "min" not in COMPLEX_TYPE_METRICS)
check("max is NOT safe",         "max" not in COMPLEX_TYPE_METRICS)
check("stddev is NOT safe",      "stddev" not in COMPLEX_TYPE_METRICS)
check("distinctCount NOT safe",  "distinctCount" not in COMPLEX_TYPE_METRICS)
check("uniqueCount NOT safe",    "uniqueCount" not in COMPLEX_TYPE_METRICS)
check("sum is NOT safe",         "sum" not in COMPLEX_TYPE_METRICS)
check("exactly 2 safe metrics",  len(COMPLEX_TYPE_METRICS) == 2)

# ── 5. Set isolation ────────────────────────────────────────────────
section("Set isolation (no overlap, regular types excluded)")
check("no overlap NOT_COMPUTE <> COMPLEX_TYPES", len(NOT_COMPUTE & COMPLEX_TYPES) == 0)
for tp in ["Integer", "String", "Float", "Boolean", "Date"]:
    check(f"{tp} not in NOT_COMPUTE",   tp not in NOT_COMPUTE)
    check(f"{tp} not in COMPLEX_TYPES", tp not in COMPLEX_TYPES)

# ── Summary ─────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f" RESULTS: {_passed} passed, {_failed} failed")
print(f"{'='*60}")
if _failed:
    print("\nFailed tests:")
    for e in _errors: print(f"  - {e}")
    sys.exit(1)
else:
    print(f"\n ALL {_passed} TESTS PASSED!")
