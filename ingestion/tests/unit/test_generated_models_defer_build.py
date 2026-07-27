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
"""Guards for defer_build=True on the generated-model base class."""

import importlib
import os
import pkgutil
import subprocess
import sys

import metadata.generated.schema as generated_schema
from metadata.ingestion.models.custom_pydantic import BaseModel

_DEFER_PROBE = """
import warnings

warnings.filterwarnings("ignore")
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.models.custom_pydantic import BaseModel

assert BaseModel.model_config.get("defer_build") is True, "base model_config missing defer_build"
assert Table.model_config.get("defer_build") is True, "generated model does not inherit defer_build"
assert Table.__pydantic_complete__ is False, "generated model schema was built eagerly at import"
print("OK")
"""

_DISABLE_PROBE = """
import warnings

warnings.filterwarnings("ignore")
from metadata.generated.schema.entity.data.table import Table

assert Table.model_config.get("defer_build") is False, "OM_PYDANTIC_DEFER_BUILD=0 did not disable defer_build"
print("OK")
"""


def _collect_generated_model_classes() -> dict:
    """Return {qualified_name: class} for importable generated BaseModel subclasses."""
    for module_info in pkgutil.walk_packages(
        generated_schema.__path__,
        prefix="metadata.generated.schema.",
        onerror=lambda _name: None,
    ):
        # Import failures (circular imports, RootModel/extra codegen bug) are
        # defer_build-independent and orthogonal to schema buildability.
        try:
            importlib.import_module(module_info.name)
        except Exception:
            continue

    classes = {}
    for module_name, module in list(sys.modules.items()):
        if not module_name.startswith("metadata.generated"):
            continue
        for obj in vars(module).values():
            if isinstance(obj, type) and issubclass(obj, BaseModel) and obj is not BaseModel:
                classes[f"{obj.__module__}.{obj.__qualname__}"] = obj
    return classes


def test_all_generated_models_are_buildable():
    """Every importable generated model builds its pydantic-core schema."""
    build_failures = []
    for qualified_name, model_class in _collect_generated_model_classes().items():
        # force=True is the only path that raises a clean, named build error:
        # __pydantic_validator__ returns a MockValSer without raising, and a second
        # model_json_schema() on a failing class raises an opaque internal error.
        try:
            model_class.model_rebuild(force=True)
        except Exception as err:
            build_failures.append(f"{qualified_name}: {err!r}")

    assert not build_failures, "generated models failed to build their schema:\n" + "\n".join(build_failures)


def test_generated_models_defer_build_is_enabled():
    """A generated model inherits defer_build and is unbuilt at import."""
    # Fresh interpreter (completeness flips on first validation) with the toggle
    # unset, so this asserts the default rather than an ambient OM_PYDANTIC_DEFER_BUILD.
    env = {key: value for key, value in os.environ.items() if key != "OM_PYDANTIC_DEFER_BUILD"}
    result = subprocess.run(
        [sys.executable, "-c", _DEFER_PROBE],
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )
    assert result.returncode == 0, f"defer_build probe failed:\n{result.stdout}\n{result.stderr}"
    assert result.stdout.strip().endswith("OK")


def test_defer_build_env_var_disables_it():
    """OM_PYDANTIC_DEFER_BUILD=0 turns defer_build off."""
    result = subprocess.run(
        [sys.executable, "-c", _DISABLE_PROBE],
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "OM_PYDANTIC_DEFER_BUILD": "0"},
    )
    assert result.returncode == 0, f"disable probe failed:\n{result.stdout}\n{result.stderr}"
    assert result.stdout.strip().endswith("OK")


_NESTED_DUMP_PROBE = """
import warnings

warnings.filterwarnings("ignore")

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Source,
)

assert Source.__pydantic_complete__ is False, "Source was built eagerly at import"

config = OpenMetadataWorkflowConfig.model_validate({
    "source": {
        "type": "snowflake",
        "serviceName": "e2e_defer_build_probe",
        "serviceConnection": {
            "config": {
                "type": "Snowflake",
                "username": "u",
                "password": "p",
                "account": "a",
                "warehouse": "w",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
})

# Validating the parent composes Source into the parent's schema, so Source
# itself stays unbuilt. This is the state MetadataWorkflow._get_source sees.
assert Source.__pydantic_complete__ is False, "nested Source built by parent validation"

dumped = config.source.model_dump()
assert dumped["type"] == "snowflake"
assert dumped["serviceName"] == "e2e_defer_build_probe"
assert Source.__pydantic_complete__ is True, "model_dump left the nested class unbuilt"
print("OK")
"""


def test_nested_model_dump_after_parent_validation_is_defer_build_safe():
    """
    Dumping a nested model whose class defer_build left unbuilt must work.

    ``MetadataWorkflow._get_source`` calls ``self.config.source.model_dump()``.
    Under defer_build=True the nested ``Source`` class never has its own
    class-level schema built — the validated parent's schema handles it by
    composition — so serialization has to go through a deferred serializer.
    The nightly CLI E2E runs hit
    ``'MockValSer' object cannot be converted to 'SchemaSerializer'`` on exactly
    this path when pydantic's own lazy rebuild fails to resolve the generated
    forward references.

    Runs in a subprocess so the probe starts from an unbuilt Source class.
    """
    result = subprocess.run(
        [sys.executable, "-c", _NESTED_DUMP_PROBE],
        capture_output=True,
        text=True,
        check=False,
        env=os.environ,
    )
    assert result.returncode == 0, f"nested-dump probe failed:\n{result.stdout}\n{result.stderr}"
    assert result.stdout.strip().endswith("OK")
