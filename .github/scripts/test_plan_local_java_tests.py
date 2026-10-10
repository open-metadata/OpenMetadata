from __future__ import annotations

import copy
import fnmatch
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT_PATH = Path(__file__).with_name("plan_local_java_tests.py")
SPEC = importlib.util.spec_from_file_location("plan_local_java_tests", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
PLANNER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = PLANNER
SPEC.loader.exec_module(PLANNER)

REPO_ROOT = Path(__file__).resolve().parents[2]
IMPACT_MAP = json.loads((REPO_ROOT / PLANNER.IMPACT_MAP).read_text(encoding="utf-8"))
REPO = PLANNER.Repo(REPO_ROOT, IMPACT_MAP)
SERVICE = "openmetadata-service/src/main/java/org/openmetadata/service"
IT_ROOT = "openmetadata-integration-tests/src/test/java/org/openmetadata/it"
IT_TESTS = f"{IT_ROOT}/tests"
TABLE_REPOSITORY = f"{SERVICE}/jdbi3/TableRepository.java"
RESILIENCE_IT = "org/openmetadata/it/tests/TestCaseDeleteResilienceIT.java"


def plan_for(*changed: str, methods: dict[str, set[str]] | None = None):
    planner = PLANNER.Planner(REPO, IMPACT_MAP)
    return planner, planner.plan(list(changed), changed_methods=methods)


def its(plan) -> dict[str, list[str]]:
    return {
        REPO.it_classes[path]: sel.run_engines
        for path, sel in plan.integration_tests.items()
    }


def it_commands(plan) -> list[list[str]]:
    return [command.argv for command in plan.commands if command.kind == "integration"]


def lane_its() -> set[str]:
    return {
        REPO.it_classes[relative]
        for relative in PLANNER.Planner(REPO, IMPACT_MAP)._lane_its()
    }


def test_impact_map_owns_every_test_and_production_file() -> None:
    assert PLANNER.audit_impact_map(REPO, IMPACT_MAP) == []


def test_the_committed_map_owns_every_committed_test_and_production_file() -> None:
    head_map = json.loads(
        subprocess.run(
            ["git", "show", f"HEAD:{PLANNER.IMPACT_MAP}"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    )
    committed = PLANNER.Repo(REPO_ROOT, head_map, ref="HEAD")

    assert committed.it_classes and committed.it_sources
    assert PLANNER.audit_impact_map(committed, head_map) == []


def test_a_push_is_checked_at_the_commit_it_sends_not_the_working_tree(
    tmp_path: Path,
) -> None:
    def git(*args: str) -> str:
        isolated = ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false"]
        author = ["-c", "user.name=t", "-c", "user.email=t@t"]
        return subprocess.run(
            ["git", *isolated, *author, *args],
            cwd=tmp_path,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

    git("init", "-q")
    (tmp_path / "map.json").write_text('{"v": 1}')
    git("add", ".")
    git("commit", "-qm", "base")
    base = git("rev-parse", "HEAD")
    (tmp_path / "svc").mkdir()
    (tmp_path / "svc/New.java").write_text("class New {}")
    git("add", ".")
    git("commit", "-qm", "adds code")
    # Neither of these is pushed: an unstaged map fix and an untracked scratch file.
    (tmp_path / "map.json").write_text('{"v": 2}')
    (tmp_path / "scratch").mkdir()
    (tmp_path / "scratch/Scratch.java").write_text("class Scratch {}")

    assert PLANNER.branch_changes(tmp_path, base, "HEAD") == (["svc/New.java"], [])
    assert PLANNER.read_blobs(tmp_path, "HEAD", ["map.json", "gone.txt"]) == {
        "map.json": '{"v": 1}'
    }
    assert PLANNER.committed_files(tmp_path, "HEAD") == ["map.json", "svc/New.java"]
    changed, _ = PLANNER.branch_changes(tmp_path, base, None)
    assert {"map.json", "scratch/Scratch.java", "svc/New.java"} <= set(changed)


def test_the_pre_pr_hook_checks_the_ref_the_command_sends(tmp_path: Path) -> None:
    def git(*args: str) -> None:
        isolated = ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false"]
        author = ["-c", "user.name=t", "-c", "user.email=t@t"]
        subprocess.run(
            ["git", *isolated, *author, *args],
            cwd=tmp_path,
            check=True,
            capture_output=True,
        )

    # A planner that fails the check it is asked for, so the hook prints which one.
    planner = tmp_path / ".github/scripts/plan_local_java_tests.py"
    planner.parent.mkdir(parents=True)
    planner.write_text('import sys  # "--head"\nprint(*sys.argv[1:])\nsys.exit(1)\n')
    git("init", "-q", "-b", "work")
    git("add", ".")
    git("commit", "-qm", "base")
    git("branch", "feature")
    git("update-ref", "refs/remotes/origin/main", "HEAD")
    git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main")
    env = {**os.environ, "CLAUDE_PROJECT_DIR": str(tmp_path)}
    env.pop("CLAUDE_TOOL_INPUT", None)

    def checked(command: str) -> str:
        hook = subprocess.run(
            ["bash", str(SCRIPT_PATH.with_name("java_impact_map_hook.sh")), "pre-pr"],
            input=json.dumps({"tool_input": {"command": command}}),
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        assert hook.returncode == 2, command
        return hook.stderr.strip()

    sends = {
        "git push -o ci.skip origin feature": "feature",
        "git push --push-option ci.skip origin +feature:other": "feature",
        "git push origin feature -o ci.skip": "feature",
        # A bundled option's value is taken for the remote, and the remote's name for the
        # source; a remote's name is never checked.
        "git push -fo ci.skip origin feature": "HEAD",
        "git push": "HEAD",
        "gh pr create --head someone:feature --title t": "feature",
    }
    for command, ref in sends.items():
        expected = f"--check-branch --base origin/main --head {ref}"
        assert checked(command) == expected, command


def unowning(*paths: str) -> dict:
    """The impact map with every area source that owns one of `paths` removed."""
    impact_map = copy.deepcopy(IMPACT_MAP)
    for area in impact_map["areas"]:
        area["sources"] = [
            source
            for source in area["sources"]
            if not any(fnmatch.fnmatchcase(path, source) for path in paths)
        ]
    return impact_map


def test_the_branch_check_blames_the_branch_only_for_what_it_touched() -> None:
    touched = f"{SERVICE}/apps/bundles/insights/DataInsightsApp.java"
    untouched = f"{SERVICE}/util/AsciiTable.java"
    impact_map = unowning(touched, untouched)

    problems = PLANNER.branch_map_problems(REPO, impact_map, impact_map, [touched], [])

    assert len(problems) == 1
    assert f'add "{SERVICE}/apps/bundles/insights/**"' in problems[0]
    assert "the code it imports belongs to" in problems[0]
    assert PLANNER.branch_map_problems(REPO, impact_map, impact_map, [], []) == []


def test_the_branch_check_flags_patterns_the_branch_empties_or_adds_dead() -> None:
    impact_map = copy.deepcopy(IMPACT_MAP)
    area = impact_map["areas"][0]
    area["tests"].append("org/openmetadata/it/tests/gone/**")
    deleted = [f"{IT_TESTS}/gone/GoneIT.java"]

    emptied = PLANNER.branch_map_problems(REPO, impact_map, impact_map, [], deleted)
    already_dead = PLANNER.branch_map_problems(REPO, impact_map, impact_map, [], [])
    added = PLANNER.branch_map_problems(REPO, impact_map, IMPACT_MAP, [], [])

    assert len(emptied) == 1 and "this branch deleted what it matched" in emptied[0]
    assert already_dead == []
    assert len(added) == 1 and "this branch added it" in added[0]


def test_a_map_edit_that_breaks_a_rule_is_the_branch_problem() -> None:
    impact_map = copy.deepcopy(IMPACT_MAP)
    area = impact_map["areas"][0]
    area["tests"].append("TableResourceIT")
    changed = [PLANNER.IMPACT_MAP]
    single = "'TableResourceIT' names a single test; match tests by pattern"

    assert PLANNER.branch_map_problems(REPO, impact_map, IMPACT_MAP, changed, []) == [
        f"area '{area['name']}': {single}"
    ]
    assert PLANNER.branch_map_problems(REPO, impact_map, impact_map, changed, []) == []


def test_a_written_file_no_area_owns_is_reported_with_where_it_belongs() -> None:
    stems = {PLANNER.convention_stem(path) for path in REPO.files} - {None}
    relative, name = next(
        (relative, name)
        for relative, name in sorted(REPO.it_classes.items())
        if relative not in REPO.never_run
        and relative not in REPO.conditional
        and not any(PLANNER.stem_matches(stem, name) for stem in stems)
    )
    it = f"{REPO.it_root}/{relative}"
    production = f"{SERVICE}/apps/bundles/insights/DataInsightsApp.java"
    impact_map = unowning(production)
    for area in impact_map["areas"]:
        area["tests"] = [
            pattern
            for pattern in area["tests"]
            if not PLANNER.Planner._it_pattern_matches(relative, name, pattern)
        ]

    problems = PLANNER.owner_problems(REPO, impact_map, [production, it])

    assert len(problems) == 2
    assert problems[0].startswith("no area owns 1 file in ")
    assert problems[1].startswith(f"{name} ({it}): no area owns it")
    assert PLANNER.owner_problems(REPO, IMPACT_MAP, [production, it]) == []


def test_audit_reports_single_tests_unowned_code_and_dead_patterns() -> None:
    broken = json.loads(json.dumps(IMPACT_MAP))
    databases = next(area for area in broken["areas"] if area["name"] == "databases")
    databases["tests"] = ["StoredProcedureResourceIT", "NoSuch*IT"]
    databases["sources"].append(f"{SERVICE}/nowhere/**")
    databases["engines"] = ["oracle-solr"]
    broken["areas"] = [area for area in broken["areas"] if area["name"] != "search"]

    problems = PLANNER.audit_impact_map(REPO, broken)

    assert (
        "area 'databases': 'StoredProcedureResourceIT' names a single test; match tests by pattern"
        in problems
    )
    assert (
        "area 'databases': test pattern 'NoSuch*IT' matches no test class" in problems
    )
    assert (
        f"area 'databases': source '{SERVICE}/nowhere/**' matches no file" in problems
    )
    assert any("'oracle-solr'" in problem for problem in problems)
    assert any(problem.startswith("AccentInsensitiveSearchIT ") for problem in problems)
    assert any(
        problem.startswith("no area owns") and f"{SERVICE}/search/ " in problem
        for problem in problems
    )


def test_lane_membership_is_read_from_the_it_pom() -> None:
    planner = PLANNER.Planner(REPO, IMPACT_MAP)
    by_name = {name: relative for relative, name in REPO.it_classes.items()}

    assert planner.lane_for(by_name["SystemResourceIT"]) == "isolated"
    assert planner.lane_for(by_name["SessionMultiNodeIT"]) == "isolated"
    assert planner.lane_for(by_name["SearchIndexRetryQueueIT"]) == "isolated"
    assert planner.lane_for(by_name["RdfResourceIT"]) == "rdf"
    assert planner.lane_for(by_name["ReindexStatsIT"]) == "search-it"
    assert planner.lane_for(by_name["TableResourceIT"]) == "parallel"


def test_classes_no_lane_runs_are_read_from_the_code_and_the_pom() -> None:
    by_name = {name: relative for relative, name in REPO.it_classes.items()}

    assert by_name["BaseEntityIT"] in REPO.never_run  # abstract
    assert (
        by_name["ChangeEventParserResourceIT"] in REPO.never_run
    )  # class-level @Disabled
    assert (
        by_name["StaticDatasetSeedIT"] in REPO.never_run
    )  # the search-it profile excludes it
    assert REPO.conditional[by_name["RdfCatalogScaleIT"]] == "rdfCatalogScale"
    assert by_name["TableResourceIT"] not in REPO.never_run


def test_a_change_runs_the_tests_that_name_it_and_its_callers_tests() -> None:
    # The review case: TestCaseDeleteResilienceIT guards TableRepository's delete cleanup
    # from outside the databases area, and the old map missed it.
    _, plan = plan_for(TABLE_REPOSITORY)

    reasons = plan.integration_tests[RESILIENCE_IT].reasons
    assert "uses TableRepository" in reasons
    assert "called from entity TestCase" in reasons
    assert (
        "area databases"
        in plan.integration_tests[
            "org/openmetadata/it/tests/TableResourceIT.java"
        ].reasons
    )
    assert "EntityRepositoryRestoreTest" in plan.unit_tests["openmetadata-service"]
    assert plan.unmapped_files == [] and not plan.full_suite


def test_changed_methods_narrow_the_callers_and_name_regression_tests() -> None:
    _, whole = plan_for(TABLE_REPOSITORY)
    _, cleanup = plan_for(
        TABLE_REPOSITORY, methods={TABLE_REPOSITORY: {"entitySpecificCleanup"}}
    )

    assert (
        "uses entitySpecificCleanup" in cleanup.integration_tests[RESILIENCE_IT].reasons
    )
    assert len(cleanup.integration_tests) < len(whole.integration_tests)


def test_a_method_counts_only_where_its_class_is_named_too() -> None:
    # BaseEntityIT's own createEntity helpers are not EntityRepository's createEntity.
    planner = PLANNER.Planner(REPO, IMPACT_MAP)
    anchored = PLANNER.Plan(changed_files=[])
    unanchored = PLANNER.Plan(changed_files=[])

    planner._add_referencing_its(
        anchored,
        TABLE_REPOSITORY,
        "entitySpecificCleanup",
        set(),
        True,
        "TableRepository",
    )
    planner._add_referencing_its(
        unanchored,
        TABLE_REPOSITORY,
        "entitySpecificCleanup",
        set(),
        True,
        "NoSuchClass",
    )

    assert RESILIENCE_IT in anchored.integration_tests
    assert unanchored.integration_tests == {}


def test_methods_using_finds_the_methods_whose_bodies_name_a_symbol() -> None:
    source = """
    class Helper {
      // JobDAO in a comment is not a use
      public static void waitForJobs(String name) {
        JobDAO dao = lookup("JobDAO in a string");
        if (dao != null) { dao.poll(); }
      }

      private int unrelated() { return 1; }

      void other() {
        unrelated();
      }
    }
    """

    assert PLANNER.methods_using(source, "JobDAO") == {"waitForJobs"}
    assert PLANNER.methods_using(source, "unrelated") == {"other"}


def test_a_helper_most_its_use_is_followed_only_through_its_methods() -> None:
    # TestSuiteBootstrap names K8sPipelineClient; following the bootstrap by its class
    # name selected all 201 ITs that use it.
    _, plan = plan_for(f"{SERVICE}/clients/pipeline/k8s/K8sPipelineClient.java")

    assert not plan.full_suite
    assert len(plan.integration_tests) < 60


def test_a_change_to_a_helper_most_its_use_selects_by_its_changed_methods() -> None:
    sdk_clients = f"{IT_ROOT}/util/SdkClients.java"

    _, unknown = plan_for(sdk_clients)
    _, narrow = plan_for(sdk_clients, methods={sdk_clients: {"dataStewardClient"}})

    assert unknown.full_suite == {"SdkClients is used by most ITs": {sdk_clients}}
    assert not narrow.full_suite
    assert any(
        "uses dataStewardClient" in selection.reasons
        for selection in narrow.integration_tests.values()
    )
    assert len(narrow.integration_tests) < 50


def test_every_it_command_pins_an_engine_profile_and_skips_unit_tests() -> None:
    # Without an explicit -P<engine> a lane run executes zero tests and still prints
    # BUILD SUCCESS; without the -Dtest filter `-am` runs every upstream unit suite.
    _, plan = plan_for(
        f"{IT_TESTS}/TableResourceIT.java",
        f"{IT_TESTS}/SystemResourceIT.java",
        f"{IT_TESTS}/RdfResourceIT.java",
        f"{IT_TESTS}/search/ReindexStatsIT.java",
    )

    commands = it_commands(plan)
    assert len(commands) == 4
    for argv in commands:
        assert any(arg.startswith("-P") for arg in argv)
        assert "-am" in argv and "-Dfailsafe.failIfNoSpecifiedTests=false" in argv
        assert all(arg in argv for arg in PLANNER.SKIP_UNIT_TESTS)
    lanes = {
        next(arg for arg in argv if arg.startswith("-Dit.test=")): argv
        for argv in commands
    }
    assert "-DintegrationTests.lane=global-state" in lanes["-Dit.test=SystemResourceIT"]
    assert "-DintegrationTests.lane=rdf" in lanes["-Dit.test=RdfResourceIT"]
    assert "-Psearch-it" in lanes["-Dit.test=ReindexStatsIT"]


def test_engine_specific_search_change_runs_its_tests_on_that_engine() -> None:
    opensearch = next(
        path for path in REPO.files if path.startswith(f"{SERVICE}/search/opensearch/")
    )
    elasticsearch = next(
        path
        for path in REPO.files
        if path.startswith(f"{SERVICE}/search/elasticsearch/")
    )

    _, os_plan = plan_for(opensearch)
    _, es_plan = plan_for(elasticsearch)

    assert its(os_plan)["ReindexAliasSwapIT"] == ["postgres-opensearch"]
    assert its(es_plan)["ReindexAliasSwapIT"] == ["mysql-elasticsearch"]
    assert its(os_plan)["SearchResourceIT"] == ["postgres-opensearch"]


def test_it_helper_selects_the_its_that_reach_it_through_other_helpers() -> None:
    _, plan = plan_for(f"{IT_TESTS}/MergedMetricMigrationFixture.java")

    assert "uses MergedMetricMigrationFixture" in (
        plan.integration_tests[
            "org/openmetadata/it/tests/MetricMigrationIT.java"
        ].reasons
    )
    assert plan.unmapped_files == []


def test_smoke_runs_for_any_code_change_but_not_for_a_changed_test_alone() -> None:
    _, code = plan_for(f"{SERVICE}/util/AsciiTable.java")
    _, test = plan_for(f"{IT_TESTS}/TableResourceIT.java")

    assert set(IMPACT_MAP["smoke"]) <= set(its(code))
    assert set(its(test)) == {"TableResourceIT"}


def test_root_pom_runs_every_unit_suite_and_the_full_it_suite() -> None:
    _, plan = plan_for("pom.xml")

    assert set(plan.full_unit_modules) == set(IMPACT_MAP["maven"]["unitTestModules"])
    assert plan.full_suite == {"shared infrastructure": {"pom.xml"}}
    assert set(its(plan)) == lane_its()
    unit = [command for command in plan.commands if command.kind == "unit"]
    assert len(unit) == 1
    selector = next(arg for arg in unit[0].argv if arg.startswith("-Dtest="))
    assert "org/openmetadata/mcp/**/*Test.java" in selector
    assert "org/openmetadata/service/**/*Test.java" in selector


def test_the_full_suite_is_what_the_merge_queue_runs() -> None:
    _, plan = plan_for("pom.xml")
    selected = set(its(plan))

    assert "ReindexStatsIT" not in selected  # search-it runs nightly, not in the queue
    assert "ChangeEventParserResourceIT" not in selected  # @Disabled
    assert "RdfCatalogScaleIT" not in selected  # needs -DrdfCatalogScale=true
    assert "SimpleReindexTriggerUIIT" not in selected
    assert plan.not_run_locally == {}


def test_core_framework_change_runs_the_full_suite() -> None:
    _, plan = plan_for(f"{SERVICE}/jdbi3/EntityRepository.java")

    assert "area core" in plan.full_suite
    assert set(its(plan)) >= lane_its()


def test_a_file_no_area_owns_is_a_gap_that_runs_the_full_suite() -> None:
    unowned = f"{SERVICE}/brandnewpackage/Thing.java"

    _, plan = plan_for(unowned)

    assert plan.unmapped_files == [unowned]
    assert plan.full_suite == {"no area owns the file": {unowned}}


def test_author_additions_need_a_reason_and_are_recorded() -> None:
    planner = PLANNER.Planner(REPO, IMPACT_MAP)
    ui_only = ["openmetadata-ui/src/main/resources/ui/src/App.tsx"]

    with pytest.raises(SystemExit):
        planner.plan(ui_only, add_its=["SystemResourceIT"])
    plan = planner.plan(
        ui_only,
        add_its=["SystemResourceIT"],
        add_units=["AsciiTableTest"],
        add_areas=["lineage"],
        reason="the change alters lineage edges",
    )

    label = "added by author: the change alters lineage edges"
    assert its(plan)["SystemResourceIT"] == ["mysql-elasticsearch"]
    assert (
        label
        in plan.integration_tests[
            "org/openmetadata/it/tests/LineageResourceIT.java"
        ].reasons
    )
    assert plan.unit_tests == {"openmetadata-service": {"AsciiTableTest": {label}}}
    assert plan.triggers[label] == {
        "SystemResourceIT",
        "AsciiTableTest",
        "area lineage",
    }


def test_changed_methods_come_from_hunk_headers_and_changed_declarations(
    tmp_path: Path,
) -> None:
    def git(*args: str) -> None:
        isolated = ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false"]
        subprocess.run(
            ["git", *isolated, *args], cwd=tmp_path, check=True, capture_output=True
        )

    source = tmp_path / "Foo.java"
    source.write_text(
        "class Foo {\n  public int alpha() {\n    return 1;\n  }\n\n"
        "  public int beta() {\n    return 2;\n  }\n}\n"
    )
    git("init", "-q")
    git("add", "Foo.java")
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init")
    source.write_text(
        "class Foo {\n  public int alpha() {\n    return 10;\n  }\n\n"
        "  public int beta() {\n    return 2;\n  }\n\n"
        "  public int gamma() {\n    return 3;\n  }\n}\n"
    )

    methods = PLANNER.collect_changed_methods(tmp_path, "HEAD", ["Foo.java"])

    assert {"alpha", "gamma"} <= methods["Foo.java"]


def test_ci_run_stands_in_only_for_a_passed_it_workflow_run_on_head(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workflows = IMPACT_MAP["maven"]["ciWorkflows"]
    mysql = workflows["mysql-elasticsearch"]["workflow"]
    redis = workflows["cache-tests"]["workflow"]

    def lanes(*names: str) -> list[dict[str, str]]:
        return [
            {"name": f"Integration Test Lane ({name})", "conclusion": "success"}
            for name in names
        ]

    every_lane = lanes(
        "parallel-1", "parallel-2", "global-state", "multi-node+retry-queue", "rdf"
    )
    # A workflow whose change detection skipped its lanes still concludes success.
    skipped = [
        {
            "name": "Integration Test Lane (${{ matrix.lane.name }})",
            "conclusion": "skipped",
        }
    ]
    runs = {
        "1": ("abc", "success", mysql, every_lane),
        "2": ("old", "success", mysql, every_lane),
        "3": ("abc", "failure", mysql, every_lane),
        "4": ("abc", "success", "Playwright", every_lane),
        "5": ("abc", "success", mysql, skipped),
        "6": (
            "abc",
            "success",
            redis,
            lanes("parallel-1", "parallel-2", "global-state", "multi-node+retry-queue"),
        ),
        "7": (
            "abc",
            "success",
            mysql,
            lanes("parallel-1", "parallel-2", "global-state", "rdf"),
        ),
        "8": (
            "abc",
            "success",
            mysql,
            lanes("parallel-1", "global-state", "multi-node+retry-queue", "rdf"),
        ),
    }

    def gh_run_view(argv, **_):
        head, conclusion, workflow, jobs = runs[argv[3]]
        run = {"headSha": head, "status": "completed", "conclusion": conclusion}
        run |= {"url": f"https://ci/{argv[3]}", "workflowName": workflow, "jobs": jobs}
        return subprocess.CompletedProcess(argv, 0, stdout=json.dumps(run), stderr="")

    monkeypatch.setattr(PLANNER.subprocess, "run", gh_run_view)

    assert PLANNER.ci_evidence(REPO_ROOT, ["1"], "abc", workflows) == {
        "mysql-elasticsearch": {
            "url": "https://ci/1",
            "lanes": {"parallel", "isolated", "rdf"},
        }
    }
    # The Redis workflow runs no rdf lane, so its runs never cover an rdf step.
    assert PLANNER.ci_evidence(REPO_ROOT, ["6"], "abc", workflows)["cache-tests"][
        "lanes"
    ] == {"parallel", "isolated"}
    # The isolated lane is two CI jobs; one missing leaves it to the local run.
    assert PLANNER.ci_evidence(REPO_ROOT, ["7"], "abc", workflows)[
        "mysql-elasticsearch"
    ]["lanes"] == {"parallel", "rdf"}
    # So is the parallel lane: one half of it is not the lane.
    assert PLANNER.ci_evidence(REPO_ROOT, ["8"], "abc", workflows)[
        "mysql-elasticsearch"
    ]["lanes"] == {"isolated", "rdf"}
    for unusable in ("2", "3", "4", "5"):
        with pytest.raises(SystemExit):
            PLANNER.ci_evidence(REPO_ROOT, [unusable], "abc", workflows)


def test_steps_a_ci_run_covers_are_not_run_locally(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _, plan = plan_for(
        f"{IT_TESTS}/RdfResourceIT.java", f"{SERVICE}/util/AsciiTable.java"
    )
    ran: list[list[str]] = []

    def run(argv, _repo_root):
        ran.append(argv)
        return 0, None

    monkeypatch.setattr(PLANNER, "run_step", run)
    ci = {
        "mysql-elasticsearch": {
            "url": "https://ci/6",
            "lanes": {"parallel", "isolated"},
        }
    }
    results = PLANNER.run_commands(tmp_path, plan, True, ci)

    by_lane = {
        result.command.lane: result
        for result in results
        if result.command.engine == "mysql-elasticsearch"
    }
    assert by_lane["parallel"].ci_url == "https://ci/6"
    assert by_lane["rdf"].ci_url == ""
    assert any("-DintegrationTests.lane=rdf" in argv for argv in ran)
    assert not any("-DintegrationTests.lane=parallel" in argv for argv in ran)


def test_commands_in_the_pr_abbreviate_long_class_lists() -> None:
    argv = ["mvn", "-Dit.test=" + ",".join(f"C{i}IT" for i in range(40)), "-Pmysql"]

    assert PLANNER.display_command(argv) == "mvn '-Dit.test=<40 classes>' -Pmysql"


def test_postgres_migration_runs_the_migration_tests_on_postgres_only() -> None:
    _, plan = plan_for(
        "bootstrap/sql/migrations/native/2.1.0/postgres/schemaChanges.sql"
    )

    selected = its(plan)
    assert selected["ContinuousMigrationIT"] == ["postgres-opensearch"]
    assert selected["ConversationSchemaMigrationIT"] == ["postgres-opensearch"]
    assert all("-Pmysql-elasticsearch" not in argv for argv in it_commands(plan))


def test_changed_search_it_class_runs_on_the_search_it_engine() -> None:
    _, plan = plan_for(f"{IT_TESTS}/search/ReindexStatsIT.java")

    assert its(plan) == {"ReindexStatsIT": ["postgres-opensearch"]}
    argv = it_commands(plan)[0]
    assert "-DdatabaseType=postgres" in argv and "-DsearchType=opensearch" in argv


def test_nightly_and_never_run_classes_are_reported_not_run() -> None:
    uiit = next(
        path for path in REPO.files if path.endswith("SimpleReindexTriggerUIIT.java")
    )
    scale = f"{IT_TESTS}/search/scale/ReindexBenchmarkIT.java"
    seed = f"{IT_TESTS}/search/StaticDatasetSeedIT.java"

    _, plan = plan_for(uiit, scale, seed)

    assert plan.integration_tests == {}
    assert {PLANNER.simple_name(path) for path in plan.not_run_locally} == {
        "SimpleReindexTriggerUIIT",
        "ReindexBenchmarkIT",
    }


def test_it_helper_no_test_reaches_is_a_gap_that_falls_back_to_smoke() -> None:
    helper = "openmetadata-integration-tests/src/test/java/org/openmetadata/it/auth/NoSuchHelper.java"

    _, plan = plan_for(helper)

    assert plan.unmapped_files == [helper]
    assert set(its(plan)) == set(IMPACT_MAP["smoke"])


def test_tests_that_only_run_nightly_are_named_in_the_not_needed_block() -> None:
    uiit = next(
        path for path in REPO.files if path.endswith("SimpleReindexTriggerUIIT.java")
    )
    _, plan = plan_for(uiit)

    block = PLANNER.render_no_tests_block(
        plan, "0123456789abcdef", "origin/main", False
    )

    assert plan.commands == []
    assert "NOT NEEDED** — the impacted tests don't run locally" in block
    assert "`SimpleReindexTriggerUIIT` →" in block


def test_untracked_files_the_plan_reads_mark_the_run_uncommitted(
    tmp_path: Path,
) -> None:
    def git(*args: str) -> None:
        isolated = ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false"]
        subprocess.run(
            ["git", *isolated, *args], cwd=tmp_path, check=True, capture_output=True
        )

    git("init", "-q")
    (tmp_path / "pom.xml").write_text("<project/>")
    git("add", "pom.xml")
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init")
    ignore = ["*.md"]

    (tmp_path / "notes.md").write_text("scratch")
    assert not PLANNER.has_uncommitted_changes(tmp_path, ignore)
    (tmp_path / "NewIT.java").write_text("class NewIT {}")
    assert PLANNER.has_uncommitted_changes(tmp_path, ignore)


def test_ui_and_docs_only_change_selects_nothing() -> None:
    _, plan = plan_for(
        "openmetadata-ui/src/main/resources/ui/src/App.tsx",
        "skills/pr-checklist/SKILL.md",
        "README.md",
    )

    assert not plan.has_tests()
    assert plan.commands == []


def test_heavily_shared_class_escalates_to_the_full_unit_suite() -> None:
    _, plan = plan_for(
        "openmetadata-spec/src/main/resources/json/schema/entity/data/glossaryTerm.json"
    )

    assert "openmetadata-service" in plan.full_unit_modules
    assert "openmetadata-service" not in plan.unit_tests
    assert "GlossaryTermResourceIT" in its(plan)


def test_tests_that_need_one_backend_run_only_there() -> None:
    _, plan = plan_for(
        "openmetadata-service/src/main/java/org/openmetadata/service/search/vector/VectorIndexService.java",
        "openmetadata-service/src/main/java/org/openmetadata/service/cache/CacheConfig.java",
    )

    selected = its(plan)
    assert selected["PatchTableEmbeddingIT"] == ["postgres-opensearch"]
    assert selected["UncachedReadIT"] == ["cache-tests"]
    assert "cache-tests" in selected["EntityCacheInvalidationIT"]


def test_reports_count_failures_and_selected_classes_that_never_ran(
    tmp_path: Path,
) -> None:
    reports = tmp_path / "failsafe-reports"
    reports.mkdir()
    (reports / "TEST-org.openmetadata.it.tests.TableResourceIT.xml").write_text(
        '<testsuite name="org.openmetadata.it.tests.TableResourceIT" tests="3" failures="1" errors="0" skipped="1">'
        '<testcase classname="org.openmetadata.it.tests.TableResourceIT" name="ok"/>'
        '<testcase classname="org.openmetadata.it.tests.TableResourceIT" name="broken"><failure/></testcase>'
        "</testsuite>"
    )
    command = PLANNER.Command(
        "integration",
        "mysql-elasticsearch · parallel",
        [],
        ["failsafe-reports"],
        ["TableResourceIT", "UserResourceIT"],
    )
    result = PLANNER.StepResult(command, exit_code=0, minutes=1.0)

    PLANNER.collect_reports(tmp_path, command.report_dirs, result)

    assert (result.tests, result.failures, result.skipped) == (3, 1, 1)
    assert result.failed_tests == ["TableResourceIT#broken"]
    assert result.missing_classes == ["UserResourceIT"]
    assert not result.passed


def test_results_block_lists_every_class_each_step_ran(tmp_path: Path) -> None:
    reports = tmp_path / "failsafe-reports"
    reports.mkdir()
    for name, tests, failures, skipped in (
        ("TableResourceIT", 40, 1, 2),
        ("UserResourceIT", 12, 0, 0),
    ):
        (reports / f"TEST-org.openmetadata.it.tests.{name}.xml").write_text(
            f'<testsuite name="org.openmetadata.it.tests.{name}" tests="{tests}" '
            f'failures="{failures}" errors="0" skipped="{skipped}"/>'
        )
    command = PLANNER.Command(
        "integration",
        "mysql-elasticsearch · parallel",
        [],
        ["failsafe-reports"],
        ["TableResourceIT", "UserResourceIT"],
    )
    result = PLANNER.StepResult(command, exit_code=1, minutes=3.0)
    PLANNER.collect_reports(tmp_path, command.report_dirs, result)

    text = "\n".join(PLANNER.render_tests_run([result]))

    assert (
        "- integration · mysql-elasticsearch · parallel: "
        "`TableResourceIT` (37 passed, 1 failed, 2 skipped), `UserResourceIT` (12 passed)"
    ) in text


def test_a_long_class_list_is_collapsed() -> None:
    command = PLANNER.Command("integration", "mysql-elasticsearch · parallel", [], [])
    result = PLANNER.StepResult(
        command,
        exit_code=0,
        minutes=9.0,
        tests=400,
        class_counts={f"C{i}IT": [10, 0, 0] for i in range(40)},
    )

    text = "\n".join(PLANNER.render_tests_run([result]))

    assert "40 classes, 400 tests executed (listed below)" in text
    assert (
        "<details><summary>integration · mysql-elasticsearch · parallel: 40 classes</summary>"
        in text
    )
    assert "`C39IT` (10 passed)" in text


def test_a_module_run_in_full_is_counted_and_classes_selected_by_name_are_listed() -> (
    None
):
    service = "openmetadata-service/target/surefire-reports"
    mcp = "openmetadata-mcp/target/surefire-reports"
    command = PLANNER.Command(
        "unit",
        "openmetadata-service (full suite), openmetadata-mcp (1 class)",
        [],
        [service, mcp],
        ["McpToolsTest"],
        [service],
    )
    full_suite = {f"C{i}Test": [10, 1, 0] for i in range(1000)}
    result = PLANNER.StepResult(
        command,
        exit_code=0,
        minutes=30.0,
        class_counts={**full_suite, "McpToolsTest": [3, 0, 0]},
        class_dirs={**{name: service for name in full_suite}, "McpToolsTest": mcp},
    )

    text = "\n".join(PLANNER.render_tests_run([result]))

    assert (
        "full openmetadata-service suite, 1000 classes, 9000 tests executed; "
        "`McpToolsTest` (3 passed)"
    ) in text
    assert "C999Test" not in text


def test_class_lists_past_the_budget_are_cut_to_counts() -> None:
    def step(engine: str) -> object:
        return PLANNER.StepResult(
            PLANNER.Command("integration", f"{engine} · parallel", [], []),
            exit_code=0,
            minutes=60.0,
            class_counts={
                f"SomeLongEntityNameResource{i}IT": [20, 0, 0] for i in range(400)
            },
        )

    text = "\n".join(
        PLANNER.render_tests_run(
            [step("mysql-elasticsearch"), step("postgres-opensearch")]
        )
    )

    assert len(text) < PLANNER.CLASS_LIST_BUDGET + 2_000
    assert (
        "400 classes, 8000 tests executed (too many to list in the PR description)"
        in text
    )
    assert "SomeLongEntityNameResource399IT" in text


def test_a_step_that_ran_no_tests_is_not_a_pass() -> None:
    command = PLANNER.Command("integration", "lane", [], [], [])

    assert not PLANNER.StepResult(command, exit_code=0, minutes=0.1).passed


def test_a_step_whose_tests_all_skipped_is_not_a_pass(tmp_path: Path) -> None:
    reports = tmp_path / "failsafe-reports"
    reports.mkdir()
    (reports / "TEST-org.openmetadata.it.tests.PatchTableEmbeddingIT.xml").write_text(
        '<testsuite name="org.openmetadata.it.tests.PatchTableEmbeddingIT" tests="1" failures="0" errors="0" skipped="1"/>'
    )
    command = PLANNER.Command(
        "integration", "lane", [], ["failsafe-reports"], ["PatchTableEmbeddingIT"]
    )
    result = PLANNER.StepResult(command, exit_code=0, minutes=1.0)

    PLANNER.collect_reports(tmp_path, command.report_dirs, result)

    assert result.all_skipped_classes == ["PatchTableEmbeddingIT"]
    assert not result.passed


def test_step_totals_add_up_the_summary_each_execution_prints(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    per_class = (
        "[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 66.4 s "
        "-- in org.openmetadata.it.tests.TableResourceIT"
    )
    lane = "[WARNING] Tests run: 1898, Failures: 0, Errors: 0, Skipped: 159"
    flaky = "[ERROR] Tests run: 9, Failures: 1, Errors: 1, Skipped: 0, Flakes: 2"
    script = (
        f"print({per_class!r}); print({lane!r}); print({flaky!r}); raise SystemExit(3)"
    )

    exit_code, totals = PLANNER.run_step([sys.executable, "-c", script], tmp_path)

    assert (exit_code, totals) == (3, [1907, 1, 1, 159])
    assert "-- in org.openmetadata.it.tests.TableResourceIT" in capsys.readouterr().out
    assert PLANNER.run_step(
        [sys.executable, "-c", "print('BUILD FAILURE')"], tmp_path
    ) == (0, None)


def test_a_nested_class_several_its_inherit_does_not_shrink_the_step_totals(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    command = PLANNER.Command(
        "integration",
        "mysql-elasticsearch · parallel",
        ["mvn", "verify"],
        ["failsafe-reports"],
        ["TableResourceIT", "UserResourceIT"],
    )

    def run(_argv, repo_root):
        # Both ITs inherit BaseEntityIT's nested class; its report keeps the second run only.
        reports = repo_root / "failsafe-reports"
        reports.mkdir()
        for name, tests in (
            ("TableResourceIT", 10),
            ("UserResourceIT", 5),
            ("BaseEntityIT$HistoryTest", 4),
        ):
            (reports / f"TEST-org.openmetadata.it.tests.{name}.xml").write_text(
                f'<testsuite name="org.openmetadata.it.tests.{name}" tests="{tests}" '
                'failures="0" errors="0" skipped="0"/>'
            )
        return 0, [23, 0, 0, 0]

    monkeypatch.setattr(PLANNER, "run_step", run)

    [result] = PLANNER.run_commands(
        tmp_path, PLANNER.Plan([], commands=[command]), False
    )

    assert (result.tests, result.class_total) == (23, 2)
    assert result.passed
    assert (
        PLANNER.count_classes(result, sorted(result.class_counts))
        == "2 classes, 23 tests executed"
    )
    note = "\n".join(PLANNER.render_tests_run([result]))
    assert "keep only the last run of a nested class" in note
    assert "The step totals above are Maven's own counts._" in note


def test_generated_code_older_than_a_change_to_its_inputs_is_stale(
    tmp_path: Path,
) -> None:
    schema = tmp_path / "spec/schema/table.json"
    output = tmp_path / "spec/target/generated"
    schema.parent.mkdir(parents=True)
    output.mkdir(parents=True)
    schema.write_text("{}")
    for name, generated_at in (("TableType.java", 100), ("Table.java", 300)):
        (output / name).write_text("")
        os.utime(output / name, (generated_at, generated_at))
    sources = [
        {
            "module": "spec",
            "inputs": ["spec/schema", "spec/pom.xml"],
            "output": "spec/target/generated",
        }
    ]

    # TableType.java is as old as the last clean generation; the schema changed after it.
    os.utime(schema, (200, 200))
    assert PLANNER.stale_generated_modules(tmp_path, sources) == {
        "spec": "spec/schema/table.json"
    }

    os.utime(schema, (50, 50))
    assert PLANNER.stale_generated_modules(tmp_path, sources) == {}

    for generated in output.iterdir():
        generated.unlink()
    os.utime(schema, (200, 200))
    assert PLANNER.stale_generated_modules(tmp_path, sources) == {}
    assert PLANNER.clean_command(["spec"]) == [
        "mvn",
        "-B",
        "-q",
        "clean",
        "-pl",
        "spec",
    ]


def test_results_block_is_replaced_in_place_or_inserted_under_the_heading() -> None:
    block = f"{PLANNER.BLOCK_START}\nnew\n{PLANNER.BLOCK_END}\n"
    template = f"#### Backend integration tests\n<!--\nhelp\n-->\n{PLANNER.BLOCK_START}\nold\n{PLANNER.BLOCK_END}\n"

    assert "new" in PLANNER.upsert_block(
        template, block
    ) and "old" not in PLANNER.upsert_block(template, block)
    inserted = PLANNER.upsert_block(
        "#### Backend integration tests\n<!--\nhelp\n-->\n\n#### Next", block
    )
    assert inserted.index("-->") < inserted.index("new") < inserted.index("#### Next")


def test_impact_map_globs_use_fnmatch_semantics() -> None:
    # fnmatch's `*` crosses `/`, unlike the pom's Ant globs: `search/*IT.java` also matches the
    # scale classes, which is why notRunLocally rules are applied before lanes are assigned.
    assert PLANNER.matches(
        f"{SERVICE}/search/opensearch/OsClient.java", [f"{SERVICE}/search/**"]
    )
    assert fnmatch.fnmatchcase(
        "org/openmetadata/it/tests/search/scale/ReindexBenchmarkIT.java",
        "org/openmetadata/it/tests/search/*IT.java",
    )
    assert PLANNER.stem_matches("Table", "TableResourceIT")
    assert not PLANNER.stem_matches("Table", "TablesIT")
    assert (
        PLANNER.convention_stem(
            "openmetadata-spec/src/main/resources/json/schema/api/data/createTable.json"
        )
        == "Table"
    )
    assert (
        PLANNER.convention_stem(
            "openmetadata-spec/src/main/resources/elasticsearch/en/ai_application_index_mapping.json"
        )
        == "AiApplication"
    )
