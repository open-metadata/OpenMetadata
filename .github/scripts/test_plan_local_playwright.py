from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

SCRIPT_PATH = Path(__file__).with_name("plan_local_playwright.py")
SPEC = importlib.util.spec_from_file_location("plan_local_playwright", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
PLANNER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = PLANNER
SPEC.loader.exec_module(PLANNER)

REPO_ROOT = Path(__file__).resolve().parents[2]
UI = "openmetadata-ui/src/main/resources/ui/"
LINEAGE_SOURCE = f"{UI}src/components/Lineage/LineageProvider/LineageProvider.tsx"
UNMAPPED_JAVA = (
    "openmetadata-service/src/main/java/org/openmetadata/service/NoMappingForThis.java"
)


def ci_targeted_specs(changed_files: list[str], tmp_path: Path) -> set[str]:
    changed = tmp_path / "changed.txt"
    output = tmp_path / "ci-plan.json"
    changed.write_text("\n".join(changed_files) + "\n")
    subprocess.run(
        [
            sys.executable,
            str(PLANNER.SELECTOR_PATH),
            "--event-name",
            "pull_request",
            "--changed-files",
            str(changed),
            "--impact-map",
            PLANNER.IMPACT_MAP,
            "--output",
            str(output),
        ],
        cwd=REPO_ROOT,
        check=True,
    )
    return {
        selector["spec"] for selector in json.loads(output.read_text())["selectors"]
    }


def test_mapped_source_matches_ci_targeted_plan(tmp_path: Path) -> None:
    plan = PLANNER.build_plan(REPO_ROOT, [LINEAGE_SOURCE])

    assert set(plan.specs) == ci_targeted_specs([LINEAGE_SOURCE], tmp_path)
    assert (
        plan.reasons["playwright/e2e/Pages/Lineage/PlatformLineage.spec.ts"]
        == "impact-mapped"
    )
    assert plan.reasons["playwright/e2e/Flow/Navbar.spec.ts"] == "smoke"
    assert "canary" not in plan.reasons.values()
    assert plan.unmapped_code_files == []


def test_changed_spec_is_selected_and_delegated_spec_is_reported_not_run() -> None:
    changed = f"{UI}playwright/e2e/Pages/Policies.spec.ts"
    delegated = f"{UI}playwright/e2e/Features/KnowledgeGraph.spec.ts"

    plan = PLANNER.build_plan(REPO_ROOT, [changed, delegated])

    assert plan.reasons["playwright/e2e/Pages/Policies.spec.ts"] == "changed"
    assert "playwright/e2e/Features/KnowledgeGraph.spec.ts" not in plan.specs
    assert plan.delegated_changed_specs == [
        "playwright/e2e/Features/KnowledgeGraph.spec.ts"
    ]


def test_unmapped_code_path_falls_back_to_targeted_plus_canaries() -> None:
    plan = PLANNER.build_plan(REPO_ROOT, [LINEAGE_SOURCE, UNMAPPED_JAVA])

    assert plan.unmapped_code_files == [UNMAPPED_JAVA]
    assert (
        plan.reasons["playwright/e2e/Pages/Lineage/PlatformLineage.spec.ts"]
        == "impact-mapped"
    )
    assert plan.reasons["playwright/e2e/Pages/HealthCheck.spec.ts"] == "canary"
    assert all((REPO_ROOT / UI / spec).is_file() for spec in plan.specs)


def test_summarize_results_counts_each_outcome_per_file(tmp_path: Path) -> None:
    def spec(file: str, *statuses: str) -> dict:
        return {"file": file, "tests": [{"status": status} for status in statuses]}

    report = {
        "config": {"rootDir": str(tmp_path / "playwright/e2e")},
        "suites": [
            {
                "file": "Pages/Policies.spec.ts",
                "specs": [spec("Pages/Policies.spec.ts", "expected", "unexpected")],
                "suites": [
                    {
                        "specs": [
                            spec(
                                "Pages/Policies.spec.ts", "flaky", "skipped", "expected"
                            )
                        ]
                    }
                ],
            },
            {"file": "auth.setup.ts", "specs": [spec("auth.setup.ts", "expected")]},
        ],
    }

    per_file = PLANNER.summarize_results(report, tmp_path)

    assert per_file == {
        "playwright/e2e/Pages/Policies.spec.ts": {
            "passed": 2,
            "failed": 1,
            "flaky": 1,
            "skipped": 1,
        },
        "playwright/e2e/auth.setup.ts": {
            "passed": 1,
            "failed": 0,
            "flaky": 0,
            "skipped": 0,
        },
    }


def test_render_block_fails_when_a_selected_spec_did_not_run() -> None:
    plan = PLANNER.LocalPlan(
        specs=["playwright/e2e/A.spec.ts", "playwright/e2e/B.spec.ts"],
        reasons={
            "playwright/e2e/A.spec.ts": "smoke",
            "playwright/e2e/B.spec.ts": "changed",
        },
        changed_files=[],
    )
    per_file = {
        "playwright/e2e/A.spec.ts": {"passed": 3, "failed": 0, "flaky": 0, "skipped": 0}
    }

    block = PLANNER.render_block(
        plan, per_file, {"stats": {}}, [["npx"]], "a" * 40, "origin/main", dirty=True
    )

    assert block.startswith(PLANNER.BLOCK_START)
    assert block.rstrip().endswith(PLANNER.BLOCK_END)
    assert "**Local Playwright run: FAILED**" in block
    assert "| `playwright/e2e/B.spec.ts` | changed | not run |" in block
    assert "uncommitted changes were present" in block


def test_render_block_does_not_pass_when_every_test_was_skipped() -> None:
    plan = PLANNER.LocalPlan(
        specs=["playwright/e2e/A.spec.ts"],
        reasons={"playwright/e2e/A.spec.ts": "smoke"},
        changed_files=[],
    )
    per_file = {
        "playwright/e2e/A.spec.ts": {"passed": 0, "failed": 0, "flaky": 0, "skipped": 4}
    }

    block = PLANNER.render_block(
        plan, per_file, {"stats": {}}, [["npx"]], "a" * 40, "origin/main", dirty=False
    )

    assert "**Local Playwright run: NO TESTS EXECUTED**" in block
    assert "uncommitted" not in block


def test_upsert_block_inserts_under_playwright_heading_then_replaces_in_place() -> None:
    template = (REPO_ROOT / ".github/pull_request_template.md").read_text()
    body = template.replace(PLANNER.BLOCK_START, "").replace(PLANNER.BLOCK_END, "")
    first = f"{PLANNER.BLOCK_START}\nFIRST-RUN\n{PLANNER.BLOCK_END}\n"
    second = f"{PLANNER.BLOCK_START}\nSECOND-RUN\n{PLANNER.BLOCK_END}\n"

    inserted = PLANNER.upsert_block(body, first)
    replaced = PLANNER.upsert_block(inserted, second)

    heading = inserted.index(PLANNER.PLAYWRIGHT_HEADING)
    assert (
        heading
        < inserted.index("FIRST-RUN")
        < inserted.index("#### Manual testing performed")
    )
    assert replaced.count(PLANNER.BLOCK_START) == 1
    assert "FIRST-RUN" not in replaced
    assert replaced == PLANNER.upsert_block(replaced, second)


def test_upsert_block_appends_when_body_has_no_heading() -> None:
    block = f"{PLANNER.BLOCK_START}\nx\n{PLANNER.BLOCK_END}"

    assert PLANNER.upsert_block("Plain body", block) == f"Plain body\n\n{block}\n"


def test_missing_base_ref_exits_with_fetch_hint() -> None:
    try:
        PLANNER.collect_changed_files(REPO_ROOT, "no-such-remote/no-such-branch")
    except SystemExit as error:
        assert "git fetch origin main" in str(error.code)
    else:
        raise AssertionError("expected SystemExit for an unknown base ref")


CHROMIUM_SUITE = {f"playwright/e2e/Suite{index}.spec.ts" for index in range(50)}
FIXTURES = {"playwright/e2e/auth.setup.ts", "playwright/e2e/entity-data.setup.ts"}
INTAKE = "playwright/e2e/Pages/IntakeForm.spec.ts"
RULES_ENABLED = "playwright/e2e/Features/DataAssetRulesEnabled.spec.ts"
RULES_DISABLED = "playwright/e2e/Features/DataAssetRulesDisabled.spec.ts"
DEDICATED = {"IntakeForm", "DataAssetRulesEnabled", "DataAssetRulesDisabled"}
PROJECT = {
    INTAKE: "IntakeForm",
    RULES_ENABLED: "DataAssetRulesEnabled",
    RULES_DISABLED: "DataAssetRulesDisabled",
}


def fake_lister(specs: list[str]) -> PLANNER.Listing:
    """Mimics playwright.config.ts: IntakeForm depends on all of chromium, and
    DataAssetRulesDisabled depends on DataAssetRulesEnabled."""
    listed = {spec: {PROJECT.get(spec, "chromium")} for spec in specs}
    listed.update({fixture: {"setup"} for fixture in FIXTURES})
    if INTAKE in specs:
        listed.update({spec: {"chromium"} for spec in CHROMIUM_SUITE})
    if RULES_DISABLED in specs:
        listed[RULES_ENABLED] = {"DataAssetRulesEnabled"}
    return PLANNER.Listing(listed, DEDICATED)


def test_dependency_expanding_specs_are_split_into_a_no_deps_pass() -> None:
    specs = [
        INTAKE,
        "playwright/e2e/Pages/Policies.spec.ts",
        RULES_DISABLED,
        RULES_ENABLED,
    ]

    main_specs, isolated, extra = PLANNER.split_dependency_expanders(specs, fake_lister)

    # DataAssetRulesDisabled only pulls in a spec that is already planned, so it stays.
    assert main_specs == [
        "playwright/e2e/Pages/Policies.spec.ts",
        RULES_DISABLED,
        RULES_ENABLED,
    ]
    assert isolated == [INTAKE]
    assert extra == len(CHROMIUM_SUITE)


def test_plan_without_expansion_runs_as_one_command() -> None:
    specs = ["playwright/e2e/Pages/Policies.spec.ts", RULES_DISABLED, RULES_ENABLED]

    assert PLANNER.split_dependency_expanders(specs, fake_lister) == (specs, [], 0)


def test_refuses_to_run_when_the_main_pass_still_expands() -> None:
    specs = ["playwright/e2e/A.spec.ts", "playwright/e2e/B.spec.ts"]

    def catch_all_expands(listed_specs: list[str]) -> PLANNER.Listing:
        # An expansion through a catch-all project cannot be isolated by spec.
        projects = {spec: {"chromium"} for spec in [*listed_specs, *CHROMIUM_SUITE]}
        return PLANNER.Listing(projects, DEDICATED)

    try:
        PLANNER.split_dependency_expanders(specs, catch_all_expands)
    except SystemExit as error:
        assert "Refusing to run" in str(error)
    else:
        raise AssertionError("expected the planner to refuse a full-suite run")


def test_merge_reports_keeps_both_passes() -> None:
    first = {
        "config": {"rootDir": "/e2e"},
        "suites": [{"file": "A.spec.ts"}],
        "errors": [],
        "stats": {"startTime": "t0", "duration": 1000},
    }
    second = {
        "suites": [{"file": "B.spec.ts"}],
        "errors": ["boom"],
        "stats": {"startTime": "t1", "duration": 500},
    }

    merged = PLANNER.merge_reports(first, second)

    assert [suite["file"] for suite in merged["suites"]] == ["A.spec.ts", "B.spec.ts"]
    assert merged["errors"] == ["boom"]
    assert merged["stats"] == {"startTime": "t0", "duration": 1500.0}
    assert merged["config"] == first["config"]


def test_failed_listing_exits_with_playwrights_own_error(monkeypatch, tmp_path):
    def failed_list(*args, **kwargs):
        return subprocess.CompletedProcess(
            args, 1, stdout="", stderr="Error: Cannot find module '@playwright/test'"
        )

    monkeypatch.setattr(PLANNER.subprocess, "run", failed_list)
    try:
        PLANNER.list_run(tmp_path, ["playwright/e2e/Pages/Foo.spec.ts"])
    except SystemExit as exit_:
        assert "Cannot find module '@playwright/test'" in str(exit_.code)
    else:
        raise AssertionError("a failed listing must exit")
