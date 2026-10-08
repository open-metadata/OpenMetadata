"""The checked-in Playwright quarantine: parsing, plan filtering, and the
nightly summary that reports quarantined failures without failing on them."""

import copy
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1]
ROOT = Path(__file__).parents[3]
RENDERER = SCRIPTS / "render_playwright_summary.cjs"
sys.path.insert(0, str(SCRIPTS))


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


quarantine = load_script("playwright_quarantine")
planner = load_script("build_playwright_shards")

ENTRY = {
    "spec": "Features/A.spec.ts",
    "title": "Panel › opens",
    "issue": "https://github.com/open-metadata/OpenMetadata/issues/12345",
    "added": "2026-10-08",
}


def entries(*raw):
    return quarantine.parse_quarantine({"version": 1, "tests": list(raw)})


def list_report():
    """`playwright test --list --reporter=json` shape: file suite, describes, specs."""
    return {
        "suites": [
            {
                "title": "Features/A.spec.ts",
                "file": "Features/A.spec.ts",
                "specs": [
                    {"title": "top level", "id": "t0", "tests": [{"projectName": "chromium"}]}
                ],
                "suites": [
                    {
                        "title": "Panel",
                        "file": "Features/A.spec.ts",
                        "specs": [
                            {"title": "opens", "id": "t1", "tests": [{"projectName": "chromium"}]},
                            {"title": "closes", "id": "t2", "tests": [{"projectName": "chromium"}]},
                        ],
                        "suites": [
                            {
                                "title": "Nested",
                                "file": "Features/A.spec.ts",
                                "specs": [
                                    {
                                        "title": "opens",
                                        "id": "t3",
                                        "tests": [{"projectName": "chromium"}],
                                    }
                                ],
                            }
                        ],
                    }
                ],
            }
        ]
    }


def listed_titles(report):
    titles = []
    for file_suite in report["suites"]:
        for spec, path in planner.iter_specs_with_titles(file_suite):
            titles.append(" › ".join(path))
    return titles


# --------------------------------------------------------------------- parsing


def test_the_shipped_quarantine_file_is_valid():
    path = ROOT / ".github/playwright/quarantine.json"
    assert isinstance(quarantine.load_quarantine(path), list)
    assert quarantine.main([str(path)]) == 0


def test_a_complete_entry_parses_and_normalises_the_spec_path():
    [entry] = entries({**ENTRY, "spec": "openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/A.spec.ts"})

    assert entry.key == ("Features/A.spec.ts", "Panel › opens")
    assert entry.issue == ENTRY["issue"]


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"issue": ""}, "missing `issue`"),
        ({"issue": "https://example.com/bug/1"}, "GitHub issue URL"),
        ({"issue": "https://github.com/o/r/pull/1"}, "GitHub issue URL"),
        ({"added": "08-10-2026"}, "YYYY-MM-DD"),
        ({"added": "2026-02-30"}, "not a real date"),
        ({"spec": "Features/A.ts"}, ".spec.ts"),
        ({"title": "  "}, "missing `title`"),
    ],
)
def test_an_entry_without_a_tracking_issue_or_valid_fields_is_rejected(override, message):
    with pytest.raises(quarantine.QuarantineError, match=message):
        entries({**ENTRY, **override})


def test_duplicate_entries_and_a_malformed_root_are_rejected():
    with pytest.raises(quarantine.QuarantineError, match="duplicates"):
        entries(ENTRY, dict(ENTRY))
    with pytest.raises(quarantine.QuarantineError, match="`tests` list"):
        quarantine.parse_quarantine({"tests": {}})
    with pytest.raises(quarantine.QuarantineError, match="not an object"):
        entries("Features/A.spec.ts")


def test_an_unreadable_file_is_a_quarantine_error(tmp_path):
    bad = tmp_path / "quarantine.json"
    bad.write_text("{")
    with pytest.raises(quarantine.QuarantineError, match="cannot read"):
        quarantine.load_quarantine(bad)
    assert quarantine.main([str(bad)]) == 1


# ------------------------------------------------------------------- filtering


def test_only_the_named_test_is_stripped_and_the_input_is_untouched():
    report = list_report()
    original = copy.deepcopy(report)

    stripped, removed = quarantine.strip_quarantined(report, entries(ENTRY))

    assert report == original
    assert removed == [
        {"spec": "Features/A.spec.ts", "title": "Panel › opens", "projects": ["chromium"]}
    ]
    # Same leaf title under a nested describe is a different test and stays.
    assert listed_titles(stripped) == [
        "top level",
        "Panel › closes",
        "Panel › Nested › opens",
    ]


def test_file_level_tests_match_by_their_own_title():
    _, removed = quarantine.strip_quarantined(
        list_report(), entries({**ENTRY, "title": "top level"})
    )
    assert [test["title"] for test in removed] == ["top level"]


def test_entries_that_match_no_listed_test_are_reported():
    stale = {**ENTRY, "title": "Panel › renamed"}
    parsed = entries(ENTRY, stale)

    _, removed = quarantine.strip_quarantined(list_report(), parsed)

    assert [entry.title for entry in quarantine.unmatched_entries(parsed, removed)] == [
        "Panel › renamed"
    ]


def write_quarantine(tmp_path, *raw):
    path = tmp_path / "quarantine.json"
    path.write_text(json.dumps({"version": 1, "tests": list(raw)}))
    return path


def test_the_planner_drops_quarantined_tests_from_gating_plans(tmp_path):
    path = write_quarantine(tmp_path, ENTRY)

    report = planner.apply_quarantine(list_report(), path, run_quarantined=False)
    units = planner.discover_units(report)

    test_ids = set().union(*(unit.test_ids for unit in units))
    assert test_ids == {"t0", "t2", "t3"}


def test_the_nightly_plan_keeps_quarantined_tests(tmp_path):
    path = write_quarantine(tmp_path, ENTRY)

    report = planner.apply_quarantine(list_report(), path, run_quarantined=True)

    assert report == list_report()


def test_an_invalid_quarantine_file_fails_planning(tmp_path):
    path = write_quarantine(tmp_path, {**ENTRY, "issue": ""})

    with pytest.raises(SystemExit, match="Invalid Playwright quarantine file"):
        planner.apply_quarantine(list_report(), path, run_quarantined=True)


def test_no_quarantine_argument_leaves_the_report_alone():
    report = list_report()
    assert planner.apply_quarantine(report, None, run_quarantined=False) is report


# --------------------------------------------------------------------- summary

HARNESS = """
const { renderPlaywrightSummary } = require(process.argv[1]);
let failed = null;
let body = '';
const core = {
  summary: { addRaw(text) { body = text; return { write: async () => {} }; } },
  setFailed(message) { failed = message; },
  warning() {},
  info() {},
};
const github = { rest: { actions: { getWorkflowRun: async () => { throw new Error('offline'); } } } };
const context = { eventName: 'schedule', payload: {}, repo: { owner: 'o', repo: 'r' } };
renderPlaywrightSummary({ github, context, core }).then(() => {
  process.stdout.write(JSON.stringify({ failed, body }));
});
"""


def render_nightly(tmp_path, quarantine_file):
    """Render one nightly shard whose only failure is `Panel › opens`."""
    shard = tmp_path / "results" / "playwright-results-json-chromium-01-a1"
    shard.mkdir(parents=True)
    failing = {"status": "failed", "error": {"message": "boom"}}
    spec = lambda title, status, results: {  # noqa: E731
        "title": title,
        "file": "Features/A.spec.ts",
        "tests": [{"projectName": "chromium", "status": status, "results": results}],
    }
    (shard / "results.json").write_text(
        json.dumps(
            {
                "suites": [
                    {
                        "title": "Features/A.spec.ts",
                        "file": "Features/A.spec.ts",
                        "suites": [
                            {
                                "title": "Panel",
                                "file": "Features/A.spec.ts",
                                "specs": [
                                    spec("opens", "unexpected", [failing, failing]),
                                    spec("closes", "expected", [{"status": "passed"}]),
                                ],
                            }
                        ],
                    }
                ]
            }
        )
    )
    (shard / "ci-status.json").write_text(
        json.dumps({"shard": "chromium-01", "steps": {"tests": "failure"}})
    )
    env = {
        **os.environ,
        **{
            name: "success"
            for name in (
                "CHECK_CHANGES_RESULT",
                "CACHE_KEYS_RESULT",
                "BUILD_RESULT",
                "DETECT_CHANGES_RESULT",
                "PLAN_RESULT",
                "FIXTURE_RESTORE_RESULT",
                "FIXTURE_RESULT",
            )
        },
        "PLAYWRIGHT_RESULT": "failure",
        "EXPECTED_MATRIX": json.dumps({"include": [{"shardId": "chromium-01"}]}),
        "RUNNER_TEMP": str(tmp_path),
        "COMMENT_PAYLOAD_PATH": str(tmp_path / "comment.json"),
        "GITHUB_RUN_ID": "1",
        "PLAYWRIGHT_QUARANTINE_FILE": str(quarantine_file),
    }
    result = subprocess.run(
        ["node", "-e", HARNESS, str(RENDERER)],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_a_quarantined_failure_on_the_nightly_is_listed_but_does_not_fail(tmp_path):
    rendered = render_nightly(tmp_path, write_quarantine(tmp_path, ENTRY))

    assert rendered["failed"] is None, rendered["failed"]
    assert "1 quarantined test failure(s)" in rendered["body"]
    assert "`Features/A.spec.ts` › opens" in rendered["body"]


def test_the_same_failure_fails_the_check_when_it_is_not_quarantined(tmp_path):
    rendered = render_nightly(tmp_path, tmp_path / "missing.json")

    assert rendered["failed"] and "1 Playwright test failure(s)" in rendered["failed"]
    assert "quarantined test failure" not in rendered["body"]


def test_renderer_and_planner_build_the_same_key():
    harness = (
        f"const {{ quarantineKey }} = require({json.dumps(str(RENDERER))});"
        "process.stdout.write(JSON.stringify(["
        "quarantineKey('playwright/e2e/Features/A.spec.ts', 'Panel › opens'),"
        "quarantineKey('Features\\\\A.spec.ts', 'Panel › opens')]));"
    )
    result = subprocess.run(
        ["node", "-e", harness], capture_output=True, text=True, check=True
    )
    assert json.loads(result.stdout) == ["Features/A.spec.ts\u0000Panel › opens"] * 2
