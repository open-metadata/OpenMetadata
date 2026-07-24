from __future__ import annotations

import importlib.util
import json
import os
import subprocess
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


def test_full_common_shard_count_is_capped_at_24():
    planner = load_script("build_playwright_shards")
    units = [
        planner.Unit(
            "chromium",
            f"{index}.spec.ts",
            str(index),
            weight_ms=1_000_000,
        )
        for index in range(81)
    ]
    units.append(
        planner.Unit("chromium", "remainder.spec.ts", "remainder", weight_ms=363_055)
    )

    assert planner.shard_count(units, "chromium", "full") == 24


def test_common_lane_keeps_one_minute_of_allocation_reserve():
    planner = load_script("build_playwright_shards")

    assert planner.shard_budget_ms_for_lane("chromium") == 19 * 60 * 1000
    assert planner.shard_budget_ms_for_lane("search") == 20 * 60 * 1000


def test_predicted_execution_applies_runner_efficiency():
    planner = load_script("build_playwright_shards")
    units = [
        planner.Unit("chromium", f"{index}.spec.ts", str(index), weight_ms=1_040_000)
        for index in range(3)
    ]

    assert sum(unit.weight_ms for unit in units) / 3 < planner.TARGET_MS
    assert planner.predicted_execution_ms(units, 3) > planner.TARGET_MS


def test_common_assignment_stays_within_the_execution_ceiling():
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


def test_common_assignment_may_use_reserve_at_the_maximum_shard_count():
    planner = load_script("build_playwright_shards")
    units = [
        planner.Unit(
            "chromium",
            f"{index}.spec.ts",
            str(index),
            weight_ms=19 * 60 * 1000 + 30_000,
        )
        for index in range(24)
    ]

    shards = planner.assign_lane_within_budget(units, "chromium", "full")
    predictions = [planner.predicted_execution_ms(shard, 3) for shard in shards]

    assert len(shards) == planner.COMMON_MAX_SHARDS
    assert all(
        planner.COMMON_SHARD_BUDGET_MS < prediction <= planner.TARGET_MS
        for prediction in predictions
    )


def test_common_assignment_rejects_a_capped_lane_above_the_hard_ceiling():
    planner = load_script("build_playwright_shards")
    units = [
        planner.Unit(
            "chromium",
            f"{index}.spec.ts",
            str(index),
            weight_ms=14 * 60 * 1000,
        )
        for index in range(73)
    ]

    with pytest.raises(SystemExit, match="20-minute execution ceiling"):
        planner.assign_lane_within_budget(units, "chromium", "full")


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


def test_history_includes_retry_time_and_only_preserves_explicit_skips(tmp_path):
    planner = load_script("build_playwright_shards")
    history = tmp_path / "history.json"
    history.write_text(
        json.dumps(
            {
                "mode": "full",
                "tests": [
                    {
                        "id": "flaky-test",
                        "file": "Features/Entity.spec.ts",
                        "leafTitle": "runs once",
                        "durationMs": 150,
                        "retryDurationMs": 50,
                    },
                    {
                        "id": "known-skip",
                        "file": "Features/Entity.spec.ts",
                        "leafTitle": "zero observation",
                        "durationMs": 0,
                        "outcome": "skipped",
                    },
                    {
                        "id": "expected-zero",
                        "file": "Features/Entity.spec.ts",
                        "leafTitle": "expected zero",
                        "durationMs": 0,
                        "outcome": "expected",
                    },
                ],
            }
        )
    )

    weights, identity_weights = planner.load_history([history])
    units = [
        planner.Unit(
            "chromium",
            "Features/Entity.spec.ts",
            "known skip",
            test_ids={"known-skip"},
            test_names={"known-skip": "zero observation"},
        ),
        planner.Unit(
            "chromium",
            "Features/Entity.spec.ts",
            "expected zero",
            test_ids={"expected-zero"},
            test_names={"expected-zero": "expected zero"},
        ),
        planner.Unit(
            "chromium",
            "Features/Entity.spec.ts",
            "same identity as skip",
            test_ids={"new-same-identity"},
            test_names={"new-same-identity": "zero observation"},
        ),
        planner.Unit(
            "chromium",
            "Features/New.spec.ts",
            "new test",
            test_ids={"new-test"},
            test_names={"new-test": "new test"},
        ),
    ]

    planner.apply_history_weights(units, weights, identity_weights)

    assert weights["flaky-test"] == 150
    assert weights["known-skip"] == 0
    assert "expected-zero" not in weights
    assert ("Features/Entity.spec.ts", "zero observation") not in identity_weights
    assert units[0].weight_ms == 0
    assert units[1].weight_ms == planner.FALLBACK_TEST_MS
    assert units[2].weight_ms == planner.FALLBACK_TEST_MS
    assert units[3].weight_ms == planner.FALLBACK_TEST_MS


def test_versioned_baseline_only_uses_zero_weight_for_skipped_ids():
    planner = load_script("build_playwright_shards")
    baseline = SCRIPTS.parents[0] / "playwright/timing-baseline.json"
    payload = json.loads(baseline.read_text())
    zero_tests = [test for test in payload["tests"] if test["durationMs"] == 0]

    weights, _ = planner.load_history([baseline])

    assert any(test["outcome"] == "expected" for test in zero_tests)
    assert all(
        (weights.get(test["id"]) == 0) == (test["outcome"] == "skipped")
        for test in zero_tests
    )


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


def test_planner_rejects_a_shard_above_the_execution_ceiling(tmp_path):
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

    with pytest.raises(SystemExit, match="above the 20-minute execution ceiling"):
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


def test_hook_heavy_subsuites_in_audited_suite_stay_atomic():
    planner = load_script("build_playwright_shards")
    report = {
        "suites": [
            {
                "file": "Pages/ExplorePageRightPanel.spec.ts",
                "suites": [
                    {
                        "title": "Right Panel Test Suite",
                        "suites": [
                            {
                                "title": "Explore page right panel tests",
                                "suites": [
                                    {
                                        "title": (
                                            "Overview panel - Deleted entity "
                                            "verification"
                                        ),
                                        "specs": [
                                            {
                                                "id": "deleted-user",
                                                "title": "deleted user",
                                                "tests": [{"projectName": "chromium"}],
                                            },
                                            {
                                                "id": "deleted-tag",
                                                "title": "deleted tag",
                                                "tests": [{"projectName": "chromium"}],
                                            },
                                        ],
                                    },
                                    {
                                        "title": "Standalone behavior",
                                        "specs": [
                                            {
                                                "id": "standalone-one",
                                                "title": "standalone test one",
                                                "tests": [{"projectName": "chromium"}],
                                            },
                                            {
                                                "id": "standalone-two",
                                                "title": "standalone test two",
                                                "tests": [{"projectName": "chromium"}],
                                            },
                                        ],
                                    },
                                ],
                            }
                        ],
                    }
                ],
            }
        ]
    }

    units = planner.discover_units(report)
    planner.apply_history_weights(
        units,
        {
            "deleted-user": 100,
            "deleted-tag": 200,
            "standalone-one": 300,
            "standalone-two": 400,
        },
        {},
    )

    assert [unit.test_ids for unit in units] == [
        {"deleted-tag", "deleted-user"},
        {"standalone-one"},
        {"standalone-two"},
    ]
    assert units[0].title.endswith("Overview panel - Deleted entity verification")
    assert units[0].weight_ms == 120_300
    assert [test_id for unit in units for test_id in sorted(unit.test_ids)] == [
        "deleted-tag",
        "deleted-user",
        "standalone-one",
        "standalone-two",
    ]


def test_common_shard_writer_enforces_the_hard_twenty_minute_ceiling(tmp_path):
    planner = load_script("build_playwright_shards")
    reserve_budget = planner.Unit(
        "chromium",
        "reserve.spec.ts",
        "reserve",
        grep_titles={("chromium", "reserve.spec.ts", "reserve")},
        test_ids={"reserve"},
        weight_ms=19 * 60 * 1000 + 1,
    )
    above_ceiling = planner.Unit(
        "chromium",
        "above-ceiling.spec.ts",
        "above ceiling",
        grep_titles={("chromium", "above-ceiling.spec.ts", "above ceiling")},
        test_ids={"above-ceiling"},
        weight_ms=20 * 60 * 1000 + 1,
    )

    planner.write_plan(tmp_path, "chromium", 0, [reserve_budget])
    with pytest.raises(SystemExit, match="above the 20-minute execution ceiling"):
        planner.write_plan(tmp_path, "chromium", 1, [above_ceiling])


def test_data_asset_rule_dependencies_are_added_to_targeted_plans():
    planner = load_script("build_playwright_shards")
    enabled = planner.Unit("DataAssetRulesEnabled", "enabled.spec.ts", "enabled")
    disabled = planner.Unit("DataAssetRulesDisabled", "disabled.spec.ts", "disabled")

    expanded = planner.include_project_dependencies([disabled], [enabled, disabled])

    assert {unit.project for unit in expanded} == {
        "DataAssetRulesEnabled",
        "DataAssetRulesDisabled",
    }


def test_search_rbac_does_not_depend_on_data_asset_rule_assertions():
    planner = load_script("build_playwright_shards")
    enabled = planner.Unit("DataAssetRulesEnabled", "enabled.spec.ts", "enabled")
    disabled = planner.Unit("DataAssetRulesDisabled", "disabled.spec.ts", "disabled")
    search = planner.Unit("SearchRBAC", "search.spec.ts", "search")

    expanded = planner.include_project_dependencies(
        [search], [enabled, disabled, search]
    )

    assert expanded == [search]


def test_search_rbac_uses_an_isolated_single_worker_lane():
    planner = load_script("build_playwright_shards")

    assert planner.PROJECT_LANES["SearchRBAC"] == "search-rbac"
    assert planner.LANE_WORKERS["search-rbac"] == 1
    assert planner.lane_bounds("search-rbac", "full") == (1, 8)


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


def test_coverage_verifier_accounts_for_native_zero_attempt_skips():
    verifier = load_script("verify_playwright_coverage")
    report = {
        "suites": [
            {
                "suites": [
                    {
                        "specs": [
                            {
                                "id": "zero-attempt-skipped",
                                "file": "Flow/SearchRBAC.spec.ts",
                                "title": "User with permission",
                                "tests": [
                                    {
                                        "projectName": "SearchRBAC",
                                        "status": "skipped",
                                        "results": [],
                                    }
                                ],
                            },
                            {
                                "id": "executed",
                                "file": "Flow/SearchRBAC.spec.ts",
                                "title": "User without permission",
                                "tests": [
                                    {
                                        "projectName": "SearchRBAC",
                                        "status": "expected",
                                        "results": [{"status": "passed"}],
                                    }
                                ],
                            },
                        ]
                    }
                ]
            }
        ]
    }

    skipped = verifier.zero_attempt_skipped_tests(
        report, verifier.Counter({"executed": 1})
    )

    assert skipped == {
        "zero-attempt-skipped": {
            "id": "zero-attempt-skipped",
            "project": "SearchRBAC",
            "file": "Flow/SearchRBAC.spec.ts",
            "title": "User with permission",
            "category": "zero-attempt-skipped",
            "reason": "unknown",
        }
    }


@pytest.mark.parametrize(
    "annotations",
    [
        [{"type": "skip", "description": "intentional static skip"}],
        [],
    ],
    ids=["intentional-static", "serial-or-max-failures"],
)
def test_zero_attempt_skip_does_not_infer_dependency_provenance(annotations):
    verifier = load_script("verify_playwright_coverage")
    report = {
        "suites": [
            {
                "specs": [
                    {
                        "id": "zero-attempt",
                        "file": "Flow/Example.spec.ts",
                        "title": "skipped without an attempt",
                        "tests": [
                            {
                                "projectName": "chromium",
                                "status": "skipped",
                                "results": [],
                                "annotations": annotations,
                            }
                        ],
                    }
                ]
            }
        ]
    }

    skipped = verifier.zero_attempt_skipped_tests(report, verifier.Counter())

    assert skipped["zero-attempt"]["category"] == "zero-attempt-skipped"
    assert skipped["zero-attempt"]["reason"] == "unknown"
    assert "dependency" not in json.dumps(skipped).lower()


@pytest.mark.parametrize(
    ("status", "results"),
    [
        ("skipped", [{"status": "skipped"}]),
        ("expected", []),
    ],
)
def test_zero_attempt_skip_requires_both_native_skip_and_no_results(status, results):
    verifier = load_script("verify_playwright_coverage")
    report = {
        "suites": [
            {
                "specs": [
                    {
                        "id": "not-zero-attempt-skipped",
                        "tests": [
                            {
                                "projectName": "chromium",
                                "status": status,
                                "results": results,
                            }
                        ],
                    }
                ]
            }
        ]
    }

    assert verifier.zero_attempt_skipped_tests(report, verifier.Counter()) == {}


def test_coverage_verifier_reconciles_zero_attempt_skips_in_output(
    tmp_path, monkeypatch
):
    verifier = load_script("verify_playwright_coverage")
    plan = {
        "shardId": "search-rbac-01",
        "testIds": ["executed", "zero-attempt-skipped"],
    }
    timing = {"tests": [{"id": "executed"}]}
    result = {
        "suites": [
            {
                "specs": [
                    {
                        "id": "zero-attempt-skipped",
                        "file": "Flow/SearchRBAC.spec.ts",
                        "title": "User with permission",
                        "tests": [
                            {
                                "projectName": "SearchRBAC",
                                "status": "skipped",
                                "results": [],
                            }
                        ],
                    }
                ]
            }
        ]
    }
    (tmp_path / "plan.json").write_text(json.dumps(plan))
    (tmp_path / "timing.json").write_text(json.dumps(timing))
    (tmp_path / "result.json").write_text(json.dumps(result))
    output = tmp_path / "coverage.json"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "verify_playwright_coverage.py",
            "--plan-glob",
            str(tmp_path / "plan.json"),
            "--timing-glob",
            str(tmp_path / "timing.json"),
            "--result-glob",
            str(tmp_path / "result.json"),
            "--output",
            str(output),
        ],
    )

    verifier.main()

    coverage = json.loads(output.read_text())
    assert coverage["plannedTests"] == 2
    assert coverage["executedTests"] == 1
    assert coverage["accountedTests"] == 2
    assert coverage["missingTestIds"] == []
    assert coverage["zeroAttemptSkippedTestIds"] == ["zero-attempt-skipped"]
    assert coverage["zeroAttemptSkippedTests"][0]["reason"] == "unknown"


def test_request_metrics_count_app_boots_bytes_and_hot_api_endpoints():
    requests = load_script("summarize_playwright_requests")
    accumulator = requests.RequestAccumulator()
    accumulator.add(
        '127.0.0.1 "GET /assets/app-entry-Ab_12.js HTTP/1.1" 200 120 "-" "ua" 4\n'
    )
    accumulator.add(
        '127.0.0.1 "GET /api/v1/search/query?q=x HTTP/1.1" 200 80 "-" "ua" 7\n'
    )

    payload = accumulator.payload("chromium-01")

    assert payload["version"] == 2
    assert payload["totalRequests"] == 2
    assert payload["staticBytes"] == 120
    assert payload["apiBytes"] == 80
    assert payload["appEntryRequests"] == 1
    assert payload["topApiEndpoints"] == [
        {"endpoint": "GET /api/v1/search/query", "requests": 1}
    ]
    assert payload["apiEndpointCounts"] == {"GET /api/v1/search/query": 1}
    assert payload["staticResourceTypes"] == {"javascript": 1}
    assert payload["staticEndpointCounts"] == {"GET /assets/app-entry-Ab_12.js": 1}
    assert payload["topStaticEndpoints"] == [
        {"endpoint": "GET /assets/app-entry-Ab_12.js", "requests": 1}
    ]


def test_request_metrics_exclude_diagnostic_beacons_and_manual_chunk_boots():
    requests = load_script("summarize_playwright_requests")
    accumulator = requests.RequestAccumulator()
    accumulator.add_all(
        [
            '127.0.0.1 "GET /favicon.ico?playwright-app-boot=1&playwright-ui-scenario=1 HTTP/1.1" 200 10 "-" "ua" 1\n',
            '127.0.0.1 "GET /favicon.ico?playwright-app-boot=1 HTTP/1.1" 200 10 "-" "ua" 1\n',
            '127.0.0.1 "GET /assets/app-entry-Ab_12.js HTTP/1.1" 200 120 "-" "ua" 4\n',
            '127.0.0.1 "GET /assets/app-e2e-runtime-Xy_34.js HTTP/1.1" 200 80 "-" "ua" 2\n',
            '127.0.0.1 "GET /assets/app-e2e-schema-database-Xy_34.js HTTP/1.1" 200 40 "-" "ua" 1\n',
        ]
    )

    payload = accumulator.payload("chromium-01")

    assert payload["totalRequests"] == 3
    assert payload["staticRequests"] == 3
    assert payload["staticBytes"] == 240
    assert payload["staticServerMs"] == 7
    assert payload["statuses"] == {"static:200": 3}
    assert payload["appBoots"] == 2
    assert payload["uiScenarios"] == 1
    assert payload["appEntryRequests"] == 1
    assert "GET /favicon.ico" not in payload["staticEndpointCounts"]


def test_performance_metrics_aggregate_ranked_endpoint_counts():
    evaluator = load_script("evaluate_playwright_performance")
    payloads = [
        {"staticEndpointCounts": {"GET /assets/app-a.js": 2}},
        {
            "staticEndpointCounts": {
                "GET /assets/app-a.js": 3,
                "GET /assets/shared.js": 4,
            }
        },
    ]

    assert evaluator.aggregate_ranked_counts(
        payloads, "staticEndpointCounts", "topStaticEndpoints", 2
    ) == [
        {"endpoint": "GET /assets/app-a.js", "requests": 5},
        {"endpoint": "GET /assets/shared.js", "requests": 4},
    ]


def test_performance_metrics_support_legacy_ranked_endpoint_counts():
    evaluator = load_script("evaluate_playwright_performance")
    payloads = [
        {"topStaticEndpoints": [{"endpoint": "GET /assets/app-a.js", "requests": 2}]}
    ]

    assert evaluator.aggregate_ranked_counts(
        payloads, "staticEndpointCounts", "topStaticEndpoints", 2
    ) == [{"endpoint": "GET /assets/app-a.js", "requests": 2}]


def test_performance_stability_metrics_include_lifecycle_retries(tmp_path, monkeypatch):
    evaluator = load_script("evaluate_playwright_performance")
    timing = {
        "tests": [
            {
                "id": "product",
                "outcome": "expected",
                "attempts": 1,
                "durationMs": 100,
                "retryDurationMs": 0,
            }
        ],
        "lifecycleTests": [
            {
                "id": "setup",
                "outcome": "flaky",
                "attempts": 2,
                "durationMs": 100,
                "retryDurationMs": 50,
            }
        ],
    }
    requests = {
        "totalRequests": 100,
        "appBoots": 3,
        "uiScenarios": 3,
        "appEntryRequests": 2,
    }
    phases = {"lane": "chromium", "executionSeconds": 1}
    timing_file = tmp_path / "timing.json"
    request_file = tmp_path / "requests.json"
    phase_file = tmp_path / "phases.json"
    output = tmp_path / "performance.json"
    timing_file.write_text(json.dumps(timing))
    request_file.write_text(json.dumps(requests))
    phase_file.write_text(json.dumps(phases))
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "evaluate_playwright_performance.py",
            "--timing-glob",
            str(timing_file),
            "--request-glob",
            str(request_file),
            "--phase-glob",
            str(phase_file),
            "--mode",
            "targeted",
            "--output",
            str(output),
        ],
    )

    evaluator.main()

    performance = json.loads(output.read_text())
    metrics = performance["metrics"]
    assert metrics["tests"] == 1
    assert metrics["attempts"] == 1
    assert metrics["lifecycleTests"] == 1
    assert metrics["lifecycleAttempts"] == 2
    assert metrics["stabilityAttempts"] == 3
    assert metrics["requestsPerAttempt"] == 33.33
    assert metrics["appBootsPerAttempt"] == 1
    assert metrics["appBootsPerUIScenario"] == 1
    assert metrics["appEntryRequests"] == 2
    assert performance["targets"]["atMostOneAppBootPerUIScenario"] is True
    assert performance["targets"]["appBootMeasurementIntegrity"] is True
    assert "atMostOneAppBootPerAttempt" not in performance["targets"]
    assert performance["blockingTargetsMet"] is False
    assert performance["convergenceTargetsMet"] is True
    assert "appBootMeasurementIntegrity" in performance["blockingTargets"]
    assert "atMostOneAppBootPerUIScenario" in performance["convergenceTargets"]
    assert metrics["lifecycleFlakyTests"] == 1
    assert metrics["productFlakyRatePercent"] == 0
    assert metrics["lifecycleFlakyRatePercent"] == 100
    assert metrics["flakyRatePercent"] == 50
    assert metrics["lifecycleRetryWorkerPercent"] == 50
    assert metrics["retryWorkerPercent"] == 25


def test_boot_measurement_integrity_requires_beacons_for_entry_requests():
    evaluator = load_script("evaluate_playwright_performance")

    assert evaluator.has_valid_boot_measurement(2, 1, 1) is True
    assert evaluator.has_valid_boot_measurement(0, 0, 1) is False
    assert evaluator.has_valid_boot_measurement(1, 1, 2) is False
    assert evaluator.has_valid_boot_measurement(1, 2, 1) is False


def test_boot_target_uses_exact_counts_instead_of_rounded_ratio():
    evaluator = load_script("evaluate_playwright_performance")

    assert evaluator.has_at_most_one_app_boot_per_ui_scenario(1_000, 1_000)
    assert not evaluator.has_at_most_one_app_boot_per_ui_scenario(1_001, 1_000)


def test_performance_enforcement_reports_convergence_without_failing(
    tmp_path, monkeypatch
):
    evaluator = load_script("evaluate_playwright_performance")
    timing_file = tmp_path / "timing.json"
    request_file = tmp_path / "requests.json"
    output = tmp_path / "performance.json"
    timing_file.write_text(
        json.dumps(
            {
                "tests": [
                    {
                        "id": "product",
                        "outcome": "expected",
                        "attempts": 1,
                        "durationMs": 100,
                        "retryDurationMs": 0,
                    }
                ]
            }
        )
    )
    request_file.write_text(
        json.dumps(
            {
                "totalRequests": 300,
                "appBoots": 2,
                "uiScenarios": 1,
                "appEntryRequests": 1,
            }
        )
    )
    (tmp_path / "phase-1.json").write_text(
        json.dumps({"lane": "chromium", "executionSeconds": 1})
    )
    (tmp_path / "phase-2.json").write_text(
        json.dumps({"lane": "chromium", "executionSeconds": 2})
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "evaluate_playwright_performance.py",
            "--timing-glob",
            str(timing_file),
            "--request-glob",
            str(request_file),
            "--phase-glob",
            str(tmp_path / "phase-*.json"),
            "--mode",
            "full",
            "--output",
            str(output),
            "--enforce",
        ],
    )

    evaluator.main()

    performance = json.loads(output.read_text())
    assert performance["targetsMet"] is False
    assert performance["blockingTargetsMet"] is True
    assert performance["convergenceTargetsMet"] is False
    assert performance["convergenceTargets"] == {
        "commonShardSkewAtMostFifteenPercent": False,
        "requestsPerAttemptBelowTwoHundred": False,
        "atMostOneAppBootPerUIScenario": False,
    }


def test_performance_enforcement_still_fails_blocking_targets(tmp_path, monkeypatch):
    evaluator = load_script("evaluate_playwright_performance")
    timing_file = tmp_path / "timing.json"
    request_file = tmp_path / "requests.json"
    phase_file = tmp_path / "phase.json"
    output = tmp_path / "performance.json"
    timing_file.write_text(
        json.dumps(
            {
                "tests": [
                    {
                        "id": "product",
                        "outcome": "expected",
                        "attempts": 1,
                        "durationMs": 100,
                        "retryDurationMs": 0,
                    }
                ]
            }
        )
    )
    request_file.write_text(
        json.dumps(
            {
                "totalRequests": 10,
                "appBoots": 1,
                "uiScenarios": 1,
                "appEntryRequests": 1,
            }
        )
    )
    phase_file.write_text(
        json.dumps(
            {
                "lane": "chromium",
                "environmentSeconds": 301,
                "executionSeconds": 1,
            }
        )
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "evaluate_playwright_performance.py",
            "--timing-glob",
            str(timing_file),
            "--request-glob",
            str(request_file),
            "--phase-glob",
            str(phase_file),
            "--mode",
            "full",
            "--output",
            str(output),
            "--enforce",
        ],
    )

    with pytest.raises(
        SystemExit,
        match="Blocking Playwright performance targets not met: "
        "environmentAtMostFiveMinutes",
    ):
        evaluator.main()


def test_outcome_classifier_reads_include_matrix():
    classifier = load_script("classify_playwright_outcome")

    shards, error = classifier._expected_shards(
        [],
        '{"include":[{"shardId":"chromium-01"},{"shardId":"search-01"}]}',
    )

    assert error == ""
    assert shards == ["chromium-01", "search-01"]


def test_outcome_classifier_separates_lifecycle_retries_from_product_totals(tmp_path):
    classifier = load_script("classify_playwright_outcome")
    report = {
        "suites": [
            {
                "file": "Flow/SearchRBAC.spec.ts",
                "specs": [
                    {
                        "title": "product assertion",
                        "tests": [
                            {
                                "projectName": "SearchRBAC",
                                "status": "expected",
                                "results": [{"status": "passed"}],
                            }
                        ],
                    }
                ],
            },
            {
                "file": "search-rbac.setup.ts",
                "specs": [
                    {
                        "title": "enable search RBAC",
                        "tests": [
                            {
                                "projectName": "search-rbac-setup",
                                "status": "flaky",
                                "results": [
                                    {"status": "failed"},
                                    {"status": "passed"},
                                ],
                            }
                        ],
                    }
                ],
            },
        ]
    }
    report_dir = tmp_path / "playwright-results-json-search-rbac-01"
    report_dir.mkdir()
    report_file = report_dir / "results.json"
    report_file.write_text(json.dumps(report))

    outcome = classifier.classify_playwright_outcome(
        [report_file], [], matrix_outcome="success"
    )

    assert outcome["classification"] == "passed_with_retries"
    assert outcome["counts"]["tests"] == 1
    assert outcome["counts"]["retryPassed"] == 0
    assert outcome["counts"]["lifecycleTests"] == 1
    assert outcome["counts"]["lifecycleRetryPassed"] == 1
    assert outcome["retryPasses"][0]["lifecycle"] is True


def test_fast_opensearch_config_does_not_duplicate_security_disable():
    fast_compose = (
        SCRIPTS.parents[1] / "docker/development/docker-compose-playwright-fast.yml"
    ).read_text()

    assert 'plugins.security.disabled: "true"' in fast_compose
    assert "DISABLE_SECURITY_PLUGIN" not in fast_compose


def test_h2_config_is_derived_from_the_current_server_config():
    generator = load_script("generate_playwright_h2_config")
    source = (SCRIPTS.parents[1] / "conf/openmetadata.yaml").read_text()

    rendered = generator.render_h2_config(source)

    source_prefix, _, source_after_application = source.partition(
        generator.APPLICATION_CONNECTORS_MARKER
    )
    _, _, source_suffix = source_after_application.partition(
        generator.ADMIN_CONNECTORS_MARKER
    )
    rendered_prefix, _, rendered_after_application = rendered.partition(
        generator.APPLICATION_CONNECTORS_MARKER
    )
    rendered_connector, _, rendered_suffix = rendered_after_application.partition(
        generator.ADMIN_CONNECTORS_MARKER
    )

    assert rendered_prefix == source_prefix
    assert rendered_suffix == source_suffix
    assert "    - type: h2\n" in rendered_connector
    assert "      keyStorePath: ${SERVER_H2_KEYSTORE_PATH}\n" in rendered_connector
    assert "      certAlias: openmetadata-h2\n" in rendered_connector
    assert "        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256\n" in rendered_connector

    fast_launcher = (SCRIPTS / "start_playwright_fast_environment.sh").read_text()
    assert "generate_playwright_h2_config.py" in fast_launcher
    assert 'server_config="$runtime_root/openmetadata-h2.yaml"' in fast_launcher
    assert not (SCRIPTS.parents[1] / "conf/openmetadata-h2-test.yaml").exists()


def test_h2_config_generation_fails_when_server_markers_drift():
    generator = load_script("generate_playwright_h2_config")
    config_without_admin_connector = """server:
  applicationConnectors:
    - type: http
"""

    with pytest.raises(ValueError, match="server.adminConnectors"):
        generator.render_h2_config(config_without_admin_connector)


def test_fast_fixture_preserves_and_validates_the_search_cluster_alias():
    fixture_builder = (SCRIPTS / "create_playwright_fixture.sh").read_text()
    fast_launcher = (SCRIPTS / "start_playwright_fast_environment.sh").read_text()
    workflow = (
        SCRIPTS.parents[0] / "workflows/playwright-postgresql-e2e.yml"
    ).read_text()
    fixture_job = workflow.split("  prepare-playwright-fixture:", 1)[1].split(
        "  playwright-ci-postgresql:", 1
    )[0]

    assert "searchClusterAlias: $searchClusterAlias" in fixture_builder
    assert "ELASTICSEARCH_CLUSTER_ALIAS: openmetadata" in fixture_job
    assert "s/^[[:space:]]+//" in fixture_builder
    assert ".searchClusterAlias" in fast_launcher
    assert (
        'export ELASTICSEARCH_CLUSTER_ALIAS="$PW_SEARCH_CLUSTER_ALIAS"' in fast_launcher
    )
    assert "provider_address_texas" in fast_launcher


def test_planner_discovers_oss_only_specs():
    workflow = (
        SCRIPTS.parents[0] / "workflows/playwright-postgresql-e2e.yml"
    ).read_text()
    planner_job = workflow.split("  plan-playwright:", 1)[1].split(
        "  restore-playwright-fixture:", 1
    )[0]
    discovery_step = planner_job.split("      - name: Discover tests", 1)[1].split(
        "      - name: Build duration-aware shard plans", 1
    )[0]

    assert 'PLAYWRIGHT_IS_OSS: "true"' in discovery_step


def test_basic_project_excludes_dedicated_state_specs():
    playwright_config = (
        SCRIPTS.parents[1]
        / "openmetadata-ui/src/main/resources/ui/playwright.config.ts"
    ).read_text()
    basic_project = playwright_config.split("name: 'Basic'", 1)[1].split(
        "name: 'Ingestion'", 1
    )[0]

    assert "testIgnore: dedicatedStateTestIgnore" in basic_project
    assert "'**/SearchSettings.spec.ts'" in playwright_config
    assert "'**/SearchSeparation/**'" in playwright_config
    assert "'**/*AfterReindex.spec.ts'" in playwright_config


def test_search_rbac_uses_only_its_setup_and_teardown_projects():
    playwright_config = (
        SCRIPTS.parents[1]
        / "openmetadata-ui/src/main/resources/ui/playwright.config.ts"
    ).read_text()
    search_project = playwright_config.split("name: 'SearchRBAC'", 1)[1].split(
        "name: 'DomainIsolation'", 1
    )[0]

    assert "name: 'search-rbac-setup'" in playwright_config
    assert "teardown: 'search-rbac-teardown'" in playwright_config
    assert "dependencies: ['search-rbac-setup']" in search_project
    assert "DataAssetRulesDisabled" not in search_project


def test_search_rbac_state_setup_maps_only_to_search_rbac():
    impact_map = json.loads(
        (SCRIPTS.parents[0] / "playwright/impact-map.json").read_text()
    )
    mapping = next(
        entry
        for entry in impact_map["mappings"]
        if "openmetadata-ui/src/main/resources/ui/playwright/e2e/search-rbac.setup.ts"
        in entry["sources"]
    )

    assert mapping["projects"] == ["SearchRBAC"]
    assert mapping["specs"] == ["playwright/e2e/Flow/SearchRBAC.spec.ts"]


def test_ingestion_impact_mapping_only_selects_ingestion_data_quality_specs():
    impact_map = json.loads(
        (SCRIPTS.parents[0] / "playwright/impact-map.json").read_text()
    )
    mapping = next(
        entry for entry in impact_map["mappings"] if "ingestion/**" in entry["sources"]
    )

    data_quality_specs = {
        spec for spec in mapping["specs"] if "/Features/DataQuality/" in spec
    }
    assert mapping["projects"] == ["Ingestion"]
    assert data_quality_specs == {
        "playwright/e2e/Features/DataQuality/AddTestCaseNewFlow.spec.ts",
        "playwright/e2e/Features/DataQuality/DataQuality.spec.ts",
        "playwright/e2e/Features/DataQuality/Dimensionality.spec.ts",
        "playwright/e2e/Features/DataQuality/Profiler.spec.ts",
        "playwright/e2e/Features/DataQuality/ProfilerIngestionForm.spec.ts",
    }
    for spec in data_quality_specs:
        source = (
            SCRIPTS.parents[1] / "openmetadata-ui/src/main/resources/ui" / spec
        ).read_text()
        assert "PLAYWRIGHT_INGESTION_TAG_OBJ" in source or "tag: '@ingestion'" in source


def test_dedicated_rdf_specs_are_not_selected_by_the_main_workflow():
    impact_map = json.loads(
        (SCRIPTS.parents[0] / "playwright/impact-map.json").read_text()
    )

    assert (
        "playwright/e2e/Features/KnowledgeGraph.spec.ts" in impact_map["delegatedSpecs"]
    )
    assert (
        "playwright/e2e/Features/OntologyExplorerRdf.spec.ts"
        in impact_map["delegatedSpecs"]
    )
    assert (
        "playwright/e2e/Features/OntologyImportRdf.spec.ts"
        in impact_map["delegatedSpecs"]
    )


def test_summary_reconciles_results_and_evaluates_performance_independently():
    workflow = (
        SCRIPTS.parents[0] / "workflows/playwright-postgresql-e2e.yml"
    ).read_text()
    summary_helper = (SCRIPTS / "render_playwright_summary.cjs").read_text()
    summary_job = workflow.split("  playwright-summary:", 1)[1]
    coverage_step = workflow.split(
        "      - name: Verify Playwright timing coverage", 1
    )[1].split("      - name: Evaluate Playwright performance", 1)[0]
    performance_step = workflow.split(
        "      - name: Evaluate Playwright performance", 1
    )[1].split("      - name: Upload merged Playwright report", 1)[0]

    assert "--result-glob" in coverage_step
    assert "playwright-results-json-*/results.json" in coverage_step
    assert "evaluate_playwright_performance.py" not in coverage_step
    assert "evaluate_playwright_performance.py" in performance_step
    assert "if: ${{ always() && !cancelled() }}" in summary_job
    assert "require('./.github/scripts/render_playwright_summary.cjs')" in summary_job
    assert "await renderPlaywrightSummary({ github, context, core });" in summary_job
    summary_script = summary_job.split("          script: |\n", 1)[1].split(
        "\n      - name:", 1
    )[0]
    assert len(summary_script) < 21_000
    assert "- '.github/scripts/render_playwright_summary.cjs'" in workflow
    assert "'${{ github.run_id }}'" not in summary_helper
    assert "process.env.GITHUB_RUN_ID" in summary_helper
    assert "zero-attempt; reason unknown" in summary_helper
    assert "CI/reporting failure(s)" in summary_helper
    assert "### CI and reporting failures" in summary_helper
    assert "specFile.endsWith('.setup.ts')" in summary_helper
    assert "lifecycleFailures" in summary_helper
    assert "lifecycleFlaky" in summary_helper
    assert ".blockingTargets.reportingAtMostTwoMinutes" in workflow
    assert ".blockingTargetsMet = ([.blockingTargets[]] | all)" in workflow
    assert "### Performance targets" in summary_helper
    assert "### Performance convergence warnings" in summary_helper
    assert "Blocking targets enforce CI" in summary_helper
    assert "convergenceWarnings" in summary_helper
    assert "workflowWallSeconds" in summary_helper
    assert "Full workflow signal wall (to summary)" in summary_helper
    assert "Maximum shard-job elapsed before upload" in summary_helper
    assert "version: 2" in summary_helper
    performance_reporter = (
        SCRIPTS.parents[1]
        / "openmetadata-ui/src/main/resources/ui/playwright/reporters/PerformanceReporter.ts"
    ).read_text()
    assert "lifecycleTests" in performance_reporter


def test_playwright_summary_commonjs_helper_executes(tmp_path):
    helper = SCRIPTS / "render_playwright_summary.cjs"
    results_dir = tmp_path / "results/playwright-results-json-chromium-01"
    results_dir.mkdir(parents=True)
    (results_dir / "results.json").write_text(
        json.dumps(
            {
                "suites": [
                    {
                        "file": "playwright/e2e/example.spec.ts",
                        "specs": [
                            {
                                "title": "passes",
                                "tests": [
                                    {
                                        "status": "expected",
                                        "results": [{}],
                                    }
                                ],
                            }
                        ],
                    }
                ]
            }
        )
    )
    (results_dir / "ci-status.json").write_text(
        json.dumps({"steps": {"tests": "success"}})
    )
    payload_path = tmp_path / "playwright-pr-comment/summary.json"
    harness = f"""
const {{ renderPlaywrightSummary }} = require({json.dumps(str(helper))});
let summaryBody = '';
let failure = null;
const summary = {{
  addRaw(body) {{
    summaryBody = body;
    return summary;
  }},
  async write() {{}},
}};
const core = {{
  summary,
  warning() {{}},
  setFailed(message) {{
    failure = message;
  }},
}};

(async () => {{
  await renderPlaywrightSummary({{
    github: {{}},
    context: {{
      eventName: 'workflow_dispatch',
      payload: {{}},
      repo: {{ owner: 'open-metadata', repo: 'OpenMetadata' }},
    }},
    core,
  }});
  process.stdout.write(JSON.stringify({{ summaryBody, failure }}));
}})().catch(error => {{
  console.error(error.stack || error.message);
  process.exitCode = 1;
}});
"""
    env = os.environ.copy()
    env.update(
        {
            "CHECK_CHANGES_RESULT": "success",
            "CACHE_KEYS_RESULT": "success",
            "BUILD_RESULT": "success",
            "DETECT_CHANGES_RESULT": "success",
            "PLAN_RESULT": "success",
            "FIXTURE_RESTORE_RESULT": "success",
            "FIXTURE_RESULT": "success",
            "PLAYWRIGHT_RESULT": "success",
            "EXPECTED_MATRIX": json.dumps({"include": [{"shardId": "chromium-01"}]}),
            "RUNNER_TEMP": str(tmp_path),
            "COMMENT_PAYLOAD_PATH": str(payload_path),
            "GITHUB_RUN_ID": "12345",
        }
    )

    completed = subprocess.run(
        ["node", "-e", harness],
        cwd=tmp_path,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr
    rendered = json.loads(completed.stdout)
    assert rendered["failure"] is None
    assert "all 1 tests passed" in rendered["summaryBody"]
    assert (
        "https://github.com/open-metadata/OpenMetadata/actions/runs/12345"
        in rendered["summaryBody"]
    )
    payload = json.loads(payload_path.read_text())
    assert payload["totals"]["passed"] == 1
    assert payload["shards"][0]["id"] == "chromium-01"


def test_normal_vite_build_keeps_hashed_entry_assets():
    vite_config = (
        SCRIPTS.parents[1] / "openmetadata-ui/src/main/resources/ui/vite.config.ts"
    ).read_text()
    app_entry = (
        SCRIPTS.parents[1] / "openmetadata-ui/src/main/resources/ui/src/index.tsx"
    ).read_text()

    assert "? 'assets/app-entry-[hash].js'" in vite_config
    assert ": 'assets/[name]-[hash].js'" in vite_config
    assert (
        "'import.meta.env.PW_E2E_BUILD': JSON.stringify(isPlaywrightBuild)"
        in vite_config
    )
    assert "if (!import.meta.env.PW_E2E_BUILD)" in app_entry
    assert "sessionStorage.getItem(scenarioKey)" in app_entry
    assert "'playwright-app-boot': '1'" in app_entry
    assert "diagnostics.set('playwright-ui-scenario', '1')" in app_entry
