from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest


SCRIPTS = Path(__file__).parents[1]


def load_script(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def test_duration_aware_sharding_uses_longest_processing_time_first():
    planner = load_script("build_playwright_shards")
    units = [
        planner.Unit("chromium", "a.spec.ts", "a", weight_ms=80),
        planner.Unit("chromium", "b.spec.ts", "b", weight_ms=70),
        planner.Unit("chromium", "c.spec.ts", "c", weight_ms=30),
        planner.Unit("chromium", "d.spec.ts", "d", weight_ms=20),
    ]

    shards = planner.assign_lpt(units, 2)

    assert [sum(unit.weight_ms for unit in shard) for shard in shards] == [100, 100]


def test_basic_and_chromium_share_the_bounded_common_lane():
    planner = load_script("build_playwright_shards")

    assert planner.PROJECT_LANES["Basic"] == "chromium"
    assert planner.lane_bounds("chromium", "full") == (5, 24)


def test_planner_adds_a_shard_when_lpt_assignment_exceeds_budget():
    planner = load_script("build_playwright_shards")
    units = [
        planner.Unit("chromium", f"{index}.spec.ts", str(index), weight_ms=940_000)
        for index in range(13)
    ]

    shards = planner.assign_lane_within_budget(units, "chromium", "targeted")

    assert len(shards) == 5
    assert all(
        planner.predicted_execution_ms(shard, 3) <= planner.TARGET_MS
        for shard in shards
    )


def test_shard_pattern_includes_project_and_file():
    planner = load_script("build_playwright_shards")
    unit = planner.Unit(
        "Basic",
        "Pages/Login.spec.ts",
        "Login page",
        grep_titles={("Basic", "Pages/Login.spec.ts", "Login page")},
    )

    assert unit.pattern == (
        r"(?:^Basic(?:\s+@\S+)*\s+Pages/Login\.spec\.ts"
        r"(?:\s+@\S+)*\s+Login\ page(?:\s+@\S+)*$)"
    )


def test_history_uses_p75_and_leaf_identity_fallback(tmp_path):
    planner = load_script("build_playwright_shards")
    history_files = []
    for index, duration in enumerate((100, 200, 300)):
        history = tmp_path / f"history-{index}.json"
        history.write_text(
            json.dumps(
                {
                    "mode": "full",
                    "tests": [
                        {
                            "id": "old-project-id",
                            "file": "Features/Ingestion.spec.ts",
                            "leafTitle": "runs ingestion",
                            "durationMs": duration,
                        }
                    ],
                }
            )
        )
        history_files.append(history)

    weights, identity_weights = planner.load_history(history_files)

    assert weights["old-project-id"] == 250
    assert identity_weights[("Features/Ingestion.spec.ts", "runs ingestion")] == 250


def test_timing_import_keeps_project_executions_separate(tmp_path, monkeypatch):
    importer = load_script("import_playwright_json_timings")
    report = tmp_path / "results.json"
    output = tmp_path / "timings.json"
    report.write_text(
        json.dumps(
            {
                "suites": [
                    {
                        "file": "Pages/Entity.spec.ts",
                        "specs": [
                            {
                                "id": "shared-spec-id",
                                "title": "renders entity details",
                                "tests": [
                                    {
                                        "projectName": "chromium",
                                        "status": "expected",
                                        "results": [{"duration": 100}],
                                    },
                                    {
                                        "projectName": "Basic",
                                        "status": "flaky",
                                        "results": [
                                            {"duration": 200},
                                            {"duration": 50},
                                        ],
                                    },
                                ],
                            }
                        ],
                    }
                ]
            }
        )
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "import_playwright_json_timings.py",
            "--input-glob",
            str(report),
            "--output",
            str(output),
        ],
    )

    importer.main()

    timings = json.loads(output.read_text())["tests"]
    assert [timing["project"] for timing in timings] == ["Basic", "chromium"]
    project_metrics = [
        (timing["durationMs"], timing["attempts"], timing["retries"])
        for timing in timings
    ]
    assert project_metrics == [
        (250, 2, 1),
        (100, 1, 0),
    ]


def test_ingestion_plans_request_airflow(tmp_path):
    planner = load_script("build_playwright_shards")
    unit = planner.Unit(
        "Ingestion",
        "Features/Ingestion.spec.ts",
        "Ingestion",
        grep_titles={("Ingestion", "Features/Ingestion.spec.ts", "runs ingestion")},
        test_ids={"test-id"},
        weight_ms=1_000,
    )

    matrix_entry = planner.write_plan(tmp_path, "ingestion", 0, [unit])
    plan = json.loads((tmp_path / matrix_entry["plan"]).read_text())

    assert matrix_entry["requiresAirflow"] is True
    assert plan["requiresAirflow"] is True


def test_planner_rejects_a_shard_above_the_execution_budget(tmp_path):
    planner = load_script("build_playwright_shards")
    units = [
        planner.Unit(
            "Ingestion",
            f"Features/Ingestion-{index}.spec.ts",
            f"Ingestion {index}",
            grep_titles={
                (
                    "Ingestion",
                    f"Features/Ingestion-{index}.spec.ts",
                    f"runs ingestion {index}",
                )
            },
            test_ids={f"test-{index}"},
            weight_ms=700_000,
        )
        for index in range(2)
    ]

    with pytest.raises(SystemExit, match="above the 20-minute plan budget"):
        planner.write_plan(tmp_path, "ingestion", 0, units)


def test_audited_parallel_suite_is_split_into_individual_tests():
    planner = load_script("build_playwright_shards")
    report = {
        "suites": [
            {
                "file": "Pages/ExplorePageRightPanel.spec.ts",
                "suites": [
                    {
                        "title": "Right Panel Test Suite",
                        "specs": [
                            {
                                "id": "first",
                                "title": "first test",
                                "tests": [{"projectName": "chromium"}],
                            },
                            {
                                "id": "second",
                                "title": "second test",
                                "tests": [{"projectName": "chromium"}],
                            },
                        ],
                    }
                ],
            }
        ]
    }

    units = planner.discover_units(report)

    assert [unit.test_ids for unit in units] == [{"first"}, {"second"}]


def test_project_dependencies_are_added_to_targeted_plans():
    planner = load_script("build_playwright_shards")
    enabled = planner.Unit("DataAssetRulesEnabled", "enabled.spec.ts", "enabled")
    disabled = planner.Unit("DataAssetRulesDisabled", "disabled.spec.ts", "disabled")
    search = planner.Unit("SearchRBAC", "search.spec.ts", "search")

    expanded = planner.include_project_dependencies(
        [search], [enabled, disabled, search]
    )

    assert {unit.project for unit in expanded} == {
        "DataAssetRulesEnabled",
        "DataAssetRulesDisabled",
        "SearchRBAC",
    }


def test_source_glob_matching_is_explicit():
    selector = load_script("select_playwright_tests")

    assert selector.matches(
        "openmetadata-ui/src/main/resources/ui/src/components/Lineage/Lineage.tsx",
        ["openmetadata-ui/src/main/resources/ui/src/components/Lineage/**"],
    )
    assert not selector.matches(
        "ingestion/src/metadata/ingestion/api/topology_runner.py",
        ["openmetadata-ui/**"],
    )


def test_each_unmapped_file_is_detected_in_a_mixed_change():
    selector = load_script("select_playwright_tests")
    impact_map = {
        "sharedInfrastructure": ["playwright/**"],
        "mappings": [{"sources": ["src/lineage/**"]}],
    }
    changed_files = ["src/lineage/view.ts", "docs/unmapped.md"]

    unmapped = [
        path for path in changed_files if not selector.is_mapped_file(path, impact_map)
    ]

    assert unmapped == ["docs/unmapped.md"]


def test_selector_exports_direct_changed_specs_for_workflow_routing(tmp_path):
    selector = load_script("select_playwright_tests")
    github_output = tmp_path / "github-output.txt"

    selector.write_github_output(
        github_output,
        {
            "mode": "targeted",
            "selectors": [],
            "directChangedSpecs": ["playwright/e2e/Pages/Entity.spec.ts"],
        },
    )

    assert (
        'direct_changed_specs=["playwright/e2e/Pages/Entity.spec.ts"]'
        in github_output.read_text()
    )
    assert "lineage_representative_only=true" in github_output.read_text()

    selector.write_github_output(
        github_output,
        {
            "mode": "targeted",
            "selectors": [],
            "directChangedSpecs": [selector.LINEAGE_MATRIX_SPEC],
        },
    )

    assert github_output.read_text().endswith("lineage_representative_only=false\n")


def test_targeted_selection_combines_changed_specs_impacts_and_unmapped_canaries(
    tmp_path, monkeypatch
):
    selector = load_script("select_playwright_tests")
    changed = tmp_path / "changed.txt"
    output = tmp_path / "selection.json"
    changed.write_text(
        "\n".join(
            [
                "openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts",
                "openmetadata-ui/src/main/resources/ui/src/components/Lineage/Lineage.tsx",
                "docs/unmapped.md",
            ]
        )
    )
    monkeypatch.delenv("GITHUB_OUTPUT", raising=False)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "select_playwright_tests.py",
            "--event-name",
            "pull_request_target",
            "--changed-files",
            str(changed),
            "--impact-map",
            str(Path(".github/playwright/impact-map.json")),
            "--output",
            str(output),
        ],
    )

    selector.main()

    selection = json.loads(output.read_text())
    selected_specs = {entry["spec"] for entry in selection["selectors"]}
    assert "playwright/e2e/Pages/Entity.spec.ts" in selected_specs
    assert any(
        spec.startswith("playwright/e2e/Pages/Lineage/") for spec in selected_specs
    )
    assert "playwright/e2e/Pages/HealthCheck.spec.ts" in selected_specs
    assert selection["unmappedFiles"] == ["docs/unmapped.md"]
    assert selection["directChangedSpecs"] == ["playwright/e2e/Pages/Entity.spec.ts"]


def test_targeted_selection_does_not_schedule_deleted_specs(tmp_path, monkeypatch):
    selector = load_script("select_playwright_tests")
    existing_spec = tmp_path / selector.UI_ROOT / "playwright/e2e/Smoke.spec.ts"
    existing_spec.parent.mkdir(parents=True)
    existing_spec.write_text("test('smoke', () => undefined);\n")
    impact_map = tmp_path / "impact-map.json"
    impact_map.write_text(
        json.dumps(
            {
                "smoke": [{"specs": ["playwright/e2e/Smoke.spec.ts"]}],
                "canary": [],
                "delegatedSpecs": [],
                "sharedInfrastructure": [],
                "mappings": [],
            }
        )
    )
    deleted_spec = "playwright/e2e/Deleted.spec.ts"
    changed = tmp_path / "changed.txt"
    changed.write_text(f"{selector.UI_ROOT}{deleted_spec}\n")
    output = tmp_path / "selection.json"
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("GITHUB_OUTPUT", raising=False)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "select_playwright_tests.py",
            "--event-name",
            "pull_request_target",
            "--changed-files",
            str(changed),
            "--impact-map",
            str(impact_map),
            "--output",
            str(output),
        ],
    )

    selector.main()

    selection = json.loads(output.read_text())
    assert {entry["spec"] for entry in selection["selectors"]} == {
        "playwright/e2e/Smoke.spec.ts"
    }
    assert selection["deletedChangedSpecs"] == [deleted_spec]
    assert selection["directChangedSpecs"] == []


def test_coverage_verifier_detects_missing_and_duplicate_tests(tmp_path):
    verifier = load_script("verify_playwright_coverage")
    plan = {"shardId": "chromium-01", "testIds": ["one", "two"]}
    timing = {"tests": [{"id": "one"}, {"id": "one"}]}
    (tmp_path / "plan.json").write_text(json.dumps(plan))
    (tmp_path / "timing.json").write_text(json.dumps(timing))

    planned, executed = verifier.Counter(), verifier.Counter()
    planned.update(plan["testIds"])
    executed.update(test["id"] for test in timing["tests"])

    assert sorted(planned.keys() - executed.keys()) == ["two"]
    assert [test_id for test_id, count in executed.items() if count > 1] == ["one"]


def test_request_metrics_count_app_boots_bytes_and_hot_api_endpoints():
    requests = load_script("summarize_playwright_requests")
    accumulator = requests.RequestAccumulator()
    accumulator.add(
        '127.0.0.1 "GET /assets/app-Ab_12.js HTTP/1.1" 200 120 "-" "ua" 4\n'
    )
    accumulator.add(
        '127.0.0.1 "GET /api/v1/search/query?q=x HTTP/1.1" 200 80 "-" "ua" 7\n'
    )

    payload = accumulator.payload("chromium-01")

    assert payload["totalRequests"] == 2
    assert payload["staticBytes"] == 120
    assert payload["apiBytes"] == 80
    assert payload["appBoots"] == 1
    assert payload["topApiEndpoints"] == [
        {"endpoint": "GET /api/v1/search/query", "requests": 1}
    ]


def test_outcome_classifier_reads_include_matrix():
    classifier = load_script("classify_playwright_outcome")

    shards, error = classifier._expected_shards(
        [],
        '{"include":[{"shardId":"chromium-01"},{"shardId":"search-01"}]}',
    )

    assert error == ""
    assert shards == ["chromium-01", "search-01"]


def test_fast_opensearch_config_does_not_duplicate_security_disable():
    fast_compose = (
        SCRIPTS.parents[1] / "docker/development/docker-compose-playwright-fast.yml"
    ).read_text()

    assert 'plugins.security.disabled: "true"' in fast_compose
    assert "DISABLE_SECURITY_PLUGIN" not in fast_compose
