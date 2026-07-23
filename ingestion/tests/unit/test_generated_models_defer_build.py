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
    # Fresh interpreter: __pydantic_complete__ flips to True on first validation.
    result = subprocess.run(
        [sys.executable, "-c", _DEFER_PROBE],
        capture_output=True,
        text=True,
        check=False,
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
