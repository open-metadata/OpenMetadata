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
"""Enforce ingestion import layering: no module-scope import of a higher layer.

Reports violations not present in the recorded baseline, so the existing set can be
burned down without regressing. Run with --update-baseline after fixing violations.

We analyse the AST rather than using import-linter/grimp for two reasons: most
``metadata.*`` subpackages are PEP 420 namespace packages (Collate's
ingestion-extension merges connectors into them from a separate distribution), which
grimp skips; and only *module-scope* imports cost import time, whereas grimp counts
function-local imports as edges too.
"""

import argparse
import ast
import json
import sys
from pathlib import Path

_INGESTION_DIR = Path(__file__).resolve().parents[1]
_SRC = _INGESTION_DIR / "src"
_BASELINE = _INGESTION_DIR / "import_layers_baseline.json"

# Low to high. A module may import its own layer or a lower one, never a higher one:
# an edge upward drags the higher layer's whole subtree into every process that
# imports the lower one, which is what inflates `import metadata` peak RSS.
_LAYERS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("leaf", ("generated", "__version__")),
    (
        "client",
        (
            "ingestion.ometa",
            "ingestion.connections",
            "core",
            "clients",
            "config",
            "utils",
            "antlr",
            "models",
            "mixins",
            "timer",
            "domain",
        ),
    ),
    (
        "framework",
        (
            "ingestion.api",
            "ingestion.models",
            "ingestion.lineage",
            "ingestion.sink",
            "ingestion.stage",
            "ingestion.bulksink",
            "ingestion.processor",
            "ingestion.diagnostics",
            "ingestion.progress",
            "profiler",
            "data_quality",
            "sampler",
            "pii",
            "readers",
            "parsers",
            "great_expectations",
        ),
    ),
    ("connectors", ("ingestion.source",)),
    ("entrypoints", ("workflow", "cli", "automations", "applications", "sdk", "examples", "cmd", "__main__", "")),
)

_LAYER_RANK = {name: rank for rank, (name, _) in enumerate(_LAYERS)}


def layer_of(module: str) -> str:
    """Return the layer name owning ``module`` (longest matching prefix wins)."""
    rest = module[len("metadata.") :] if module.startswith("metadata.") else ""
    best, best_len = None, -1
    for name, prefixes in _LAYERS:
        for prefix in prefixes:
            matches = rest == prefix or (prefix and rest.startswith(prefix + "."))
            if matches and len(prefix) > best_len:
                best, best_len = name, len(prefix)
    return best or "entrypoints"


def _module_name(path: Path) -> str:
    parts = list(path.relative_to(_SRC).with_suffix("").parts)
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


def _is_type_checking_guard(node: ast.stmt) -> bool:
    if not isinstance(node, ast.If):
        return False
    test = node.test
    if isinstance(test, ast.Name):
        return test.id == "TYPE_CHECKING"
    return isinstance(test, ast.Attribute) and test.attr == "TYPE_CHECKING"


def module_scope_imports(tree: ast.Module, known_modules: frozenset[str] = frozenset()) -> list[tuple[str, int]]:
    """Return (imported_module, lineno) for ``metadata.*`` imports that run at import time.

    Descends into class bodies, ``try`` and ``if`` blocks (all execute on import) but
    not into function bodies, and skips ``if TYPE_CHECKING:`` guards. ``from p import n``
    resolves to ``p.n`` when that names a module in ``known_modules``.
    """
    found: list[tuple[str, int]] = []

    def walk(body: list[ast.stmt]) -> None:
        for node in body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) or _is_type_checking_guard(node):
                continue
            if isinstance(node, ast.Import):
                found.extend((alias.name, node.lineno) for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                if node.level == 0 and node.module:
                    for alias in node.names:
                        submodule = f"{node.module}.{alias.name}"
                        found.append((submodule if submodule in known_modules else node.module, node.lineno))
            else:
                for nested in ("body", "orelse", "finalbody", "handlers"):
                    for stmt in getattr(node, nested, []) or []:
                        if isinstance(stmt, ast.stmt):
                            walk([stmt])
                        elif isinstance(stmt, ast.ExceptHandler):
                            walk(stmt.body)

    walk(tree.body)
    return [(module, lineno) for module, lineno in found if module == "metadata" or module.startswith("metadata.")]


def _analysable_files() -> list[Path]:
    return [
        path
        for path in sorted(_SRC.rglob("*.py"))
        if not path.relative_to(_SRC).as_posix().startswith("metadata/generated/")
    ]


def find_violations() -> list[str]:
    """Return sorted ``"<importer> -> <imported>"`` entries that point to a higher layer."""
    files = _analysable_files()
    known_modules = frozenset(_module_name(path) for path in files)
    violations = set()
    for path in files:
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except (SyntaxError, UnicodeDecodeError):
            continue
        importer = _module_name(path)
        importer_rank = _LAYER_RANK[layer_of(importer)]
        for imported, _lineno in module_scope_imports(tree, known_modules):
            if _LAYER_RANK[layer_of(imported)] > importer_rank:
                violations.add(f"{importer} -> {imported}")
    return sorted(violations)


def _load_baseline() -> set[str]:
    if not _BASELINE.exists():
        return set()
    return set(json.loads(_BASELINE.read_text())["violations"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--update-baseline", action="store_true", help="rewrite the baseline from the current tree")
    args = parser.parse_args()

    current = find_violations()
    if args.update_baseline:
        payload = {
            "_comment": (
                "Module-scope imports of a higher layer, recorded so they can be burned down "
                "without regressing. Do not add entries by hand: fix the import (make it "
                "function-local or route it through a registry), then run "
                "scripts/check_import_layers.py --update-baseline."
            ),
            "violations": current,
        }
        _BASELINE.write_text(json.dumps(payload, indent=2) + "\n")
        print(f"baseline updated: {len(current)} violations")  # noqa: T201
        return 0

    baseline = _load_baseline()
    new = sorted(set(current) - baseline)
    fixed = sorted(baseline - set(current))

    result = 0
    if new:
        print(f"{len(new)} new import-layer violation(s) — a module imports a higher layer at module scope:")  # noqa: T201
        for entry in new:
            print(f"  {entry}")  # noqa: T201
        print(  # noqa: T201
            "\nMake the import function-local, move it under `if TYPE_CHECKING:`, or route it "
            "through a registry (e.g. metadata.utils.importer.import_from_module)."
        )
        result = 1
    if fixed:
        print(f"\n{len(fixed)} baseline violation(s) no longer present — shrink the baseline:")  # noqa: T201
        for entry in fixed:
            print(f"  {entry}")  # noqa: T201
        print("Run: python ingestion/scripts/check_import_layers.py --update-baseline")  # noqa: T201
        result = 1
    if not new and not fixed:
        print(f"import layers OK ({len(current)} known violations in baseline)")  # noqa: T201
    return result


if __name__ == "__main__":
    sys.exit(main())
