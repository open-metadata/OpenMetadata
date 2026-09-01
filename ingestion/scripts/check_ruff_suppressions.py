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
"""Enforce zero-growth Ruff suppressions and legacy logging debt."""

import argparse
import ast
import hashlib
import json
import re
import subprocess
import sys
import tokenize
from collections import Counter, defaultdict
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any

BASELINE_VERSION = 1
BASELINE_NAME = ".ruff-g004-baseline.json"
DISCOVERY_RULES = ("G004", "UP006", "UP007", "UP035", "UP045")
FORBIDDEN_SUPPRESSION_CODES = frozenset({"PGH004", "RUF100", "UP006", "UP007", "UP035", "UP045"})
MODERN_TYPING_RULES = frozenset({"UP006", "UP007", "UP035", "UP045"})
_NOQA_CODES = re.compile(r"#\s*(?:ruff:\s*)?noqa\s*:\s*([^#\r\n]*)", re.IGNORECASE)
_RULE_CODE = re.compile(r"[A-Z]+\d+")
_DIGEST = re.compile(r"[0-9a-f]{64}")

DebtKey = tuple[str, str]
LoggingDebt = Counter[DebtKey]


class Mode(Enum):
    CHECK = "check"
    PRUNE = "prune"


class PolicyError(RuntimeError):
    """Raised when the checker cannot reliably evaluate the repository."""


@dataclass(frozen=True)
class Finding:
    path: str
    line: int
    code: str
    message: str


@dataclass(frozen=True)
class PolicyState:
    logging_debt: LoggingDebt
    logging_locations: dict[DebtKey, tuple[int, ...]]
    typing_findings: tuple[Finding, ...]
    forbidden_suppressions: tuple[Finding, ...]


@dataclass(frozen=True)
class DebtComparison:
    unexpected: LoggingDebt
    obsolete: LoggingDebt


@dataclass(frozen=True)
class _LoggingCall:
    message: ast.JoinedStr
    scope: str
    method: str


class _LoggingCallVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self._scope: list[str] = []
        self.calls: list[_LoggingCall] = []

    def _visit_scope(self, name: str, node: ast.AST) -> None:
        self._scope.append(name)
        self.generic_visit(node)
        self._scope.pop()

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        self._visit_scope(node.name, node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._visit_scope(node.name, node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._visit_scope(node.name, node)

    def visit_Lambda(self, node: ast.Lambda) -> None:
        self._visit_scope("<lambda>", node)

    def visit_Call(self, node: ast.Call) -> None:
        if node.args and isinstance(node.args[0], ast.JoinedStr):
            method = node.func.attr if isinstance(node.func, ast.Attribute) else "<call>"
            self.calls.append(
                _LoggingCall(
                    message=node.args[0],
                    scope=".".join(self._scope) or "<module>",
                    method=method,
                )
            )
        self.generic_visit(node)


def _ruff_command(repo_root: Path, ruff_executable: str) -> list[str]:
    return [
        ruff_executable,
        "check",
        str(repo_root / "ingestion"),
        str(repo_root / "openmetadata-airflow-apis"),
        "--config",
        str(repo_root / "ingestion" / "pyproject.toml"),
    ]


def _run(command: list[str]) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False)
    except OSError as exc:
        raise PolicyError(f"cannot run {command[0]}: {exc}") from exc
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip()
        raise PolicyError(f"command failed ({result.returncode}): {' '.join(command)}\n{detail}")
    return result


def _suppression_candidate_files(repo_root: Path, rg_executable: str = "rg") -> list[Path]:
    command = [
        rg_executable,
        "-l",
        "--ignore-case",
        "--glob",
        "*.py",
        "|".join(sorted(FORBIDDEN_SUPPRESSION_CODES)),
        str(repo_root / "ingestion"),
        str(repo_root / "openmetadata-airflow-apis"),
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False)
    except OSError as exc:
        raise PolicyError(f"cannot run {rg_executable}: {exc}") from exc
    if result.returncode not in (0, 1):
        detail = result.stderr.strip() or result.stdout.strip()
        raise PolicyError(f"command failed ({result.returncode}): {' '.join(command)}\n{detail}")
    return [Path(line) for line in result.stdout.splitlines() if line]


def find_forbidden_suppressions(paths: list[Path]) -> tuple[Finding, ...]:
    findings: list[Finding] = []
    candidate_bytes = tuple(code.encode() for code in FORBIDDEN_SUPPRESSION_CODES)
    for path in paths:
        content = path.read_bytes()
        normalized_content = content.upper()
        if not any(code in normalized_content for code in candidate_bytes):
            continue
        try:
            with tokenize.open(path) as source:
                tokens = tokenize.generate_tokens(source.readline)
                for token in tokens:
                    if token.type != tokenize.COMMENT:
                        continue
                    match = _NOQA_CODES.search(token.string)
                    if not match:
                        continue
                    codes = _RULE_CODE.findall(match.group(1).upper())
                    findings.extend(
                        Finding(
                            path=str(path),
                            line=token.start[0],
                            code=code,
                            message=f"Do not suppress {code}; fix the violation instead.",
                        )
                        for code in codes
                        if code in FORBIDDEN_SUPPRESSION_CODES
                    )
        except (SyntaxError, tokenize.TokenError) as exc:
            raise PolicyError(f"cannot tokenize {path}: {exc}") from exc
    return tuple(findings)


def _load_diagnostics(repo_root: Path, ruff_executable: str) -> list[dict[str, Any]]:
    command = [
        *_ruff_command(repo_root, ruff_executable),
        "--ignore-noqa",
        "--select",
        ",".join(DISCOVERY_RULES),
        "--output-format",
        "json",
        "--exit-zero",
    ]
    result = _run(command)
    try:
        diagnostics = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise PolicyError(f"Ruff returned invalid JSON: {exc}") from exc
    if not isinstance(diagnostics, list):
        raise PolicyError("Ruff JSON output must be a list")
    return diagnostics


def _contains(node: ast.JoinedStr, row: int, column: int) -> bool:
    start = (node.lineno, node.col_offset)
    end = (node.end_lineno or node.lineno, node.end_col_offset or node.col_offset)
    return start <= (row, column) <= end


def _fingerprint_logging_diagnostics(
    repo_root: Path, diagnostics: list[dict[str, Any]]
) -> tuple[LoggingDebt, dict[DebtKey, tuple[int, ...]]]:
    grouped: dict[Path, list[dict[str, Any]]] = defaultdict(list)
    for diagnostic in diagnostics:
        if diagnostic.get("code") == "G004":
            grouped[Path(str(diagnostic["filename"]))].append(diagnostic)

    debt: LoggingDebt = Counter()
    mutable_locations: dict[DebtKey, list[int]] = defaultdict(list)
    resolved_root = repo_root.resolve()
    for path, file_diagnostics in grouped.items():
        with tokenize.open(path) as source_file:
            source = source_file.read()
        try:
            tree = ast.parse(source, filename=str(path))
        except SyntaxError as exc:
            raise PolicyError(f"cannot parse {path}: {exc}") from exc
        visitor = _LoggingCallVisitor()
        visitor.visit(tree)
        relative_path = str(path.resolve().relative_to(resolved_root))
        for diagnostic in file_diagnostics:
            location = diagnostic.get("location")
            if not isinstance(location, dict):
                raise PolicyError(f"G004 diagnostic has no location: {diagnostic}")
            row = int(location["row"])
            column = int(location["column"]) - 1
            exact = [call for call in visitor.calls if (call.message.lineno, call.message.col_offset) == (row, column)]
            matches = exact or [call for call in visitor.calls if _contains(call.message, row, column)]
            if len(matches) != 1:
                raise PolicyError(f"expected one logging f-string at {relative_path}:{row}, found {len(matches)}")
            call = matches[0]
            normalized = ast.dump(call.message, annotate_fields=True, include_attributes=False)
            payload = "\0".join((call.scope, call.method, normalized)).encode()
            digest = hashlib.sha256(payload).hexdigest()
            key = (relative_path, digest)
            debt[key] += 1
            mutable_locations[key].append(row)
    locations = {key: tuple(lines) for key, lines in mutable_locations.items()}
    return debt, locations


def collect_policy_state(repo_root: Path, ruff_executable: str, rg_executable: str = "rg") -> PolicyState:
    repo_root = repo_root.resolve()
    candidates = _suppression_candidate_files(repo_root, rg_executable)
    forbidden = find_forbidden_suppressions(candidates)
    diagnostics = _load_diagnostics(repo_root, ruff_executable)
    logging_debt, logging_locations = _fingerprint_logging_diagnostics(repo_root, diagnostics)
    typing_findings = tuple(
        Finding(
            path=str(Path(str(diagnostic["filename"])).resolve().relative_to(repo_root)),
            line=int(diagnostic["location"]["row"]),
            code=str(diagnostic["code"]),
            message=str(diagnostic["message"]),
        )
        for diagnostic in diagnostics
        if diagnostic.get("code") in MODERN_TYPING_RULES
    )
    return PolicyState(
        logging_debt=logging_debt,
        logging_locations=logging_locations,
        typing_findings=typing_findings,
        forbidden_suppressions=forbidden,
    )


def compare_logging_debt(actual: LoggingDebt, baseline: LoggingDebt) -> DebtComparison:
    return DebtComparison(unexpected=actual - baseline, obsolete=baseline - actual)


def load_baseline(path: Path) -> LoggingDebt:
    try:
        document = json.loads(path.read_text())
    except FileNotFoundError as exc:
        raise PolicyError(f"missing G004 baseline: {path}") from exc
    except json.JSONDecodeError as exc:
        raise PolicyError(f"invalid G004 baseline JSON: {exc}") from exc
    if not isinstance(document, dict) or document.get("version") != BASELINE_VERSION:
        raise PolicyError(f"G004 baseline version must be {BASELINE_VERSION}")
    files = document.get("files")
    if not isinstance(files, dict):
        raise PolicyError("G004 baseline 'files' must be an object")
    debt: LoggingDebt = Counter()
    for file_path, entries in files.items():
        if not isinstance(file_path, str) or not isinstance(entries, dict):
            raise PolicyError("G004 baseline entries must map paths to objects")
        for digest, count in entries.items():
            if not isinstance(digest, str) or not _DIGEST.fullmatch(digest):
                raise PolicyError(f"invalid G004 fingerprint for {file_path}: {digest}")
            if not isinstance(count, int) or isinstance(count, bool) or count < 1:
                raise PolicyError(f"invalid G004 count for {file_path}:{digest}: {count}")
            debt[(file_path, digest)] = count
    return debt


def write_baseline(path: Path, debt: LoggingDebt) -> None:
    files: dict[str, dict[str, int]] = defaultdict(dict)
    for (file_path, digest), count in sorted(debt.items()):
        files[file_path][digest] = count
    document = {"version": BASELINE_VERSION, "files": dict(files)}
    path.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n")


def _print_finding(finding: Finding) -> None:
    print(f"{finding.path}:{finding.line}: {finding.code} {finding.message}", file=sys.stderr)  # noqa: T201


def _print_unexpected(state: PolicyState, unexpected: LoggingDebt) -> None:
    for key, count in sorted(unexpected.items()):
        path, _ = key
        lines = state.logging_locations.get(key, ())
        for line in lines[-count:]:
            print(  # noqa: T201
                f"{path}:{line}: G004 new logging f-string; use lazy %-style logging",
                file=sys.stderr,
            )


def run_policy(repo_root: Path, baseline_path: Path, mode: Mode, ruff_executable: str) -> int:
    state = collect_policy_state(repo_root, ruff_executable)
    baseline = load_baseline(baseline_path)
    comparison = compare_logging_debt(state.logging_debt, baseline)

    for finding in state.forbidden_suppressions:
        _print_finding(finding)
    for finding in state.typing_findings:
        _print_finding(finding)
    _print_unexpected(state, comparison.unexpected)
    if state.forbidden_suppressions or state.typing_findings or comparison.unexpected:
        return 1

    if mode is Mode.CHECK and comparison.obsolete:
        count = sum(comparison.obsolete.values())
        print(  # noqa: T201
            f"G004 baseline has {count} obsolete entr{'y' if count == 1 else 'ies'}; run `make py_format` to prune it.",
            file=sys.stderr,
        )
        return 1

    if mode is Mode.PRUNE and comparison.obsolete:
        write_baseline(baseline_path, state.logging_debt)
        print(f"pruned {sum(comparison.obsolete.values())} obsolete G004 baseline entries")  # noqa: T201
    return 0


def _default_ruff() -> str:
    sibling = Path(sys.executable).with_name("ruff")
    return str(sibling) if sibling.exists() else "ruff"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="fail when policy or baseline drift exists")
    mode.add_argument("--prune", action="store_true", help="remove obsolete baseline entries only")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--ruff", default=_default_ruff(), help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    selected_mode = Mode.CHECK if args.check else Mode.PRUNE
    baseline_path = args.repo_root / "ingestion" / BASELINE_NAME
    try:
        return run_policy(args.repo_root, baseline_path, selected_mode, args.ruff)
    except PolicyError as exc:
        print(f"ruff suppression checker failed: {exc}", file=sys.stderr)  # noqa: T201
        return 2


if __name__ == "__main__":
    sys.exit(main())
