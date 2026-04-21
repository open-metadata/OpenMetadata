"""
Standalone test runner for the DQ RCA unit tests.

Why this exists:
    metadata/__init__.py immediately imports ProfilerProcessorConfig,
    DependencyContainer, and other modules requiring generated schema code
    (metadata.generated.schema.*) which only exists after a Maven build step.
    Without that step the entire import cascade fails and blocks pytest.

Strategy (two layers):
    1. Stub the `metadata` package itself: replace sys.modules['metadata']
       with a minimal ModuleType whose __path__ points at the real source
       tree.  Sub-package imports still resolve from the filesystem, but
       metadata/__init__.py is NEVER executed.

    2. Install a MetaPathFinder that intercepts every metadata.generated.*
       import and returns an _AutoStubModule.  Each attribute on that module
       (e.g. TestCaseParameterValue) becomes a unique class subclassing
       _StubClass, which provides:
         - __get_pydantic_core_schema__ → any_schema()  (Pydantic v2 accepts it)
         - _StubMeta.__getattr__        → cached MagicMock (enum-style access)
         - __init__ / __getattr__       → flexible construction and access

Usage (from ingestion/ directory):
    python run_rca_tests.py
"""

import importlib.abc
import importlib.machinery
import os
import sys
import types
from unittest.mock import MagicMock


# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 1 — Stub the `metadata` package to skip __init__.py
# ═══════════════════════════════════════════════════════════════════════════════

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_METADATA_ROOT = os.path.join(_SCRIPT_DIR, "src", "metadata")

_metadata_pkg = types.ModuleType("metadata")
_metadata_pkg.__path__ = [_METADATA_ROOT]   # lets sub-package lookup still work
_metadata_pkg.__package__ = "metadata"
_metadata_pkg.__spec__ = None
sys.modules["metadata"] = _metadata_pkg


# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 2 — Pydantic-compatible stub classes + MetaPathFinder
# ═══════════════════════════════════════════════════════════════════════════════

class _StubMeta(type):
    """
    Metaclass for stub schema classes.
    Enables class-level attribute access, e.g.:
        TestCaseStatus.Failed   →  MagicMock (cached per name)
    This makes equality comparisons in production code stable across calls.
    """
    def __getattr__(cls, name: str) -> MagicMock:
        mock = MagicMock(name=f"{cls.__name__}.{name}")
        setattr(cls, name, mock)    # cache so the same Mock is returned always
        return mock


class _StubClass(metaclass=_StubMeta):
    """
    A stub for any generated-schema entity (TestCase, TestCaseResult, etc.).

    Pydantic v2 field type:  __get_pydantic_core_schema__ → any_schema()
    Instantiation:           accepts **kwargs, stores them as instance attrs
    Instance attribute:      unknown names return a cached MagicMock
    Class attribute:         handled by _StubMeta → cached MagicMock
    """

    def __init__(self, *args, **kwargs):
        for k, v in kwargs.items():
            object.__setattr__(self, k, v)

    def __getattr__(self, name: str) -> MagicMock:
        mock = MagicMock(name=f"<{type(self).__name__}>.{name}")
        object.__setattr__(self, name, mock)
        return mock

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema
        return core_schema.any_schema()

    def model_dump(self, *args, **kwargs):
        return {}

    def __repr__(self):
        return f"<Stub {type(self).__name__}>"


class _AutoStubModule(types.ModuleType):
    """
    A module where every attribute access creates a unique _StubClass subclass.
    Results are cached on the module object so repeated imports of the same
    name return the identical class object.
    """

    def __getattr__(self, name: str) -> type:
        stub_cls = _StubMeta(f"{self.__name__}.{name}", (_StubClass,), {})
        object.__setattr__(self, name, stub_cls)
        return stub_cls


class _GeneratedSchemaLoader(importlib.abc.Loader):
    """Loader that creates an _AutoStubModule for any metadata.generated.* name."""

    def __init__(self, fullname: str):
        self._fullname = fullname

    def create_module(self, spec):
        m = _AutoStubModule(self._fullname)
        m.__package__ = self._fullname
        m.__path__ = []         # mark as a package
        m.__spec__ = spec
        return m

    def exec_module(self, module):
        pass                    # nothing to execute



# Modules to intercept with stubs.  We stub anything we don't need for the
# RCA unit tests so that deep connector / ORM import chains never run.
_STUB_PREFIXES = (
    "metadata.generated",               # generated schema (primary reason)
    "metadata.data_quality.validations", # param_setter → tableCustomSQLQuery → ...
    "metadata.profiler",                # ORM profiler chains through DB connectors
    "metadata.ingestion.source",        # database connectors (database_service etc.)
    "metadata.ingestion.sink",
    "metadata.ingestion.bulksink",
)


class _GeneratedSchemaFinder(importlib.abc.MetaPathFinder):
    """
    Sits at the front of sys.meta_path and intercepts imports for all module
    prefixes in _STUB_PREFIXES, returning _AutoStubModule for each.
    """

    def find_spec(self, fullname, path, target=None):
        for prefix in _STUB_PREFIXES:
            if fullname == prefix or fullname.startswith(prefix + "."):
                loader = _GeneratedSchemaLoader(fullname)
                return importlib.machinery.ModuleSpec(
                    fullname, loader, is_package=True
                )
        return None


sys.meta_path.insert(0, _GeneratedSchemaFinder())


# ═══════════════════════════════════════════════════════════════════════════════
# Run
# ═══════════════════════════════════════════════════════════════════════════════

import pytest  # noqa: E402  (safe now — metadata/__init__.py is skipped)

if __name__ == "__main__":
    raise SystemExit(
        pytest.main(
            [
                "tests/unit/data_quality/rca/test_rca_agent.py",
                "tests/unit/data_quality/rca/test_signal_builder.py",
                "tests/unit/data_quality/rca/test_rca_integration.py",
                "-v",
                "--tb=short",
                "--no-header",
                "--noconftest",           # skip unit/ conftest (`import metadata`)
                "-p", "no:openmetadata",  # disable openmetadata pytest entrypoint
                "-p", "no:cacheprovider",
            ]
        )
    )
