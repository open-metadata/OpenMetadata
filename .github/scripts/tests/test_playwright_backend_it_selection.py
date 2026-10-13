from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).parents[3]
IMPACT_MAP = REPOSITORY_ROOT / ".github/playwright/impact-map.json"
SELECTOR = REPOSITORY_ROOT / ".github/scripts/select_playwright_tests.py"

BACKEND_IT = (
    "openmetadata-integration-tests/src/test/java/org/openmetadata/it/util/"
    "SqlQueryCounter.java"
)
UNMAPPED_SERVICE = (
    "openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TableRepository.java"
)


def _select(tmp_path: Path, *changed: str) -> dict:
    changed_files = tmp_path / "changed.txt"
    changed_files.write_text("\n".join(changed) + "\n", encoding="utf-8")
    output = tmp_path / "selection.json"
    subprocess.run(
        [
            sys.executable,
            str(SELECTOR),
            "--event-name",
            "pull_request",
            "--changed-files",
            str(changed_files),
            "--impact-map",
            str(IMPACT_MAP),
            "--full-suite",
            "false",
            "--output",
            str(output),
        ],
        check=True,
        capture_output=True,
    )
    return json.loads(output.read_text(encoding="utf-8"))


def test_backend_integration_test_changes_do_not_escalate_to_the_full_suite(tmp_path):
    # openmetadata-integration-tests/ is in UNMAPPED_CODE_ROOTS, so without an impact-map entry
    # every backend-IT change ran the whole Playwright suite — and when the chromium lane cannot
    # be planned within its shard cap, that is a hard CI failure on a PR that touches no UI.
    assert _select(tmp_path, BACKEND_IT)["mode"] == "targeted"


def test_backend_integration_test_changes_still_run_the_smoke_net(tmp_path):
    # Mapped to no specs, not excluded: the smoke and canary selectors must still be chosen, so
    # demoting these paths from "full" narrows the run without dropping the safety net to nothing.
    assert _select(tmp_path, BACKEND_IT)["selectors"]


def test_an_unmapped_backend_path_alongside_it_changes_still_escalates(tmp_path):
    # The mapping must not be a blanket "backend changes are safe" switch: a service change in the
    # same PR is still an unmapped code path and must take the whole suite with it.
    assert _select(tmp_path, BACKEND_IT, UNMAPPED_SERVICE)["mode"] == "full"
