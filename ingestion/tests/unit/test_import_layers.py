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
"""Gate the import-layer contract in CI, and cover the checker's own AST semantics."""

import ast
import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

_CHECKER = Path(__file__).resolve().parents[2] / "scripts" / "check_import_layers.py"


@pytest.fixture(scope="module")
def checker():
    spec = importlib.util.spec_from_file_location("check_import_layers", _CHECKER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_no_new_import_layer_violations():
    result = subprocess.run([sys.executable, str(_CHECKER)], capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stdout + result.stderr


def test_layer_of_assigns_by_longest_prefix(checker):
    assert checker.layer_of("metadata.generated.schema.entity.data.table") == "leaf"
    assert checker.layer_of("metadata.ingestion.ometa.ometa_api") == "client"
    assert checker.layer_of("metadata.ingestion.api.steps") == "framework"
    assert checker.layer_of("metadata.ingestion.source.database.snowflake.metadata") == "connectors"
    assert checker.layer_of("metadata.workflow.metadata") == "entrypoints"


@pytest.mark.parametrize(
    "source,expected",
    [
        ("import metadata.mod", ["metadata.mod"]),
        ("from metadata.pkg import thing", ["metadata.pkg"]),
        ("class K:\n    import metadata.mod", ["metadata.mod"]),
        (
            "try:\n    import metadata.mod\nexcept ImportError:\n    import metadata.other",
            ["metadata.mod", "metadata.other"],
        ),
        ("if True:\n    import metadata.mod", ["metadata.mod"]),
        ("def f():\n    import metadata.mod", []),
        ("async def f():\n    import metadata.mod", []),
        ("from typing import TYPE_CHECKING\nif TYPE_CHECKING:\n    import metadata.mod", []),
        ("import os", []),
    ],
    ids=[
        "module-scope",
        "from-import",
        "class-body-runs-on-import",
        "try-except-runs-on-import",
        "if-block-runs-on-import",
        "function-body-is-lazy",
        "async-function-body-is-lazy",
        "type-checking-guard-is-free",
        "non-metadata-ignored",
    ],
)
def test_module_scope_imports_detects_only_import_time_cost(checker, source, expected):
    found = sorted(module for module, _lineno in checker.module_scope_imports(ast.parse(source)))
    assert found == sorted(expected)
