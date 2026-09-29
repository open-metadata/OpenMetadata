"""Tests for the timing-baseline auto-refresh script."""

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


def _write(path: Path, payload) -> None:
    path.write_text(json.dumps(payload), encoding="utf-8")


def _fresh_test(id_, file, leaf, dur_ms, project="chromium", outcome="expected"):
    # Reporter output shape: `title` is a full breadcrumb, `leafTitle` is
    # the short name, `retryDurationMs` is present.
    return {
        "id": id_,
        "project": project,
        "file": file,
        "title": f" › {project} › {file} › some describe › {leaf}",
        "leafTitle": leaf,
        "durationMs": dur_ms,
        "attempts": 1,
        "retries": 0,
        "retryDurationMs": 0,
        "outcome": outcome,
    }


def _current_test(id_, file, title, dur_ms, outcome="expected"):
    return {
        "id": id_,
        "project": "chromium",
        "file": file,
        "title": title,
        "durationMs": dur_ms,
        "attempts": 1,
        "retries": 0,
        "outcome": outcome,
    }


def test_normalize_test_matches_baseline_schema():
    refresh = load_script("refresh_timing_baseline")
    fresh = _fresh_test("abc", "Pages/Foo.spec.ts", "does a thing", 1234)

    normalized = refresh.normalize_test(fresh)

    # title becomes the leaf title; retryDurationMs is dropped
    assert normalized == {
        "id": "abc",
        "project": "chromium",
        "file": "Pages/Foo.spec.ts",
        "title": "does a thing",
        "durationMs": 1234,
        "attempts": 1,
        "retries": 0,
        "outcome": "expected",
    }


def test_build_baseline_preserves_retention_fields():
    refresh = load_script("refresh_timing_baseline")
    fresh = {
        "mode": "full",
        "sourceSha": "abcdef1234567890",
        "tests": [_fresh_test("t1", "Pages/A.spec.ts", "case A", 500)],
    }
    current = {
        "version": 1,
        "mode": "full",
        "sourceRunId": 111,
        "sourceSha": "old-sha",
        "retainedSourceRunId": 222,
        "retainedSourceSha": "retained-sha",
        "retainedUnstableTestIds": ["known-flaky-1", "known-flaky-2"],
        "tests": [_current_test("t1", "Pages/A.spec.ts", "case A", 400)],
    }

    result = refresh.build_baseline(fresh, current, source_run_id=999)

    assert result["sourceRunId"] == 999
    assert result["sourceSha"] == "abcdef1234567890"
    # Retention fields survive the refresh — they're curated by humans.
    assert result["retainedSourceRunId"] == 222
    assert result["retainedSourceSha"] == "retained-sha"
    assert result["retainedUnstableTestIds"] == ["known-flaky-1", "known-flaky-2"]
    assert len(result["tests"]) == 1
    assert result["tests"][0]["title"] == "case A"
    assert result["tests"][0]["durationMs"] == 500


def test_compute_diff_counts_added_removed_and_recovered():
    refresh = load_script("refresh_timing_baseline")
    current = {"tests": [
        _current_test("t1", "Pages/A.spec.ts", "case A", 400),
        _current_test("t2", "Pages/A.spec.ts", "case B", 0),      # zero
        _current_test("t3", "Pages/A.spec.ts", "case removed", 300),
    ]}
    new = {"tests": [
        {"file": "Pages/A.spec.ts", "title": "case A", "durationMs": 450},
        {"file": "Pages/A.spec.ts", "title": "case B", "durationMs": 600},  # recovered
        {"file": "Pages/A.spec.ts", "title": "case NEW", "durationMs": 200},
        {"file": "Pages/B.spec.ts", "title": "new file", "durationMs": 100},
    ]}

    diff = refresh.compute_diff(current, new)

    assert diff["added"] == 2       # case NEW + Pages/B.spec.ts::new file
    assert diff["removed"] == 1     # case removed
    assert diff["recovered"] == 1   # case B: 0 → 600
    assert diff["gained_files"] == ["Pages/B.spec.ts"]
    assert diff["lost_files"] == []
    assert diff["drift_percent"] == 100.0  # 3 changes over 3 current entries


def test_main_writes_output_and_exits_zero(tmp_path):
    refresh_script = SCRIPTS / "refresh_timing_baseline.py"
    history = tmp_path / "history.json"
    current = tmp_path / "current.json"
    output = tmp_path / "new.json"
    summary = tmp_path / "summary.md"

    _write(history, {
        "mode": "full",
        "sourceSha": "sha-fresh",
        "tests": [_fresh_test("t1", "Pages/A.spec.ts", "case A", 500)],
    })
    _write(current, {
        "version": 1, "mode": "full", "sourceRunId": 111, "sourceSha": "sha-old",
        "retainedUnstableTestIds": ["flaky-1"],
        "tests": [_current_test("t1", "Pages/A.spec.ts", "case A", 400)],
    })

    result = subprocess.run(
        [sys.executable, str(refresh_script),
         "--history", str(history), "--current", str(current),
         "--output", str(output), "--source-run-id", "42",
         "--summary", str(summary)],
        capture_output=True, text=True,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    payload = json.loads(output.read_text())
    assert payload["sourceRunId"] == 42
    assert payload["sourceSha"] == "sha-fresh"
    assert payload["retainedUnstableTestIds"] == ["flaky-1"]
    assert payload["tests"][0]["title"] == "case A"
    # Output is compact JSON (single line matches the checked-in baseline).
    assert "\n" not in output.read_text().rstrip("\n")
    assert "Timing baseline auto-refresh summary" in summary.read_text()


def test_main_refuses_when_drift_exceeds_cap(tmp_path):
    refresh_script = SCRIPTS / "refresh_timing_baseline.py"
    history = tmp_path / "history.json"
    current = tmp_path / "current.json"
    output = tmp_path / "new.json"

    # Current has 10 entries; fresh replaces 8 of them with different keys
    # (80% drift) — should trip the cap.
    _write(history, {
        "mode": "full",
        "sourceSha": "sha-fresh",
        "tests": [_fresh_test(f"t{i}", f"Pages/{i}.spec.ts", f"case {i}", 100)
                  for i in range(20, 28)] + [
                 _fresh_test(f"t{i}", f"Pages/A.spec.ts", f"case {i}", 100)
                 for i in range(2)],
    })
    _write(current, {
        "version": 1, "mode": "full", "sourceRunId": 111,
        "retainedUnstableTestIds": [],
        "tests": [_current_test(f"t{i}", "Pages/A.spec.ts", f"case {i}", 100)
                  for i in range(10)],
    })

    result = subprocess.run(
        [sys.executable, str(refresh_script),
         "--history", str(history), "--current", str(current),
         "--output", str(output), "--source-run-id", "42",
         "--max-drift-percent", "40"],
        capture_output=True, text=True,
    )

    assert result.returncode == 2, result.stdout + result.stderr
    assert "drift" in (result.stdout + result.stderr).lower()
    # Output not written on drift failure
    assert not output.exists()


def test_main_skips_immaterial_change_with_exit_three(tmp_path):
    # 1 of 20 entries shifts by 600 ms — pure run-to-run jitter. With a 10%
    # materiality threshold the script must exit 3 and write nothing, so the
    # workflow skips the main commit (every push to main resets the merge
    # queue; jitter must not).
    refresh_script = SCRIPTS / "refresh_timing_baseline.py"
    history = tmp_path / "history.json"
    current = tmp_path / "current.json"
    output = tmp_path / "new.json"
    summary = tmp_path / "summary.md"

    _write(history, {
        "mode": "full",
        "sourceSha": "sha-fresh",
        "tests": [_fresh_test(f"t{i}", "Pages/A.spec.ts", f"case {i}",
                              1000 + (600 if i == 0 else 0))
                  for i in range(20)],
    })
    _write(current, {
        "version": 1, "mode": "full", "sourceRunId": 111,
        "retainedUnstableTestIds": [],
        "tests": [_current_test(f"t{i}", "Pages/A.spec.ts", f"case {i}", 1000)
                  for i in range(20)],
    })

    result = subprocess.run(
        [sys.executable, str(refresh_script),
         "--history", str(history), "--current", str(current),
         "--output", str(output), "--source-run-id", "42",
         "--min-materiality-percent", "10",
         "--summary", str(summary)],
        capture_output=True, text=True,
    )

    assert result.returncode == 3, result.stdout + result.stderr
    assert "materiality" in (result.stdout + result.stderr)
    assert not output.exists()
    # The summary still records why the refresh was skipped.
    assert "materiality" in summary.read_text()


def test_main_treats_recovered_zero_duration_as_material(tmp_path):
    # A single zero→real recovery is below any percentage threshold but MUST
    # refresh: all-zero entries are the planner-starving bug class that
    # SIGTERM'd chromium-12 (PR #30812).
    refresh_script = SCRIPTS / "refresh_timing_baseline.py"
    history = tmp_path / "history.json"
    current = tmp_path / "current.json"
    output = tmp_path / "new.json"

    _write(history, {
        "mode": "full",
        "sourceSha": "sha-fresh",
        "tests": [_fresh_test(f"t{i}", "Pages/A.spec.ts", f"case {i}",
                              1000 if i else 30000)
                  for i in range(20)],
    })
    _write(current, {
        "version": 1, "mode": "full", "sourceRunId": 111,
        "retainedUnstableTestIds": [],
        "tests": [_current_test(f"t{i}", "Pages/A.spec.ts", f"case {i}",
                                1000 if i else 0)
                  for i in range(20)],
    })

    result = subprocess.run(
        [sys.executable, str(refresh_script),
         "--history", str(history), "--current", str(current),
         "--output", str(output), "--source-run-id", "42",
         "--min-materiality-percent", "10"],
        capture_output=True, text=True,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert output.exists()


def test_main_treats_significant_shift_share_as_material(tmp_path):
    # 3 of 20 entries (15%) shift by 20 s (>30% and >5 s) — over a 10%
    # materiality threshold, so the refresh proceeds.
    refresh_script = SCRIPTS / "refresh_timing_baseline.py"
    history = tmp_path / "history.json"
    current = tmp_path / "current.json"
    output = tmp_path / "new.json"

    _write(history, {
        "mode": "full",
        "sourceSha": "sha-fresh",
        "tests": [_fresh_test(f"t{i}", "Pages/A.spec.ts", f"case {i}",
                              30000 if i < 3 else 10000)
                  for i in range(20)],
    })
    _write(current, {
        "version": 1, "mode": "full", "sourceRunId": 111,
        "retainedUnstableTestIds": [],
        "tests": [_current_test(f"t{i}", "Pages/A.spec.ts", f"case {i}", 10000)
                  for i in range(20)],
    })

    result = subprocess.run(
        [sys.executable, str(refresh_script),
         "--history", str(history), "--current", str(current),
         "--output", str(output), "--source-run-id", "42",
         "--min-materiality-percent", "10"],
        capture_output=True, text=True,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert output.exists()


def test_main_rejects_non_full_history(tmp_path):
    refresh_script = SCRIPTS / "refresh_timing_baseline.py"
    history = tmp_path / "history.json"
    current = tmp_path / "current.json"
    output = tmp_path / "new.json"

    _write(history, {"mode": "targeted", "sourceSha": "x", "tests": []})
    _write(current, {"version": 1, "mode": "full", "tests": []})

    result = subprocess.run(
        [sys.executable, str(refresh_script),
         "--history", str(history), "--current", str(current),
         "--output", str(output), "--source-run-id", "42"],
        capture_output=True, text=True,
    )

    assert result.returncode == 1, result.stdout + result.stderr
    assert "'full'" in (result.stdout + result.stderr)
