"""Tests for the main-lane flake baseline."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path


SCRIPTS = Path(__file__).parents[1]


def load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


refresh_flake_baseline = load_script("refresh_flake_baseline")
classify_playwright_outcome = load_script("classify_playwright_outcome")


def ledger(
    *,
    retry_passes: list[str] | None = None,
    failures: list[str] | None = None,
    classification: str = "passed_with_retries",
) -> dict:
    retry_passes = retry_passes or []
    failures = failures or []

    def records(stable_ids: list[str]) -> list[dict]:
        return [
            {
                "stableId": stable_id,
                "project": stable_id.split(" :: ")[0],
                "file": stable_id.split(" :: ")[1],
                "title": stable_id.split(" :: ")[2],
            }
            for stable_id in stable_ids
        ]

    return {
        "classification": classification,
        "retryPassStableIds": retry_passes,
        "failureStableIds": failures,
        "retryPasses": records(retry_passes),
        "failures": records(failures),
    }


def apply(current, led, *, run_id, window=10, threshold=2, sha="deadbee"):
    return refresh_flake_baseline.refresh(
        ledger=led,
        current=current,
        window=window,
        threshold=threshold,
        run_id=run_id,
        source_sha=sha,
        now="2026-09-07T00:00:00Z",
    )


GLOSSARY = "chromium :: playwright/e2e/Pages/Glossary.spec.ts :: reads the description"
LINEAGE = "chromium :: playwright/e2e/Pages/Lineage.spec.ts :: opens the node panel"


def test_clean_run_records_the_run_and_baselines_nothing():
    baseline = apply(None, ledger(classification="passed"), run_id="1")

    assert baseline["stableIds"] == []
    assert [run["runId"] for run in baseline["runs"]] == ["1"]


def test_one_observation_is_not_enough_to_baseline():
    baseline = apply(None, ledger(retry_passes=[GLOSSARY]), run_id="1")

    # Observed, so the history is there, but a single unlucky run must not
    # excuse a test from the gate.
    assert GLOSSARY in baseline["entries"]
    assert baseline["stableIds"] == []


def test_second_observation_enters_the_baseline():
    first = apply(None, ledger(retry_passes=[GLOSSARY]), run_id="1")
    second = apply(first, ledger(retry_passes=[GLOSSARY]), run_id="2")

    assert second["stableIds"] == [GLOSSARY]
    assert second["entries"][GLOSSARY]["observations"] == ["1", "2"]
    assert second["entries"][GLOSSARY]["file"].endswith("Glossary.spec.ts")


def test_hard_failures_count_as_first_attempt_failures_and_are_flagged():
    first = apply(None, ledger(failures=[LINEAGE], classification="test_failure"), run_id="1")
    second = apply(first, ledger(failures=[LINEAGE], classification="test_failure"), run_id="2")

    assert second["stableIds"] == [LINEAGE]
    assert second["hardFailureStableIds"] == [LINEAGE]


def test_a_test_main_starts_passing_again_ages_out_of_the_window():
    baseline = apply(None, ledger(retry_passes=[GLOSSARY]), run_id="1", window=2)
    baseline = apply(baseline, ledger(retry_passes=[GLOSSARY]), run_id="2", window=2)
    assert baseline["stableIds"] == [GLOSSARY]

    # Two clean runs push both observations out of a window of 2.
    baseline = apply(baseline, ledger(classification="passed"), run_id="3", window=2)
    assert baseline["stableIds"] == []
    baseline = apply(baseline, ledger(classification="passed"), run_id="4", window=2)
    assert GLOSSARY not in baseline["entries"]


def test_rerunning_the_same_run_id_does_not_double_count():
    first = apply(None, ledger(retry_passes=[GLOSSARY]), run_id="1")
    again = apply(first, ledger(retry_passes=[GLOSSARY]), run_id="1")

    assert again["entries"][GLOSSARY]["observations"] == ["1"]
    assert again["stableIds"] == []
    assert [run["runId"] for run in again["runs"]] == ["1"]


def test_a_run_that_measured_nothing_leaves_the_baseline_untouched():
    for classification in ("cancelled", "missing_results"):
        assert apply(None, ledger(classification=classification), run_id="1") is None


def test_output_is_consumable_by_the_classifier_baseline_reader(tmp_path):
    first = apply(None, ledger(retry_passes=[GLOSSARY]), run_id="1")
    second = apply(first, ledger(retry_passes=[GLOSSARY]), run_id="2")

    path = tmp_path / "flake-baseline.json"
    path.write_text(json.dumps(second), encoding="utf-8")

    ids, error = classify_playwright_outcome._baseline_ids(str(path))
    assert error == ""
    assert ids == {GLOSSARY}


def test_cli_writes_the_baseline_and_a_summary(tmp_path):
    ledger_path = tmp_path / "outcome.json"
    ledger_path.write_text(
        json.dumps(ledger(retry_passes=[GLOSSARY])), encoding="utf-8"
    )
    output = tmp_path / "flake-baseline.json"
    summary = tmp_path / "summary.md"

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "refresh_flake_baseline.py"),
            "--ledger", str(ledger_path),
            "--output", str(output),
            "--summary", str(summary),
            "--threshold", "1",
            "--run-id", "42",
            "--source-sha", "abc1234",
        ],
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert json.loads(output.read_text())["stableIds"] == [GLOSSARY]
    assert "Playwright flake baseline (main)" in summary.read_text()


def test_cli_exits_three_when_the_run_measured_nothing(tmp_path):
    ledger_path = tmp_path / "outcome.json"
    ledger_path.write_text(
        json.dumps(ledger(classification="cancelled")), encoding="utf-8"
    )
    output = tmp_path / "flake-baseline.json"

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "refresh_flake_baseline.py"),
            "--ledger", str(ledger_path),
            "--output", str(output),
        ],
        capture_output=True,
        text=True,
    )

    assert result.returncode == 3, result.stdout + result.stderr
    assert not output.exists()


def test_cli_rejects_an_unreadable_ledger(tmp_path):
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "refresh_flake_baseline.py"),
            "--ledger", str(tmp_path / "missing.json"),
            "--output", str(tmp_path / "out.json"),
        ],
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
