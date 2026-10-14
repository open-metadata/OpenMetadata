"""Local repro commands for the blocking tests, from the repository's planners.

A repro command is never taken from the model. Java tests go through
plan_local_java_tests.py, the planner developers already run, so the engine profile
and lane arguments cannot drift from CI's; the planner's command is narrowed to the
failing method. Playwright and Python commands are built from the spec path and the
pytest node id the way the verify job builds them. Test ids are untrusted: a class
name that is not a plain identifier, or a spec path that leaves the repository, gets
no command at all.
"""

from __future__ import annotations

import json
import re
import shlex
import subprocess
import sys
import tempfile
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import verify_failures
from ci_ai import bundle as bundle_mod

TRUSTED_ROOT = Path(__file__).resolve().parents[3]
PLANNER = Path(".github/scripts/plan_local_java_tests.py")
PLANNER_TIMEOUT_SECONDS = 120
PLANNER_REASON = "reproduce a merge-queue ejection"
UI_DIR = "openmetadata-ui/src/main/resources/ui"
IT_MODULE_PREFIX = "openmetadata-integration-tests/"
SIMPLE_NAME = re.compile(r"^[A-Za-z_$][\w$]*$")
METHOD_NAME = re.compile(r"^[A-Za-z_$][\w$]*$")
PROJECT = re.compile(r"^[\w.-]{1,64}$")
MAX_COMMANDS = 3

Planner = Callable[[str, str, Path], "list[dict] | None"]


@dataclass
class Repro:
    test_id: str
    commands: list[str] = field(default_factory=list)
    note: str = ""


def java_plan(flag: str, name: str, trusted_root: Path) -> list[dict] | None:
    """The planner's commands for `--add-it=<name>` or `--add-unit=<name>`, or None when
    it does not know the class (one the PR adds) or fails. The `=` form keeps a name
    that starts with a dash from being read as an option."""
    with tempfile.TemporaryDirectory() as scratch:
        empty = Path(scratch) / "changed-files.txt"
        empty.write_text("")
        try:
            result = subprocess.run(
                [sys.executable, str(trusted_root / PLANNER), "--changed-files", str(empty), "--json", f"{flag}={name}", "--reason", PLANNER_REASON],
                cwd=trusted_root,
                capture_output=True,
                text=True,
                timeout=PLANNER_TIMEOUT_SECONDS,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            return None
    if result.returncode != 0:
        return None
    try:
        plan = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    commands = plan.get("commands") if isinstance(plan, dict) else None
    return [c for c in commands or [] if isinstance(c, dict) and isinstance(c.get("command"), str)]


def narrow(command: str, simple: str, method: str) -> str:
    """Point the planner's class selection at the failing method."""
    argv = shlex.split(command)
    if method:
        for index, arg in enumerate(argv):
            for prefix in ("-Dit.test=", "-Dtest="):
                if arg == f"{prefix}{simple}":
                    argv[index] = f"{prefix}{simple}#{method}"
    return shlex.join(argv)


def ci_note(test: bundle_mod.BlockingTest) -> str:
    if not test.profile:
        return ""
    return f"failed in CI on `{test.profile}`" + (f", lane `{test.lane}`" if test.lane else "")


def java_repro(test: bundle_mod.BlockingTest, trusted_root: Path, planner: Planner, memo: dict) -> Repro:
    owner, _, name = test.test_id.partition("#")
    simple = owner.split("$", 1)[0].rsplit(".", 1)[-1]
    method = bundle_mod.PARAMS.sub("", name)
    method = method if METHOD_NAME.match(method) else ""
    if not SIMPLE_NAME.match(simple):
        return Repro(test.test_id, note="no runnable class name in the test id")
    integration = test.suite == "java-it" or test.source_path.startswith(IT_MODULE_PREFIX)
    flag, kind = ("--add-it", "integration") if integration else ("--add-unit", "unit")
    if (flag, simple) not in memo:
        memo[(flag, simple)] = planner(flag, simple, trusted_root)
    commands = [narrow(c["command"], simple, method) for c in memo[(flag, simple)] or [] if c.get("kind") == kind]
    if commands:
        return Repro(test.test_id, commands[:MAX_COMMANDS], ci_note(test))
    # A class the trusted checkout does not have yet: the PR adds it, so the planner
    # finds it on the PR branch and prints the command there.
    fallback = shlex.join(["python3", str(PLANNER), f"{flag}={simple}", "--reason", PLANNER_REASON])
    note = "; ".join(filter(None, [ci_note(test), "run on the PR branch; the planner prints the mvn command"]))
    return Repro(test.test_id, [fallback], note)


def playwright_repro(test: bundle_mod.BlockingTest) -> Repro:
    parts = test.test_id.split(" :: ", 2)
    if len(parts) != 3:
        return Repro(test.test_id, note="not a Playwright stable id")
    project, file, title = parts
    if not PROJECT.match(project) or not bundle_mod.SPEC_FILE.match(file) or file.startswith("/") or ".." in Path(file).parts:
        return Repro(test.test_id, note="the spec path is not a plain repository path")
    grep = re.escape(title.split(" › ")[-1])
    argv = ["npx", "playwright", "test", file, f"--project={project}", "-g", grep, "--retries=0", "--repeat-each=3"]
    return Repro(test.test_id, [f"cd {UI_DIR} && {shlex.join(argv)}"])


def python_repro(test: bundle_mod.BlockingTest, root: Path | None) -> Repro:
    nodeid = ""
    if root is not None and bundle_mod.PYTHON_ID.match(test.test_id):
        nodeid = verify_failures.python_nodeid(test.test_id, root / "ingestion")
    if not nodeid:
        return Repro(test.test_id, note="the test module is not in this checkout")
    return Repro(test.test_id, [f"cd ingestion && {shlex.join(['python', '-m', 'pytest', nodeid, '-p', 'no:randomly'])}"])


def repros_for(
    tests: list[bundle_mod.BlockingTest],
    root: Path | None,
    *,
    trusted_root: Path = TRUSTED_ROOT,
    planner: Planner = java_plan,
) -> list[Repro]:
    memo: dict = {}
    repros = []
    for test in tests:
        if test.suite == "playwright":
            repros.append(playwright_repro(test))
        elif test.suite == "python":
            repros.append(python_repro(test, root))
        elif test.suite in ("java", "java-it"):
            repros.append(java_repro(test, trusted_root, planner, memo))
        else:
            repros.append(Repro(test.test_id, note="no planner for this suite"))
    return repros
