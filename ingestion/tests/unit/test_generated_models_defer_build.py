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

_SERIALIZE_PROBE = """
import warnings

warnings.filterwarnings("ignore")
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import Source

assert SnowflakeConnection.__pydantic_complete__ is False, "connection schema was built eagerly at import"

# Nothing here builds the nested models' own schema: validating Source goes through
# the members pydantic inlined into the parent. Dumping the parent then falls back to
# reading the serializer off the nested class, which is where a deferred model that was
# never built surfaces as a MockValSer.
source = Source.model_validate(
    {
        "type": "snowflake",
        "serviceName": "test",
        "serviceConnection": {
            "config": {
                "type": "Snowflake",
                "account": "account",
                "username": "username",
                "password": "password",
                "warehouse": "warehouse",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }
)
dumped = source.model_dump()
assert dumped["serviceConnection"]["config"]["account"] == "account"
print("OK")
"""

_CONCURRENT_REBUILD_PROBE = """
import sys
import threading
import time
import warnings

from pydantic import ConfigDict

from metadata.ingestion.models.custom_pydantic import BaseModel

warnings.filterwarnings("ignore")
thread_count = 8
wait_seconds = 10
expected = {"value": "ok"}
original_interval = sys.getswitchinterval()
sys.setswitchinterval(1e-6)
try:
    for round_number in range(200):
        class DeferredModel(BaseModel):
            model_config = ConfigDict(defer_build=True)

            value: str

        assert DeferredModel.__pydantic_complete__ is False
        start_gate = threading.Barrier(thread_count + 1, timeout=wait_seconds)
        results = [None] * thread_count
        failures = []

        def validate(worker_number):
            try:
                start_gate.wait()
                results[worker_number] = DeferredModel.model_validate(expected).model_dump()
            except Exception as exc:
                failures.append(f"worker {worker_number}: {exc!r}")

        workers = [
            threading.Thread(target=validate, args=(worker_number,), daemon=True)
            for worker_number in range(thread_count)
        ]
        for worker in workers:
            worker.start()
        try:
            start_gate.wait()
        except threading.BrokenBarrierError as exc:
            failures.append(f"main thread: {exc!r}")

        deadline = time.monotonic() + wait_seconds
        for worker in workers:
            worker.join(timeout=max(0, deadline - time.monotonic()))

        stuck_workers = [worker.name for worker in workers if worker.is_alive()]
        assert not stuck_workers, f"round {round_number}: workers did not finish: {stuck_workers}"
        assert not failures, f"round {round_number}: concurrent rebuild failed: {failures[:3]}"
        assert results == [expected] * thread_count
        assert DeferredModel.__pydantic_complete__ is True
finally:
    sys.setswitchinterval(original_interval)

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


def test_deferred_nested_models_are_serializable():
    """Dumping a parent reaches nested models whose own schema was never built."""
    # Fresh interpreter with the toggle unset, for the same reasons as the probe above:
    # completeness flips on first use, and this has to assert the default.
    env = {key: value for key, value in os.environ.items() if key != "OM_PYDANTIC_DEFER_BUILD"}
    result = subprocess.run(
        [sys.executable, "-c", _SERIALIZE_PROBE],
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )
    assert result.returncode == 0, f"serialization probe failed:\n{result.stdout}\n{result.stderr}"
    assert result.stdout.strip().endswith("OK")


def test_concurrent_first_instantiation_is_safe():
    """Threads racing a deferred model's first build never observe a half-rebuilt class."""
    # Keep the forced scheduler pressure from racing Python 3.10's coverage thread hook.
    env = {key: value for key, value in os.environ.items() if not key.startswith(("COV_CORE_", "COVERAGE_"))}
    result = subprocess.run(
        [sys.executable, "-c", _CONCURRENT_REBUILD_PROBE],
        capture_output=True,
        text=True,
        check=False,
        env=env,
        timeout=60,
    )
    assert result.returncode == 0, f"concurrent rebuild probe failed:\n{result.stdout}\n{result.stderr}"
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
