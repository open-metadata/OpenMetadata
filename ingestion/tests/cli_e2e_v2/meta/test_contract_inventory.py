#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Collection contracts are checked in isolated, network-blocked pytest sessions."""

import shlex
from pathlib import Path

import pytest
import yaml

from .support import configure_child

MYSQL_IDS = (
    "catalog.metadata",
    "procedure.code",
    "fk.relationships",
    "profile.metrics",
    "profile.freshness.columns",
    "profile.freshness.rows",
    "sample.values.original",
    "sample.values.updated",
    "sample.values.replacement",
    "lineage.view",
    "classification.tags",
    "deletion.tables",
    "ingest.repeat",
    "error.containment",
    "filter.table.include-one",
    "filter.table.exclude-one",
    "filter.table.regex-exclude-wins",
    "filter.table.exclude-wins",
    "filter.schema.include-one",
    "filter.schema.exclude-wins",
)

POSTGRES_IDS = (
    "catalog.metadata",
    "filter.table.include-one",
    "filter.schema.include-one",
    "ingest.repeat",
)


def _child(pytester, monkeypatch, *, directory="cli_e2e_v2"):
    configure_child(pytester, monkeypatch)
    suite = pytester.path / directory
    suite.mkdir(parents=True)
    return suite


def _connector(suite, family, source, *, inventory=None):
    directory = suite / family
    directory.mkdir()
    (directory / f"test_{family}_contract.py").write_text(source)
    if inventory is None and family == "mysql":
        inventory = "from ingestion.tests.cli_e2e_v2.mysql.inventory import INVENTORY\n"
    if inventory is not None:
        (directory / "inventory.py").write_text(inventory)
    return directory


def _mysql_inventory(ids, unsupported=None):
    return (
        "from dataclasses import replace\n"
        "from ingestion.tests.cli_e2e_v2.mysql.inventory import INVENTORY as MYSQL\n"
        f"INVENTORY = replace(MYSQL, required=frozenset({ids!r}), unsupported={unsupported or {}!r})\n"
    )


def _cases(ids):
    cases = ",\n".join(
        f"    pytest.param({contract_id!r}, id={contract_id!r}, marks=pytest.mark.e2e_contract({contract_id!r}))"
        for contract_id in ids
    )
    return f"import pytest\n@pytest.mark.parametrize('case', [\n{cases}\n])\ndef test_case(case):\n    assert case\n"


def test_missing_marked_case_fails_complete_collection(pytester, monkeypatch):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(suite, "mysql", "def test_unmarked():\n    assert True\n")
    result = pytester.runpytest_subprocess(str(mysql), "--collect-only", "--e2e-contract-check", "-q")
    assert result.ret == pytest.ExitCode.USAGE_ERROR
    result.stderr.fnmatch_lines(["*mysql: profile.metrics missing collected case*"])


def test_omitted_parameter_case_fails_complete_collection(pytester, monkeypatch):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(suite, "mysql", _cases(tuple(case for case in MYSQL_IDS if case != "filter.table.exclude-one")))
    result = pytester.runpytest_subprocess(str(mysql), "--collect-only", "--e2e-contract-check", "-q")
    assert result.ret == pytest.ExitCode.USAGE_ERROR
    result.stderr.fnmatch_lines(["*mysql: filter.table.exclude-one missing collected case*"])


def test_empty_required_parameter_set_is_not_coverage(pytester, monkeypatch):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(
        suite,
        "mysql",
        "import pytest\n@pytest.mark.e2e_contract('profile.metrics')\n"
        "@pytest.mark.parametrize('case', [])\ndef test_profile(case):\n    assert case\n",
        inventory=_mysql_inventory(("profile.metrics",)),
    )
    result = pytester.runpytest_subprocess(str(mysql), "--collect-only", "--e2e-contract-check", "-q")
    assert result.ret == pytest.ExitCode.USAGE_ERROR
    result.stderr.fnmatch_lines(["*mysql: profile.metrics missing collected case*"])


@pytest.mark.parametrize(
    "unsupported, expected",
    [
        ({"profile.metrics": ""}, "*mysql: unsupported profile.metrics requires a reason*"),
        (
            {"profile.metrics": "not available in this suite"},
            "*mysql: profile.metrics cannot be unsupported; generated connection declares support*",
        ),
    ],
)
def test_unsupported_contract_requires_reason_and_respects_generated_support(
    pytester, monkeypatch, unsupported, expected
):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(
        suite,
        "mysql",
        "def test_unmarked():\n    assert True\n",
        inventory=_mysql_inventory(("profile.metrics",), unsupported),
    )
    result = pytester.runpytest_subprocess(str(mysql), "--collect-only", "--e2e-contract-check", "-q")
    assert result.ret == pytest.ExitCode.USAGE_ERROR
    result.stderr.fnmatch_lines([expected])


def test_reviewed_waiver_without_machine_capability_is_allowed(pytester, monkeypatch):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(
        suite,
        "mysql",
        "def test_unmarked():\n    assert True\n",
        inventory=_mysql_inventory(
            ("classification.tags",), {"classification.tags": "No classification implementation in this test suite"}
        ),
    )
    result = pytester.runpytest_subprocess(str(mysql), "--collect-only", "--e2e-contract-check", "-q")
    assert result.ret == pytest.ExitCode.OK
    result.stdout.fnmatch_lines(["*1 test collected*"])


def test_narrower_metadata_features_can_have_reviewed_waivers(pytester, monkeypatch):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(
        suite,
        "mysql",
        "def test_unmarked():\n    assert True\n",
        inventory=_mysql_inventory(
            ("filter.table.include-one", "procedure.code", "fk.relationships", "deletion.tables"),
            {
                "filter.table.include-one": "not in suite",
                "procedure.code": "not in suite",
                "fk.relationships": "not in suite",
                "deletion.tables": "not in suite",
            },
        ),
    )
    result = pytester.runpytest_subprocess(str(mysql), "--collect-only", "--e2e-contract-check", "-q")
    assert result.ret == pytest.ExitCode.OK
    result.stdout.fnmatch_lines(["*1 test collected*"])


def test_duplicate_and_unknown_case_ids_fail_collection(pytester, monkeypatch):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(
        suite,
        "mysql",
        _cases(("catalog.metadata", "catalog.metadata", "not.reviewed")),
    )
    result = pytester.runpytest_subprocess(str(mysql), "--collect-only", "--e2e-contract-check", "-q")
    assert result.ret == pytest.ExitCode.USAGE_ERROR
    assert "mysql: duplicate case ID catalog.metadata (2 collected items)" in result.stderr.str()
    assert "mysql: unknown contract ID not.reviewed" in result.stderr.str()


def test_complete_multi_connector_collection_and_focused_execution(pytester, monkeypatch):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(suite, "mysql", _cases(MYSQL_IDS))
    postgres = _connector(
        suite,
        "postgres",
        _cases(POSTGRES_IDS),
        inventory=(
            "from ingestion.tests.cli_e2e_v2.contracts.inventory import ContractInventory\n"
            f"INVENTORY = ContractInventory('postgres', frozenset({POSTGRES_IDS!r}))\n"
        ),
    )
    complete = pytester.runpytest_subprocess(str(mysql), str(postgres), "--collect-only", "--e2e-contract-check", "-q")
    assert complete.ret == pytest.ExitCode.OK
    complete.stdout.fnmatch_lines(["*24 tests collected*"])

    focused = pytester.runpytest_subprocess(str(mysql), "-k", "profile.metrics", "-q")
    assert focused.ret == pytest.ExitCode.OK
    focused.assert_outcomes(passed=1, deselected=19)


@pytest.mark.parametrize("omit_case", [False, True])
def test_contract_check_without_cacheprovider_still_enforces_coverage(pytester, monkeypatch, omit_case):
    suite = _child(pytester, monkeypatch)
    ids = tuple(case for case in MYSQL_IDS if not omit_case or case != "profile.metrics")
    mysql = _connector(suite, "mysql", _cases(ids))
    result = pytester.runpytest_subprocess(
        "-p", "no:cacheprovider", str(mysql), "--collect-only", "--e2e-contract-check", "-q"
    )
    if omit_case:
        assert result.ret == pytest.ExitCode.USAGE_ERROR
        result.stderr.fnmatch_lines(["*mysql: profile.metrics missing collected case*"])
    else:
        assert result.ret == pytest.ExitCode.OK
        result.stdout.fnmatch_lines(["*20 tests collected*"])


@pytest.mark.parametrize("omit_case", [False, True])
def test_ci_invocation_enforces_complete_contracts(pytester, monkeypatch, omit_case):
    root = Path(__file__).resolve().parents[4]
    workflow = yaml.safe_load((root / ".github/workflows/py-cli-e2e-tests-v2.yml").read_text())
    steps = workflow["jobs"]["py-cli-e2e-tests-v2"]["steps"]
    script = next(step["run"] for step in steps if step.get("id") == "e2e-v2-test")
    command = script[script.index("pytest ") :].replace("\\\n", "").replace("${{ matrix.connector }}", "mysql")
    arguments = shlex.split(command)[1:]
    suite = _child(pytester, monkeypatch, directory="tests/cli_e2e_v2")
    ids = tuple(case for case in MYSQL_IDS if not omit_case or case != "profile.metrics")
    _connector(suite, "mysql", _cases(ids))
    result = pytester.runpytest_subprocess(*arguments, "--collect-only")
    if omit_case:
        assert result.ret == pytest.ExitCode.USAGE_ERROR
        result.stderr.fnmatch_lines(["*mysql: profile.metrics missing collected case*"])
    else:
        assert result.ret == pytest.ExitCode.OK
        result.stdout.fnmatch_lines(["*20 tests collected*"])


@pytest.mark.parametrize("fails", [False, True])
def test_ci_meta_invocation_runs_offline_tests_and_propagates_failure(pytester, monkeypatch, fails):
    root = Path(__file__).resolve().parents[4]
    workflow = yaml.safe_load((root / ".github/workflows/py-tests-shared.yml").read_text())
    steps = workflow["jobs"]["py-unit-tests"]["steps"]
    script = next(step["run"] for step in steps if step.get("name") == "Run offline E2E framework tests")
    arguments = shlex.split(script[script.index("python -m pytest") :])[3:]
    suite = _child(pytester, monkeypatch, directory="tests/cli_e2e_v2")
    _connector(suite, "meta", f"def test_regression():\n    assert {not fails!r}\n")
    result = pytester.runpytest_subprocess(*arguments)
    assert result.ret == (pytest.ExitCode.TESTS_FAILED if fails else pytest.ExitCode.OK)
    result.assert_outcomes(failed=1 if fails else 0, passed=0 if fails else 1)


@pytest.mark.parametrize(
    "selection",
    [
        ("-k", "profile"),
        ("-m", "e2e_contract"),
        ("node",),
        ("--deselect", "cli_e2e_v2/mysql/test_mysql_contract.py::test_case[profile.metrics]"),
        ("--ignore", "test_mysql_contract.py"),
        ("--ignore-glob", "*test_mysql_contract.py"),
        ("--lf",),
    ],
)
def test_completeness_rejects_partial_selection(pytester, monkeypatch, selection):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(suite, "mysql", _cases(MYSQL_IDS))
    if selection == ("node",):
        args = (str(mysql / "test_mysql_contract.py") + "::test_case",)
    elif selection[0] == "--deselect":
        args = (str(mysql), "--deselect", selection[1])
    elif selection[0] == "--ignore":
        args = (str(mysql), "--ignore", str(mysql / selection[1]))
    else:
        args = (str(mysql), *selection)
    if selection[0] == "--deselect":
        narrowed = pytester.runpytest_subprocess(*args, "--collect-only", "-q")
        assert narrowed.ret == pytest.ExitCode.OK
        narrowed.stdout.fnmatch_lines(["*19/20 tests collected (1 deselected)*"])
    elif selection[0] == "--ignore-glob":
        narrowed = pytester.runpytest_subprocess(*args, "--collect-only", "-q")
        assert narrowed.ret == pytest.ExitCode.NO_TESTS_COLLECTED
    result = pytester.runpytest_subprocess(*args, "--collect-only", "--e2e-contract-check", "-q")
    assert result.ret == pytest.ExitCode.USAGE_ERROR
    result.stderr.fnmatch_lines(["*--e2e-contract-check requires complete connector directories*"])


def test_skipif_marked_required_case_is_not_coverage(pytester, monkeypatch):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(
        suite,
        "mysql",
        "import pytest\n@pytest.mark.e2e_contract('profile.metrics')\n"
        "@pytest.mark.skipif(True, reason='not runnable')\ndef test_profile():\n    assert True\n",
        inventory=_mysql_inventory(("profile.metrics",)),
    )
    result = pytester.runpytest_subprocess(str(mysql), "--collect-only", "--e2e-contract-check", "-q")
    assert result.ret == pytest.ExitCode.USAGE_ERROR
    result.stderr.fnmatch_lines(["*mysql: profile.metrics missing collected case*"])


@pytest.mark.parametrize("phase", ["setup", "call", "teardown"])
@pytest.mark.parametrize("outcome", ["skip", "xfail"])
@pytest.mark.parametrize("contract_check", [False, True])
def test_runtime_skip_and_xfail_fail_required_contracts(pytester, monkeypatch, phase, outcome, contract_check):
    suite = _child(pytester, monkeypatch)
    action = f"pytest.{outcome}('source unavailable')"
    setup = action if phase == "setup" else "pass"
    body = action if phase == "call" else "assert True"
    teardown = action if phase == "teardown" else "pass"
    mysql = _connector(
        suite,
        "mysql",
        "import pytest\n"
        f"@pytest.fixture\ndef source():\n    {setup}\n    yield\n    {teardown}\n"
        "@pytest.mark.e2e_contract('profile.metrics')\n"
        f"def test_profile(source):\n    {body}\n",
        inventory=_mysql_inventory(("profile.metrics",)),
    )
    options = ["--e2e-contract-check"] if contract_check else []
    result = pytester.runpytest_subprocess(str(mysql), *options, "-q")
    if not contract_check:
        assert result.ret == pytest.ExitCode.OK
        result.assert_outcomes(
            passed=int(phase == "teardown"), skipped=int(outcome == "skip"), xfailed=int(outcome == "xfail")
        )
        return
    assert result.ret == pytest.ExitCode.TESTS_FAILED
    result.assert_outcomes(
        failed=1 if phase == "call" else 0,
        errors=0 if phase == "call" else 1,
        passed=1 if phase == "teardown" else 0,
    )
    result.stdout.fnmatch_lines(["*Required E2E contract profile.metrics*", "*source unavailable*"])


@pytest.mark.parametrize("contract_check", [False, True])
def test_runtime_xpass_cannot_bypass_completeness(pytester, monkeypatch, contract_check):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(
        suite,
        "mysql",
        "import pytest\n"
        "@pytest.fixture\ndef source(request):\n"
        "    request.node.add_marker(pytest.mark.xfail(reason='source unavailable', strict=False))\n"
        "@pytest.mark.e2e_contract('profile.metrics')\n"
        "def test_profile(source):\n    assert True\n",
        inventory=_mysql_inventory(("profile.metrics",)),
    )
    options = ["--e2e-contract-check"] if contract_check else []
    result = pytester.runpytest_subprocess(str(mysql), *options, "-q")
    assert result.ret == (pytest.ExitCode.TESTS_FAILED if contract_check else pytest.ExitCode.OK)
    result.assert_outcomes(failed=int(contract_check), xpassed=int(not contract_check))


@pytest.mark.parametrize("contract_check", [False, True])
def test_unmarked_runtime_skips_do_not_invalidate_passing_contracts(pytester, monkeypatch, contract_check):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(
        suite,
        "mysql",
        "import pytest\n"
        "@pytest.mark.e2e_contract('profile.metrics')\n"
        "def test_profile():\n    assert True\n"
        "def test_optional():\n    pytest.skip('optional probe')\n",
        inventory=_mysql_inventory(("profile.metrics",)),
    )
    options = ["--e2e-contract-check"] if contract_check else []
    result = pytester.runpytest_subprocess(str(mysql), *options, "-q")
    assert result.ret == pytest.ExitCode.OK
    result.assert_outcomes(passed=1, skipped=1)


def test_child_process_blocks_tcp_and_dns(pytester, monkeypatch):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(
        suite,
        "mysql",
        "import socket\nimport pytest\n"
        "def test_guard():\n"
        "    with pytest.raises(AssertionError, match='Offline framework probe'):\n"
        "        socket.socket().connect(('127.0.0.1', 1))\n"
        "    with pytest.raises(AssertionError, match='Offline framework probe'):\n"
        "        socket.getaddrinfo('example.com', 80)\n"
        "    with pytest.raises(AssertionError, match='Offline framework probe'):\n"
        "        socket.gethostbyname('example.com')\n"
        "    with pytest.raises(AssertionError, match='Offline framework probe'):\n"
        "        socket.gethostbyname_ex('example.com')\n"
        "    with pytest.raises(AssertionError, match='Offline framework probe'):\n"
        "        socket.gethostbyaddr('127.0.0.1')\n"
        "    with pytest.raises(AssertionError, match='Offline framework probe'):\n"
        "        socket.getnameinfo(('127.0.0.1', 80), 0)\n",
    )
    result = pytester.runpytest_subprocess(str(mysql), "-q")
    assert result.ret == pytest.ExitCode.OK
    result.assert_outcomes(passed=1)


@pytest.mark.parametrize("omit_chart_case", [False, True])
def test_dashboard_inventory_is_connector_owned(pytester, monkeypatch, omit_chart_case):
    suite = _child(pytester, monkeypatch)
    mysql = _connector(suite, "mysql", _cases(MYSQL_IDS))
    dashboard = _connector(
        suite,
        "dashboard_example",
        _cases(("dashboard.metadata",) if omit_chart_case else ("dashboard.metadata", "chart.membership")),
    )
    (dashboard / "inventory.py").write_text(
        "from ingestion.tests.cli_e2e_v2.contracts.inventory import ContractInventory\n"
        "INVENTORY = ContractInventory('dashboard_example', frozenset({'dashboard.metadata', 'chart.membership'}))\n"
    )
    result = pytester.runpytest_subprocess(str(mysql), str(dashboard), "--collect-only", "--e2e-contract-check", "-q")
    if omit_chart_case:
        assert result.ret == pytest.ExitCode.USAGE_ERROR
        result.stderr.fnmatch_lines(["*dashboard_example: chart.membership missing collected case*"])
    else:
        assert result.ret == pytest.ExitCode.OK
        result.stdout.fnmatch_lines(["*22 tests collected*"])
    assert "filter.table" not in result.stderr.str()
    assert "filter.schema" not in result.stderr.str()


def test_connector_without_inventory_cannot_inherit_database_requirements(pytester, monkeypatch):
    suite = _child(pytester, monkeypatch)
    unknown = _connector(suite, "unregistered", _cases(POSTGRES_IDS))
    result = pytester.runpytest_subprocess(str(unknown), "--collect-only", "--e2e-contract-check", "-q")
    assert result.ret == pytest.ExitCode.USAGE_ERROR
    result.stderr.fnmatch_lines(["*unregistered: missing inventory.py*"])


@pytest.mark.parametrize(
    "declaration, expected",
    [
        ("", "*inventory.py must export INVENTORY as a ContractInventory*"),
        ("INVENTORY = {}", "*inventory.py must export INVENTORY as a ContractInventory*"),
        (
            "INVENTORY = ContractInventory('dashboard_example', frozenset())",
            "*dashboard_example: inventory must declare required contract IDs*",
        ),
        (
            "INVENTORY = ContractInventory('wrong_connector', frozenset({'dashboard.metadata'}))",
            "*dashboard_example: inventory family mismatch (wrong_connector)*",
        ),
    ],
)
def test_invalid_connector_inventory_fails_collection(pytester, monkeypatch, declaration, expected):
    suite = _child(pytester, monkeypatch)
    dashboard = _connector(
        suite,
        "dashboard_example",
        _cases(("dashboard.metadata",)),
        inventory="from ingestion.tests.cli_e2e_v2.contracts.inventory import ContractInventory\n" + declaration,
    )
    result = pytester.runpytest_subprocess(str(dashboard), "--collect-only", "--e2e-contract-check", "-q")
    assert result.ret == pytest.ExitCode.USAGE_ERROR
    result.stderr.fnmatch_lines([expected])
