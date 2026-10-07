from __future__ import annotations

import fnmatch
import importlib.util
import json
import sys
from pathlib import Path

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
IT_TESTS = "openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests"


def plan_for(*changed: str):
    planner = PLANNER.Planner(REPO, IMPACT_MAP)
    return planner, planner.plan(list(changed))


def its(plan) -> dict[str, list[str]]:
    return {
        REPO.it_classes[path]: sel.run_engines
        for path, sel in plan.integration_tests.items()
    }


def it_commands(plan) -> list[list[str]]:
    return [command.argv for command in plan.commands if command.kind == "integration"]


def test_impact_map_reaches_every_integration_test() -> None:
    assert PLANNER.audit_impact_map(REPO, IMPACT_MAP) == []


def test_audit_reports_unbucketed_tests_dead_patterns_and_unknown_engines() -> None:
    broken = json.loads(json.dumps(IMPACT_MAP))
    databases = next(
        mapping for mapping in broken["mappings"] if mapping["name"] == "databases"
    )
    databases["tests"].remove("StoredProcedureResourceIT")
    databases["tests"].append("NoSuchResourceIT")
    databases["engines"] = ["oracle-solr"]

    problems = PLANNER.audit_impact_map(REPO, broken)

    assert any(problem.startswith("StoredProcedureResourceIT ") for problem in problems)
    assert (
        "bucket 'databases': test pattern 'NoSuchResourceIT' matches no test class"
        in problems
    )
    assert any("'oracle-solr'" in problem for problem in problems)


def test_lane_membership_is_read_from_the_it_pom() -> None:
    planner = PLANNER.Planner(REPO, IMPACT_MAP)
    by_name = {name: relative for relative, name in REPO.it_classes.items()}

    assert planner.lane_for(by_name["SystemResourceIT"]) == "isolated"
    assert planner.lane_for(by_name["SessionMultiNodeIT"]) == "isolated"
    assert planner.lane_for(by_name["SearchIndexRetryQueueIT"]) == "isolated"
    assert planner.lane_for(by_name["RdfResourceIT"]) == "rdf"
    assert planner.lane_for(by_name["ReindexStatsIT"]) == "search-it"
    assert planner.lane_for(by_name["TableResourceIT"]) == "parallel"


def test_repository_change_selects_its_entity_tests_and_the_unit_tests_using_it() -> (
    None
):
    _, plan = plan_for(f"{SERVICE}/jdbi3/TableRepository.java")

    selected = its(plan)
    assert selected["TableResourceIT"] == ["mysql-elasticsearch"]
    assert "DatabaseSchemaResourceIT" in selected
    assert (
        "entity Table"
        in plan.integration_tests[
            "org/openmetadata/it/tests/TableResourceIT.java"
        ].reasons
    )
    assert "EntityRepositoryRestoreTest" in plan.unit_tests["openmetadata-service"]
    assert plan.unmapped_files == []


def test_every_it_command_pins_an_engine_profile_and_skips_unit_tests() -> None:
    # Without an explicit -P<engine> a lane run executes zero tests and still prints
    # BUILD SUCCESS; without the -Dtest filter `-am` runs every upstream unit suite.
    _, plan = plan_for(
        f"{SERVICE}/jdbi3/TableRepository.java",
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


def test_postgres_migration_runs_the_migration_tests_on_postgres_only() -> None:
    _, plan = plan_for(
        "bootstrap/sql/migrations/native/2.1.0/postgres/schemaChanges.sql"
    )

    selected = its(plan)
    assert selected["ContinuousMigrationIT"] == ["postgres-opensearch"]
    assert selected["ConversationSchemaMigrationIT"] == ["postgres-opensearch"]
    assert all("-Pmysql-elasticsearch" not in argv for argv in it_commands(plan))


def test_engine_specific_search_change_runs_search_it_on_that_engine() -> None:
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
    assert its(os_plan)["SearchResourceIT"] == [
        "mysql-elasticsearch",
        "postgres-opensearch",
    ]


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


def test_ui_and_docs_only_change_selects_nothing() -> None:
    _, plan = plan_for(
        "openmetadata-ui/src/main/resources/ui/src/App.tsx",
        "skills/pr-checklist/SKILL.md",
        "README.md",
    )

    assert not plan.has_tests()
    assert plan.commands == []


def test_root_pom_runs_every_unit_suite_and_the_smoke_tests() -> None:
    planner, plan = plan_for("pom.xml")

    assert set(plan.full_unit_modules) == set(IMPACT_MAP["maven"]["unitTestModules"])
    assert set(its(plan)) == set(IMPACT_MAP["smoke"])
    unit = [command for command in plan.commands if command.kind == "unit"]
    assert len(unit) == 1
    selector = next(arg for arg in unit[0].argv if arg.startswith("-Dtest="))
    assert "org/openmetadata/mcp/**/*Test.java" in selector
    assert "org/openmetadata/service/**/*Test.java" in selector


def test_unmapped_production_file_is_a_gap_that_falls_back_to_smoke() -> None:
    unmapped = f"{SERVICE}/util/AsciiTable.java"

    _, plan = plan_for(unmapped)

    assert plan.unmapped_files == [unmapped]
    assert set(its(plan)) == set(IMPACT_MAP["smoke"])
    assert "AsciiTableTest" in plan.unit_tests["openmetadata-service"]


def test_heavily_shared_class_escalates_to_the_full_unit_suite() -> None:
    _, plan = plan_for(
        "openmetadata-spec/src/main/resources/json/schema/entity/data/glossaryTerm.json"
    )

    assert "openmetadata-service" in plan.full_unit_modules
    assert "openmetadata-service" not in plan.unit_tests
    assert "GlossaryTermResourceIT" in its(plan)


def test_author_additions_run_in_their_own_lane_and_are_recorded() -> None:
    planner = PLANNER.Planner(REPO, IMPACT_MAP)

    plan = planner.plan(
        ["openmetadata-ui/src/main/resources/ui/src/App.tsx"],
        add_its=["SystemResourceIT", "LineageResourceIT"],
        add_units=["AsciiTableTest"],
    )

    assert its(plan) == {
        "SystemResourceIT": ["mysql-elasticsearch"],
        "LineageResourceIT": ["mysql-elasticsearch"],
    }
    assert plan.unit_tests == {
        "openmetadata-service": {"AsciiTableTest": {"added by author"}}
    }
    assert plan.triggers["added by author"] == {
        "SystemResourceIT",
        "LineageResourceIT",
        "AsciiTableTest",
    }
    assert [
        command.label for command in plan.commands if command.kind == "integration"
    ] == [
        "mysql-elasticsearch · parallel",
        "mysql-elasticsearch · isolated",
    ]


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


def test_tests_that_need_one_backend_run_only_there() -> None:
    _, plan = plan_for(
        "openmetadata-service/src/main/java/org/openmetadata/service/search/vector/VectorIndexService.java",
        "openmetadata-service/src/main/java/org/openmetadata/service/cache/CacheConfig.java",
    )

    selected = its(plan)
    assert selected["PatchTableEmbeddingIT"] == ["postgres-opensearch"]
    assert selected["UncachedReadIT"] == ["cache-tests"]
    assert "cache-tests" in selected["EntityCacheInvalidationIT"]


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
