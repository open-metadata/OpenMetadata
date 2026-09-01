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

import sys
from collections import Counter
from pathlib import Path

import pytest

from ingestion.scripts.check_ruff_suppressions import (
    Mode,
    PolicyError,
    collect_policy_state,
    compare_logging_debt,
    find_forbidden_suppressions,
    load_baseline,
    run_policy,
    write_baseline,
)


def _write_repo(tmp_path: Path, source: str) -> tuple[Path, Path]:
    repo_root = tmp_path / "repo"
    ingestion_root = repo_root / "ingestion"
    airflow_root = repo_root / "openmetadata-airflow-apis"
    ingestion_root.mkdir(parents=True)
    airflow_root.mkdir()
    (ingestion_root / "pyproject.toml").write_text(
        """
[tool.ruff]
target-version = "py310"

[tool.ruff.lint]
select = ["UP"]
""".strip()
        + "\n"
    )
    source_path = ingestion_root / "sample.py"
    source_path.write_text(source)
    (airflow_root / "keep.py").write_text("VALUE = 1\n")
    return repo_root, source_path


def _ruff_executable() -> str:
    executable = Path(sys.executable).with_name("ruff")
    assert executable.exists()
    return str(executable)


def test_forbidden_suppression_scan_ignores_string_contents(tmp_path: Path) -> None:
    _, source_path = _write_repo(
        tmp_path,
        (
            'EXAMPLE = "# noqa: UP006"\n'
            "value = 1  # noqa: RUF100\n"
            "other = 2  # noqa: F841, UP006\n"
            "logging = 3  # noqa: G004\n"
        ),
    )

    findings = find_forbidden_suppressions([source_path])

    assert [(finding.line, finding.code) for finding in findings] == [
        (2, "RUF100"),
        (3, "UP006"),
        (4, "G004"),
    ]


def test_discovery_ignores_noqa_for_typing_and_logging(tmp_path: Path) -> None:
    repo_root, _ = _write_repo(
        tmp_path,
        """import logging
import typing

logger = logging.getLogger(__name__)


def run(table: str) -> None:
    values: typing.List[str] = []  # noqa: UP006
    logger.info(f"Processing {table}")  # noqa: G004
""",
    )

    state = collect_policy_state(repo_root, _ruff_executable())

    assert [(finding.code, finding.line) for finding in state.typing_findings] == [("UP006", 8)]
    assert sum(state.logging_debt.values()) == 1


def test_discovery_rejects_lowercase_forbidden_suppression(tmp_path: Path) -> None:
    repo_root, _ = _write_repo(tmp_path, "value = 1  # noqa: up006\n")

    state = collect_policy_state(repo_root, _ruff_executable())

    assert [(finding.code, finding.line) for finding in state.forbidden_suppressions] == [("UP006", 1)]


def test_discovery_does_not_require_optional_search_tool(tmp_path: Path, monkeypatch) -> None:
    repo_root, _ = _write_repo(tmp_path, "VALUE = 1\n")
    monkeypatch.setenv("PATH", "")

    state = collect_policy_state(repo_root, _ruff_executable())

    assert not state.forbidden_suppressions


def test_discovery_fails_when_source_root_is_missing(tmp_path: Path) -> None:
    repo_root, _ = _write_repo(tmp_path, "VALUE = 1\n")
    airflow_root = repo_root / "openmetadata-airflow-apis"
    (airflow_root / "keep.py").unlink()
    airflow_root.rmdir()

    with pytest.raises(PolicyError, match="cannot scan"):
        collect_policy_state(repo_root, _ruff_executable())


def test_logging_fingerprint_survives_line_movement(tmp_path: Path) -> None:
    repo_root, source_path = _write_repo(
        tmp_path,
        """import logging

logger = logging.getLogger(__name__)


def run(table: str) -> None:
    logger.info(f"Processing {table}")  # noqa: G004
""",
    )
    before = collect_policy_state(repo_root, _ruff_executable()).logging_debt

    source_path.write_text("\n\n" + source_path.read_text())
    after = collect_policy_state(repo_root, _ruff_executable()).logging_debt

    assert before == after


def test_logging_fingerprint_changes_with_scope(tmp_path: Path) -> None:
    repo_root, source_path = _write_repo(
        tmp_path,
        """import logging

logger = logging.getLogger(__name__)
logger.info(f"Processing {logger.name}")  # noqa: G004
""",
    )
    before = collect_policy_state(repo_root, _ruff_executable()).logging_debt

    source_path.write_text(
        """import logging

logger = logging.getLogger(__name__)


def run() -> None:
    logger.info(f"Processing {logger.name}")  # noqa: G004
"""
    )
    after = collect_policy_state(repo_root, _ruff_executable()).logging_debt

    comparison = compare_logging_debt(after, before)
    assert sum(comparison.unexpected.values()) == 1
    assert sum(comparison.obsolete.values()) == 1


def test_logging_debt_preserves_duplicate_counts(tmp_path: Path) -> None:
    repo_root, _ = _write_repo(
        tmp_path,
        """import logging

logger = logging.getLogger(__name__)


def run(table: str) -> None:
    logger.info(f"Processing {table}")  # noqa: G004
    logger.info(f"Processing {table}")  # noqa: G004
""",
    )

    debt = collect_policy_state(repo_root, _ruff_executable()).logging_debt

    assert list(debt.values()) == [2]


def test_prune_removes_only_obsolete_logging_debt(tmp_path: Path) -> None:
    repo_root, source_path = _write_repo(
        tmp_path,
        """import logging

logger = logging.getLogger(__name__)
logger.info(f"Processing {logger.name}")  # noqa: G004
""",
    )
    baseline_path = repo_root / "ingestion" / ".ruff-g004-baseline.json"
    initial = collect_policy_state(repo_root, _ruff_executable()).logging_debt
    write_baseline(baseline_path, initial)
    source_path.write_text("VALUE = 1\n")

    result = run_policy(repo_root, baseline_path, Mode.PRUNE, _ruff_executable())

    assert result == 0
    assert '"files": {}' in baseline_path.read_text()


def test_prune_refuses_to_trade_old_logging_debt_for_new(tmp_path: Path) -> None:
    repo_root, source_path = _write_repo(
        tmp_path,
        """import logging

logger = logging.getLogger(__name__)
logger.info(f"Processing {logger.name}")  # noqa: G004
""",
    )
    baseline_path = repo_root / "ingestion" / ".ruff-g004-baseline.json"
    initial = collect_policy_state(repo_root, _ruff_executable()).logging_debt
    write_baseline(baseline_path, initial)
    original_baseline = baseline_path.read_text()
    source_path.write_text(
        """import logging

logger = logging.getLogger(__name__)


def moved() -> None:
    logger.info(f"Processing {logger.name}")  # noqa: G004
"""
    )

    result = run_policy(repo_root, baseline_path, Mode.PRUNE, _ruff_executable())

    assert result == 1
    assert baseline_path.read_text() == original_baseline


def test_comparison_reports_excess_duplicate_as_unexpected() -> None:
    key = ("ingestion/sample.py", "abc")

    comparison = compare_logging_debt(Counter({key: 2}), Counter({key: 1}))

    assert comparison.unexpected == Counter({key: 1})
    assert comparison.obsolete == Counter()


def test_malformed_baseline_is_rejected(tmp_path: Path) -> None:
    baseline_path = tmp_path / "baseline.json"
    baseline_path.write_text('{"version": 1, "files": {"sample.py": {"bad": 1}}}\n')

    with pytest.raises(PolicyError, match="invalid G004 fingerprint"):
        load_baseline(baseline_path)


def test_missing_ruff_executable_is_reported_as_policy_error(tmp_path: Path) -> None:
    repo_root, _ = _write_repo(tmp_path, "VALUE = 1\n")

    with pytest.raises(PolicyError, match="cannot run"):
        collect_policy_state(repo_root, str(tmp_path / "missing-ruff"))
