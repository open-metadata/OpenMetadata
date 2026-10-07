#!/usr/bin/env python3
"""Plan, run, and report the Java tests a branch must pass before it is queued.

Pull-request CI runs the Java unit tests only. The integration tests (ITs) run
in the merge queue, and the JavaUIIT, search-it and scale suites run nightly in
openmetadata-nightly. An IT a change breaks is therefore first seen when the PR
is ejected from the queue, unless the author ran it. This planner maps the
branch diff to the unit tests and ITs it can break, through
``.github/java-tests/impact-map.json``, and builds the Maven commands that run
them in the failsafe lane and engine profile CI uses.

    python .github/scripts/plan_local_java_tests.py                 # list + commands
    python .github/scripts/plan_local_java_tests.py --run           # run + write results
    python .github/scripts/plan_local_java_tests.py --run --update-pr

See ``.github/java-tests/README.md`` for how tests are selected.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

IMPACT_MAP = ".github/java-tests/impact-map.json"
RESULTS_DIR = "target/java-tests"
RESULTS_MARKDOWN = f"{RESULTS_DIR}/local-pr-results.md"
BLOCK_START = "<!-- local-java-test-results:start -->"
BLOCK_END = "<!-- local-java-test-results:end -->"
DEFAULT_PR_HEADING = "#### Backend integration tests"

# Surefire's default includes; openmetadata-service overrides them with the same four.
UNIT_TEST_CLASS = re.compile(r"^(Test\w+|\w+Test|\w+Tests|\w+TestCase)$")
IT_CLASS = re.compile(r"^\w+(IT|Test)$")
CONVENTION_SUFFIXES = ("Repository", "Resource", "Mapper", "Index")
MIN_STEM_LENGTH = 3
# Surefire has no switch that skips only unit tests, and `-am` would otherwise run
# every upstream module's whole suite before the ITs. `-Dmaven.test.skip` is out too:
# it skips compiling the openmetadata-service test-jar the IT module depends on. A
# filter that matches no class skips them; failIfNoSpecifiedTests=false keeps that legal.
SKIP_UNIT_TESTS = [
    "-Dtest=NoUnitTestsInThisRun",
    "-Dsurefire.failIfNoSpecifiedTests=false",
]
# Unit steps default to `package`, not `test` (`maven.unitPhase`): in OpenMetadata the relocated
# es.*/os.* search clients only exist once openmetadata-shaded-deps is packaged, so `test -am`
# cannot compile the service. Repackaging the k8s operator's boot jar is the one slow packaging
# step tests never need.
SKIP_REPACKAGE = "-Dspring-boot.repackage.skip=true"
INLINE_CLASS_LIMIT = 30
# GitHub rejects a PR description over 65,536 characters, and the template, the author's text
# and the Playwright block share that with this block. A <details> block only hides text, so
# class lists past CLASS_LIST_BUDGET are reduced to counts instead.
GITHUB_BODY_LIMIT = 65_536
CLASS_LIST_BUDGET = 20_000


@dataclass
class Selection:
    reasons: set[str] = field(default_factory=set)
    # Engines a mapping or engine rule asked for by name. A reason that names none
    # wants the default engine, which is tracked separately so that an engine-specific
    # mapping can still narrow a search-it run to its own engine.
    engines: set[str] = field(default_factory=set)
    wants_default: bool = False
    run_engines: list[str] = field(default_factory=list)


@dataclass
class Command:
    kind: str
    label: str
    argv: list[str]
    report_dirs: list[str]
    expected_classes: list[str] = field(default_factory=list)
    full_suite_dirs: list[str] = field(default_factory=list)


@dataclass
class Plan:
    changed_files: list[str]
    unit_tests: dict[str, dict[str, set[str]]] = field(default_factory=dict)
    full_unit_modules: dict[str, set[str]] = field(default_factory=dict)
    integration_tests: dict[str, Selection] = field(default_factory=dict)
    not_run_locally: dict[str, str] = field(default_factory=dict)
    unmapped_files: list[str] = field(default_factory=list)
    untested_classes: list[str] = field(default_factory=list)
    triggers: dict[str, set[str]] = field(default_factory=dict)
    commands: list[Command] = field(default_factory=list)

    def has_tests(self) -> bool:
        return bool(self.unit_tests or self.full_unit_modules or self.integration_tests)

    def to_json(self) -> dict[str, Any]:
        return {
            "changedFiles": self.changed_files,
            "unitTests": {
                module: {
                    name: sorted(reasons) for name, reasons in sorted(tests.items())
                }
                for module, tests in sorted(self.unit_tests.items())
            },
            "fullUnitModules": {
                module: sorted(reasons)
                for module, reasons in sorted(self.full_unit_modules.items())
            },
            "integrationTests": {
                path: {"reasons": sorted(sel.reasons), "engines": sel.run_engines}
                for path, sel in sorted(self.integration_tests.items())
            },
            "notRunLocally": dict(sorted(self.not_run_locally.items())),
            "unmappedFiles": self.unmapped_files,
            "untestedClasses": self.untested_classes,
            "triggers": {
                name: sorted(files) for name, files in sorted(self.triggers.items())
            },
            "commands": [
                {"kind": c.kind, "label": c.label, "command": shlex.join(c.argv)}
                for c in self.commands
            ],
        }


def git(repo_root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=repo_root, check=True, capture_output=True, text=True
    ).stdout.strip()


def matches(path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns)


def simple_name(path: str) -> str:
    return path.rsplit("/", 1)[-1].rsplit(".", 1)[0]


def plural(count: int, noun: str) -> str:
    return (
        f"{count} {noun}"
        if count == 1
        else f"{count} {noun}es"
        if noun.endswith("s")
        else f"{count} {noun}s"
    )


def collect_changed_files(repo_root: Path, base: str) -> list[str]:
    try:
        merge_base = git(repo_root, "merge-base", base, "HEAD")
    except subprocess.CalledProcessError:
        sys.exit(
            f"No merge base between '{base}' and HEAD. Fetch it first "
            "(git fetch origin main) or pass another ref with --base."
        )
    # --no-renames reports both sides of a rename, so a moved class maps through its
    # old path as well as its new one.
    tracked = git(
        repo_root, "diff", "--name-only", "--no-renames", merge_base
    ).splitlines()
    untracked = git(
        repo_root, "ls-files", "--others", "--exclude-standard"
    ).splitlines()
    return sorted({path for path in [*tracked, *untracked] if path})


def has_uncommitted_changes(repo_root: Path, ignore: list[str]) -> bool:
    """Whether the run tested code the commit doesn't hold.

    The plan reads untracked files too, but only those outside the map's `ignore` list
    count: an editor or tool file must not mark every run.
    """
    if git(repo_root, "status", "--porcelain", "--untracked-files=no"):
        return True
    untracked = git(
        repo_root, "ls-files", "--others", "--exclude-standard"
    ).splitlines()
    return any(path and not matches(path, ignore) for path in untracked)


class Repo:
    """Read-only view of the checkout the planner selects from."""

    def __init__(self, root: Path, impact_map: dict[str, Any]):
        self.root = root
        self.maven = impact_map["maven"]
        self.it_root = self.maven["integrationTestSourceRoot"]
        files = git(
            root, "ls-files", "--cached", "--others", "--exclude-standard"
        ).splitlines()
        self.files = [path for path in files if (root / path).is_file()]
        self.it_classes = self._integration_test_classes()
        self.unit_test_classes = self._unit_test_classes()
        self.lanes = self._lane_membership()

    def _integration_test_classes(self) -> dict[str, str]:
        prefix = self.it_root + "/"
        return {
            path[len(prefix) :]: simple_name(path)
            for path in self.files
            if path.startswith(prefix)
            and path.endswith(".java")
            and IT_CLASS.match(simple_name(path))
        }

    def _unit_test_classes(self) -> dict[str, dict[str, str]]:
        modules: dict[str, dict[str, str]] = {}
        for module in self.maven["unitTestModules"]:
            prefix = f"{module}/src/test/java/"
            modules[module] = {
                simple_name(path): path
                for path in self.files
                if path.startswith(prefix)
                and path.endswith(".java")
                and UNIT_TEST_CLASS.match(simple_name(path))
            }
        return modules

    def _lane_membership(self) -> dict[str, list[str]]:
        """Class-name patterns per lane, read from the IT pom so they cannot drift from CI.

        A lane names either comma-separated pom properties (`pomProperties`) or a failsafe
        execution whose first `<includes>` lists its classes (`pomExecutionIncludes`).
        """
        pom = (self.root / self.maven["integrationTestModule"] / "pom.xml").read_text(
            encoding="utf-8"
        )
        lanes: dict[str, list[str]] = {}
        for lane, config in self.maven["lanes"].items():
            patterns: list[str] = []
            for prop in config.get("pomProperties", []):
                found = re.search(
                    rf"<{re.escape(prop)}>([^<]*)</{re.escape(prop)}>", pom
                )
                if not found:
                    raise SystemExit(
                        f"{IMPACT_MAP}: lane '{lane}' reads <{prop}> from the IT pom, which no longer defines it."
                    )
                patterns += [
                    item.strip() for item in found.group(1).split(",") if item.strip()
                ]
            execution = config.get("pomExecutionIncludes")
            if execution:
                found = re.search(
                    rf"<id>{re.escape(execution)}</id>.*?<includes>(.*?)</includes>",
                    pom,
                    re.DOTALL,
                )
                if not found:
                    raise SystemExit(
                        f"{IMPACT_MAP}: lane '{lane}' reads the includes of execution '{execution}', "
                        "which the IT pom no longer defines."
                    )
                patterns += [
                    simple_name(include)
                    for include in re.findall(
                        r"<include>([^<]+)</include>", found.group(1)
                    )
                ]
            lanes[lane] = patterns
        return lanes

    def it_paths_matching(self, pattern: str) -> list[str]:
        """Path patterns contain a '/'; everything else matches the class's simple name."""
        if "/" in pattern:
            return [
                path for path in self.it_classes if fnmatch.fnmatchcase(path, pattern)
            ]
        return [
            path
            for path, name in self.it_classes.items()
            if fnmatch.fnmatchcase(name, pattern)
        ]

    def referencing_files(self, symbol: str, roots: list[str]) -> list[str]:
        if not roots:
            return []
        result = subprocess.run(
            [
                "git",
                "grep",
                "--untracked",
                "-l",
                "-w",
                "-F",
                "-e",
                symbol,
                "--",
                *roots,
            ],
            cwd=self.root,
            capture_output=True,
            text=True,
        )
        return [line for line in result.stdout.splitlines() if line.endswith(".java")]


def convention_stem(path: str) -> str | None:
    """Entity name a production file is about, e.g. TableRepository.java -> Table."""
    name = simple_name(path)
    if path.endswith(".java") and "/src/main/java/" in path:
        for suffix in CONVENTION_SUFFIXES:
            if name.endswith(suffix) and len(name) > len(suffix):
                return name[: -len(suffix)]
        return None
    if path.endswith("_index_mapping.json"):
        return "".join(
            part.capitalize() for part in name[: -len("_index_mapping")].split("_")
        )
    if "/json/schema/entity/" in path and path.endswith(".json"):
        return name[:1].upper() + name[1:]
    if (
        "/json/schema/api/" in path
        and name.startswith("create")
        and path.endswith(".json")
    ):
        return name[len("create") :]
    return None


def generated_class_name(path: str) -> str | None:
    """Class jsonschema2pojo generates for a schema file, e.g. createTable.json -> CreateTable."""
    if "/json/schema/" in path and path.endswith(".json"):
        name = simple_name(path)
        return name[:1].upper() + name[1:]
    return None


def stem_matches(stem: str, class_name: str) -> bool:
    if len(stem) < MIN_STEM_LENGTH or not class_name.lower().startswith(stem.lower()):
        return False
    rest = class_name[len(stem) :]
    return not rest or rest[0].isupper()


class Planner:
    def __init__(self, repo: Repo, impact_map: dict[str, Any]):
        self.repo = repo
        self.map = impact_map
        self.maven = impact_map["maven"]
        self.default_engine = self.maven["defaultEngine"]
        self.it_reference_cap = self.maven["integrationTestReferenceCap"]
        self.unit_reference_cap = self.maven["unitTestReferenceCap"]
        self.unit_test_roots = [
            f"{module}/src/test/java" for module in self.maven["unitTestModules"]
        ]

    def plan(
        self,
        changed_files: list[str],
        add_its: list[str] = (),
        add_units: list[str] = (),
    ) -> Plan:
        plan = Plan(changed_files=changed_files)
        for path in changed_files:
            if matches(path, self.map["ignore"]):
                continue
            self._plan_file(plan, path)
        for name in add_its:
            paths = [
                relative
                for relative, it_name in self.repo.it_classes.items()
                if it_name == name
            ]
            if not paths:
                raise SystemExit(f"--add-it: no integration test class is named {name}")
            for relative in paths:
                self._add_it(plan, relative, "added by author", set())
            plan.triggers.setdefault("added by author", set()).add(name)
        for name in add_units:
            modules = [
                module
                for module, classes in self.repo.unit_test_classes.items()
                if name in classes
            ]
            if not modules:
                raise SystemExit(
                    f"--add-unit: no unit test class in {self.maven['unitTestModules']} is named {name}"
                )
            for module in modules:
                self._add_unit(plan, module, name, "added by author")
            plan.triggers.setdefault("added by author", set()).add(name)
        self._drop_unrunnable(plan)
        plan.commands = self._commands(plan)
        return plan

    def _plan_file(self, plan: Plan, path: str) -> None:
        mapped = False
        engines = self._engines_for(path)

        if path.startswith(self.repo.it_root + "/"):
            relative = path[len(self.repo.it_root) + 1 :]
            if relative in self.repo.it_classes:
                self._add_it(plan, relative, "changed", engines)
                plan.triggers.setdefault("changed test", set()).add(path)
                mapped = True
            elif path.endswith(".java"):
                mapped |= self._add_referencing_its(
                    plan, path, simple_name(path), engines
                )

        module = self._unit_module(path)
        if module and f"{module}/src/test/java/" in path and path.endswith(".java"):
            name = simple_name(path)
            if name in self.repo.unit_test_classes.get(module, {}):
                self._add_unit(plan, module, name, "changed")
                plan.triggers.setdefault("changed test", set()).add(path)
            else:
                self._add_referencing_unit_tests(
                    plan, name, f"test helper {name} changed", exclude=path
                )
            mapped = True
        elif "/src/main/java/" in path and path.endswith(".java"):
            # Classes outside the unit modules (the SDK, spec helpers) still get the unit
            # tests that use them; only a unit module's own classes must have one.
            covered = self._add_unit_tests_for_class(plan, simple_name(path), path)
            if module and not covered and (self.repo.root / path).exists():
                plan.untested_classes.append(path)
        elif module and f"{module}/src/main/resources/" in path:
            self._add_unit_tests_for_resource(plan, path)

        generated = generated_class_name(path)
        if generated:
            self._add_referencing_unit_tests(
                plan, generated, f"schema {path.rsplit('/', 1)[-1]} changed"
            )

        for mapping in self.map["mappings"]:
            if matches(path, mapping["sources"]):
                bucket_engines = set(mapping.get("engines", [])) | engines
                for pattern in mapping["tests"]:
                    for relative in self.repo.it_paths_matching(pattern):
                        self._add_it(
                            plan, relative, f"bucket {mapping['name']}", bucket_engines
                        )
                plan.triggers.setdefault(f"bucket {mapping['name']}", set()).add(path)
                mapped = True

        stem = convention_stem(path)
        if stem:
            hits = [
                rel
                for rel, name in self.repo.it_classes.items()
                if stem_matches(stem, name)
            ]
            for relative in hits:
                self._add_it(plan, relative, f"entity {stem}", engines)
            if hits:
                plan.triggers.setdefault(f"entity {stem}", set()).add(path)
                mapped = True

        if path.startswith("openmetadata-sdk/src/main/java/") and path.endswith(
            ".java"
        ):
            mapped |= self._add_referencing_its(plan, path, simple_name(path), engines)

        if matches(path, self.map["sharedInfrastructure"]):
            self._add_smoke(plan, f"shared infrastructure {path}", engines)
            for owner in self._full_suite_modules(path):
                plan.full_unit_modules.setdefault(owner, set()).add(f"{path} changed")
            mapped = True

        if engines and not mapped:
            mapped = True
            self._add_smoke(plan, f"engine-specific {path}", engines)

        # An IT-tree helper no IT reaches is a gap too; skipping it would record NOT NEEDED.
        if not mapped and (
            path.startswith(self.repo.it_root + "/") or not self._is_test_source(path)
        ):
            plan.unmapped_files.append(path)
            self._add_smoke(plan, f"unmapped {path}", engines)

    def _engines_for(self, path: str) -> set[str]:
        engines: set[str] = set()
        for rule in self.map.get("engineRules", []):
            if matches(path, rule["sources"]):
                engines.update(rule["engines"])
        return engines

    def _unit_module(self, path: str) -> str | None:
        for module in self.maven["unitTestModules"]:
            if path.startswith(module + "/"):
                return module
        return None

    def _is_test_source(self, path: str) -> bool:
        return "/src/test/" in path

    def _full_suite_modules(self, path: str) -> list[str]:
        if path == "pom.xml":
            return list(self.maven["unitTestModules"])
        module = self._unit_module(path)
        return [module] if module and path == f"{module}/pom.xml" else []

    def _add_it(
        self, plan: Plan, relative: str, reason: str, engines: set[str]
    ) -> None:
        if relative not in self.repo.it_classes:
            return
        name = self.repo.it_classes[relative]
        for rule in self.maven["notRunLocally"]:
            if any(self._it_pattern_matches(relative, name, p) for p in rule["tests"]):
                plan.not_run_locally[relative] = rule["where"]
                return
        if self._never_run(relative):
            return
        selection = plan.integration_tests.setdefault(relative, Selection())
        selection.reasons.add(reason)
        if engines:
            selection.engines.update(engines)
        else:
            selection.wants_default = True

    def _never_run(self, relative: str) -> bool:
        name = self.repo.it_classes[relative]
        return any(
            self._it_pattern_matches(relative, name, p) for p in self.maven["neverRun"]
        )

    @staticmethod
    def _it_pattern_matches(relative: str, name: str, pattern: str) -> bool:
        return fnmatch.fnmatchcase(relative if "/" in pattern else name, pattern)

    def _add_smoke(self, plan: Plan, reason: str, engines: set[str]) -> None:
        for pattern in self.map["smoke"]:
            for relative in self.repo.it_paths_matching(pattern):
                self._add_it(plan, relative, "smoke", engines)
        plan.triggers.setdefault("smoke", set()).add(reason)

    def _add_referencing_its(
        self, plan: Plan, path: str, symbol: str, engines: set[str]
    ) -> bool:
        """Select the ITs that use `symbol`, directly or through other IT-tree classes.

        Helpers often reach the tests only through another helper (AuthBackend ->
        TokenRefresher -> SdkClients -> every IT), and a neverRun base class such as
        BaseEntityIT reaches them through its subclasses, so both are followed.
        """
        prefix = self.repo.it_root + "/"
        referencing: set[str] = set()
        seen = {path}
        followed = {symbol}
        pending = [symbol]
        while pending and len(referencing) <= self.it_reference_cap:
            for hit in self.repo.referencing_files(pending.pop(), [self.repo.it_root]):
                if hit in seen:
                    continue
                seen.add(hit)
                relative = hit[len(prefix) :]
                if relative in self.repo.it_classes and not self._never_run(relative):
                    referencing.add(relative)
                elif simple_name(hit) not in followed:
                    followed.add(simple_name(hit))
                    pending.append(simple_name(hit))
        if not referencing:
            return False
        if len(referencing) > self.it_reference_cap:
            self._add_smoke(
                plan,
                f"{symbol} is used by more ITs than the cap of {self.it_reference_cap}",
                engines,
            )
            return True
        for relative in sorted(referencing):
            self._add_it(plan, relative, f"uses {symbol}", engines)
        return True

    def _add_unit(self, plan: Plan, module: str, name: str, reason: str) -> None:
        plan.unit_tests.setdefault(module, {}).setdefault(name, set()).add(reason)

    def _add_unit_tests_for_class(self, plan: Plan, name: str, path: str) -> bool:
        found = False
        for module, classes in self.repo.unit_test_classes.items():
            for candidate in (f"{name}Test", f"{name}Tests"):
                if candidate in classes:
                    self._add_unit(plan, module, candidate, f"tests {name}")
                    found = True
        return (
            self._add_referencing_unit_tests(plan, name, f"uses {name}", exclude=path)
            or found
        )

    def _add_unit_tests_for_resource(self, plan: Plan, path: str) -> None:
        file_name = path.rsplit("/", 1)[-1]
        self._add_referencing_unit_tests(
            plan, file_name, f"reads {file_name}", fixed_string=True
        )

    def _add_referencing_unit_tests(
        self,
        plan: Plan,
        symbol: str,
        reason: str,
        exclude: str | None = None,
        fixed_string: bool = False,
    ) -> bool:
        hits = (
            self._grep_fixed(symbol, self.unit_test_roots)
            if fixed_string
            else self.repo.referencing_files(symbol, self.unit_test_roots)
        )
        per_module: dict[str, list[str]] = {}
        for hit in hits:
            module = self._unit_module(hit)
            name = simple_name(hit)
            if (
                hit != exclude
                and module
                and name in self.repo.unit_test_classes.get(module, {})
            ):
                per_module.setdefault(module, []).append(name)
        for module, names in per_module.items():
            if len(names) > self.unit_reference_cap:
                plan.full_unit_modules.setdefault(module, set()).add(
                    f"{symbol} is used by {len(names)} tests (over the cap of {self.unit_reference_cap})"
                )
            else:
                for name in names:
                    self._add_unit(plan, module, name, reason)
        return bool(per_module)

    def _grep_fixed(self, needle: str, roots: list[str]) -> list[str]:
        result = subprocess.run(
            ["git", "grep", "--untracked", "-l", "-F", "-e", needle, "--", *roots],
            cwd=self.repo.root,
            capture_output=True,
            text=True,
        )
        return [line for line in result.stdout.splitlines() if line.endswith(".java")]

    def _drop_unrunnable(self, plan: Plan) -> None:
        for module in plan.full_unit_modules:
            plan.unit_tests.pop(module, None)
        for relative, selection in plan.integration_tests.items():
            selection.run_engines = self._run_engines(relative, selection)
        plan.unmapped_files.sort()
        plan.untested_classes.sort()

    def _run_engines(self, relative: str, selection: Selection) -> list[str]:
        suite = self.maven["suites"].get(self.lane_for(relative))
        name = self.repo.it_classes[relative]
        for rule in self.map.get("testEngines", []):
            # A class whose every test assumes one backend only skips anywhere else, and a
            # skipped run looks green; run it where it executes.
            if any(
                self._it_pattern_matches(relative, name, pattern)
                for pattern in rule["tests"]
            ):
                return sorted(rule["engines"])
        if suite:
            # A suite profile picks its backend from -DdatabaseType/-DsearchType, so it only runs
            # on the engines its table describes, and defaults to the backend CI used for it.
            engines = {
                engine for engine in selection.engines if engine in suite["engines"]
            }
            if selection.wants_default or not engines:
                engines.add(suite["defaultEngine"])
            return sorted(engines)
        engines = set(selection.engines)
        if selection.wants_default or not engines:
            engines.add(self.default_engine)
        return sorted(engines)

    def lane_order(self) -> list[str]:
        return [*self.maven["lanes"], *self.maven["suites"]]

    def lane_for(self, relative: str) -> str:
        """Suite profiles match by path; lanes by class name; the lane without members is the default."""
        name = self.repo.it_classes[relative]
        for suite, config in self.maven["suites"].items():
            if any(fnmatch.fnmatchcase(relative, p) for p in config["tests"]):
                return suite
        default_lane = None
        for lane in self.maven["lanes"]:
            members = self.repo.lanes.get(lane, [])
            if not members:
                default_lane = lane
            elif any(fnmatch.fnmatchcase(name, p) for p in members):
                return lane
        return default_lane

    def _module_test_patterns(self, module: str) -> list[str]:
        """Surefire patterns for every test class in a module, scoped to its own packages.

        `-am` runs each upstream module's surefire too, so a bare full-suite run of
        openmetadata-mcp would also run all of openmetadata-service's tests.
        """
        prefixes = set()
        for path in self.repo.unit_test_classes.get(module, {}).values():
            relative = path.split("/src/test/java/", 1)[1]
            parts = relative.split("/")
            prefixes.add("/".join(parts[:3]) if len(parts) > 3 else relative)
        patterns = []
        for prefix in sorted(prefixes):
            if prefix.endswith(".java"):
                patterns.append(prefix)
            else:
                patterns += [
                    f"{prefix}/**/{glob}.java"
                    for glob in ("*Test", "Test*", "*Tests", "*TestCase")
                ]
        return patterns

    def _commands(self, plan: Plan) -> list[Command]:
        commands: list[Command] = []
        if plan.full_unit_modules or plan.unit_tests:
            modules = sorted(set(plan.full_unit_modules) | set(plan.unit_tests))
            classes = sorted(
                {name for tests in plan.unit_tests.values() for name in tests}
            )
            selectors = [
                p
                for module in sorted(plan.full_unit_modules)
                for p in self._module_test_patterns(module)
            ]
            labels = [
                f"{module} (full suite)" for module in sorted(plan.full_unit_modules)
            ]
            labels += [
                f"{module} ({plural(len(plan.unit_tests[module]), 'class')})"
                for module in sorted(plan.unit_tests)
            ]
            commands.append(
                Command(
                    kind="unit",
                    label=", ".join(labels),
                    argv=[
                        "mvn",
                        "-B",
                        self.maven.get("unitPhase", "package"),
                        "-pl",
                        ",".join(modules),
                        "-am",
                        SKIP_REPACKAGE,
                        f"-Dtest={','.join(selectors + classes)}",
                        "-Dsurefire.failIfNoSpecifiedTests=false",
                    ],
                    report_dirs=[
                        f"{module}/target/surefire-reports" for module in modules
                    ],
                    expected_classes=classes,
                    full_suite_dirs=[
                        f"{module}/target/surefire-reports"
                        for module in sorted(plan.full_unit_modules)
                    ],
                )
            )

        module = self.maven["integrationTestModule"]
        reports = [f"{module}/target/failsafe-reports"]
        grouped: dict[tuple[str, str], list[str]] = {}
        for relative, selection in plan.integration_tests.items():
            for engine in selection.run_engines:
                grouped.setdefault((engine, self.lane_for(relative)), []).append(
                    self.repo.it_classes[relative]
                )
        order = self.lane_order()
        for engine, lane in sorted(
            grouped,
            key=lambda key: (
                key[0] != self.default_engine,
                key[0],
                order.index(key[1]),
            ),
        ):
            classes = sorted(set(grouped[(engine, lane)]))
            suite = self.maven["suites"].get(lane)
            if suite:
                profile_args = [f"-P{suite['profile']}", *suite["engines"][engine]]
                lane_args = list(suite.get("args", []))
            else:
                profile_args = [f"-P{engine}"]
                lane_args = list(self.maven["lanes"][lane]["args"])
            commands.append(
                Command(
                    kind="integration",
                    label=f"{engine} · {lane}",
                    argv=[
                        "mvn",
                        "-B",
                        "verify",
                        "-pl",
                        f":{module}",
                        "-am",
                        SKIP_REPACKAGE,
                        *profile_args,
                        *lane_args,
                        f"-Dit.test={','.join(classes)}",
                        "-Dfailsafe.failIfNoSpecifiedTests=false",
                        *SKIP_UNIT_TESTS,
                    ],
                    report_dirs=reports,
                    expected_classes=classes,
                )
            )
        return commands


def audit_impact_map(repo: Repo, impact_map: dict[str, Any]) -> list[str]:
    """Ways the map can silently skip tests. Empty when every IT is reachable."""
    maven = impact_map["maven"]
    module = maven["integrationTestModule"]
    pom = (repo.root / module / "pom.xml").read_text(encoding="utf-8")
    problems: list[str] = []

    engines = {maven["defaultEngine"]}
    engines |= {
        engine for suite in maven["suites"].values() for engine in suite["engines"]
    }
    engines |= {
        engine
        for mapping in impact_map["mappings"]
        for engine in mapping.get("engines", [])
    }
    engines |= {
        engine
        for rule in impact_map.get("engineRules", [])
        for engine in rule["engines"]
    }
    engines |= {
        engine
        for rule in impact_map.get("testEngines", [])
        for engine in rule["engines"]
    }
    problems += [
        f"engine '{e}' is not a profile in {module}/pom.xml"
        for e in sorted(engines)
        if f"<id>{e}</id>" not in pom
    ]
    problems += [
        f"testEngines: pattern '{pattern}' matches no test class"
        for rule in impact_map.get("testEngines", [])
        for pattern in rule["tests"]
        if not repo.it_paths_matching(pattern)
    ]
    problems += [
        f"suite '{name}': profile '{suite['profile']}' is not in {module}/pom.xml"
        for name, suite in maven["suites"].items()
        if f"<id>{suite['profile']}</id>" not in pom
    ]

    reachable: set[str] = set()
    for mapping in impact_map["mappings"]:
        for pattern in mapping["tests"]:
            hits = repo.it_paths_matching(pattern)
            reachable.update(hits)
            if not hits:
                problems.append(
                    f"bucket '{mapping['name']}': test pattern '{pattern}' matches no test class"
                )
    problems += [
        f"smoke: pattern '{pattern}' matches no test class"
        for pattern in impact_map["smoke"]
        if not repo.it_paths_matching(pattern)
    ]

    excluded = maven["neverRun"] + [
        pattern for rule in maven["notRunLocally"] for pattern in rule["tests"]
    ]
    for relative, name in sorted(repo.it_classes.items(), key=lambda item: item[1]):
        if relative in reachable or any(
            Planner._it_pattern_matches(relative, name, p) for p in excluded
        ):
            continue
        problems.append(
            f"{name} ({repo.it_root}/{relative}) is in no bucket, so no change selects it for the "
            "pre-PR run; add it to the bucket for the code it tests"
        )
    return problems


def print_plan(plan: Plan, planner: Planner) -> None:
    print(f"Changed files vs base: {len(plan.changed_files)}")
    if not plan.has_tests():
        print(
            "\nNo impacted Java test runs locally."
            if plan.not_run_locally
            else "\nNo Java tests are impacted by this change."
        )
    for module, reasons in sorted(plan.full_unit_modules.items()):
        print(f"\n[unit] {module}: FULL suite ({'; '.join(sorted(reasons))})")
    for module, tests in sorted(plan.unit_tests.items()):
        print(f"\n[unit] {module}: {plural(len(tests), 'class')}")
        for name, reasons in sorted(tests.items()):
            print(f"  {name}  <- {', '.join(sorted(reasons))}")
    if plan.integration_tests:
        print(f"\n[integration] {plural(len(plan.integration_tests), 'class')}")
        by_lane: dict[str, list[str]] = {}
        for relative in plan.integration_tests:
            by_lane.setdefault(planner.lane_for(relative), []).append(relative)
        for lane in planner.lane_order():
            for relative in sorted(
                by_lane.get(lane, []), key=lambda r: planner.repo.it_classes[r]
            ):
                selection = plan.integration_tests[relative]
                print(
                    f"  {planner.repo.it_classes[relative]:<48} {lane:<9} "
                    f"{','.join(selection.run_engines):<40} <- {', '.join(sorted(selection.reasons))}"
                )
    if plan.not_run_locally:
        print("\nImpacted, but not run locally:")
        for relative, where in sorted(plan.not_run_locally.items()):
            print(f"  {simple_name(relative)}  -> {where}")
    if plan.untested_classes:
        print(
            "\nChanged classes no unit test references (add one, or say why not in the PR):"
        )
        for path in plan.untested_classes:
            print(f"  {path}")
    if plan.unmapped_files:
        print(
            f"\nImpact-map gaps: no bucket covers these, so the smoke ITs were added. Add a mapping to {IMPACT_MAP}:"
        )
        for path in plan.unmapped_files:
            print(f"  {path}")
    if plan.commands:
        print("\nRun in order (Docker must be running for the integration steps):")
        for command in plan.commands:
            print(f"  # {command.kind}: {command.label}")
            print(f"  {shlex.join(command.argv)}")
        print("\nOr run them all and record the results for the PR description:")
        print('  make java_affected_run ARGS="--update-pr"')


@dataclass
class StepResult:
    command: Command
    exit_code: int
    minutes: float
    tests: int = 0
    failures: int = 0
    errors: int = 0
    skipped: int = 0
    classes_run: set[str] = field(default_factory=set)
    failed_tests: list[str] = field(default_factory=list)
    class_counts: dict[str, list[int]] = field(default_factory=dict)
    class_dirs: dict[str, str] = field(default_factory=dict)

    @property
    def missing_classes(self) -> list[str]:
        return sorted(set(self.command.expected_classes) - self.classes_run)

    @property
    def all_skipped_classes(self) -> list[str]:
        """Classes that reported tests but executed none: an assumption skipped them all."""
        return sorted(
            name
            for name, (tests, skipped, _failed) in self.class_counts.items()
            if tests and tests == skipped
        )

    @property
    def passed(self) -> bool:
        return (
            self.exit_code == 0
            and self.failures == 0
            and self.errors == 0
            and self.tests - self.skipped > 0
            and not self.missing_classes
        )


def collect_reports(
    repo_root: Path, report_dirs: list[str], result: StepResult
) -> None:
    for directory in report_dirs:
        for report in sorted((repo_root / directory).glob("TEST-*.xml")):
            try:
                suite = ET.parse(report).getroot()
            except ET.ParseError:
                result.errors += 1
                result.failed_tests.append(f"{report.name} (unreadable report)")
                continue
            suites = [suite] if suite.tag == "testsuite" else suite.findall("testsuite")
            for node in suites:
                result.tests += int(node.get("tests", 0))
                result.failures += int(node.get("failures", 0))
                result.errors += int(node.get("errors", 0))
                result.skipped += int(node.get("skipped", 0))
                name = node.get("name", "").rsplit(".", 1)[-1]
                result.classes_run.add(name)
                result.class_dirs[name] = directory
                counts = result.class_counts.setdefault(name, [0, 0, 0])
                counts[0] += int(node.get("tests", 0))
                counts[1] += int(node.get("skipped", 0))
                counts[2] += int(node.get("failures", 0)) + int(node.get("errors", 0))
                for case in node.findall("testcase"):
                    if (
                        case.find("failure") is not None
                        or case.find("error") is not None
                    ):
                        owner = case.get("classname", "").rsplit(".", 1)[-1]
                        result.failed_tests.append(f"{owner}#{case.get('name')}")


def docker_ready(repo_root: Path) -> str | None:
    if not shutil.which("docker"):
        return "docker is not on PATH; the integration tests start their databases with Testcontainers."
    probe = subprocess.run(
        ["docker", "info"], cwd=repo_root, capture_output=True, text=True
    )
    if probe.returncode != 0:
        return "Docker is not running; start it before running the integration tests."
    return None


def running_testcontainers(repo_root: Path) -> list[str]:
    result = subprocess.run(
        [
            "docker",
            "ps",
            "--filter",
            "label=org.testcontainers=true",
            "--format",
            "{{.Names}} ({{.Image}})",
        ],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    return [line for line in result.stdout.splitlines() if line]


def run_commands(repo_root: Path, plan: Plan, keep_going: bool) -> list[StepResult]:
    results: list[StepResult] = []
    for command in plan.commands:
        for directory in command.report_dirs:
            shutil.rmtree(repo_root / directory, ignore_errors=True)
        print(f"\n$ {shlex.join(command.argv)}\n", flush=True)
        started = time.monotonic()
        exit_code = subprocess.run(command.argv, cwd=repo_root, check=False).returncode
        result = StepResult(
            command, exit_code, round((time.monotonic() - started) / 60, 1)
        )
        collect_reports(repo_root, command.report_dirs, result)
        results.append(result)
        if not result.passed and not keep_going:
            print(
                f"\nStopped after a failing step ({command.label}); --keep-going runs the rest."
            )
            break
    return results


def describe_class(name: str, counts: list[int]) -> str:
    tests, skipped, failed = counts
    parts = [f"{tests - skipped - failed} passed"]
    if failed:
        parts.append(f"{failed} failed")
    if skipped:
        parts.append(f"{skipped} skipped")
    return f"`{name}` ({', '.join(parts)})"


def count_classes(result: StepResult, names: list[str]) -> str:
    executed = sum(
        result.class_counts[name][0] - result.class_counts[name][1] for name in names
    )
    return f"{plural(len(names), 'class')}, {plural(executed, 'test')} executed"


def split_full_suites(result: StepResult) -> tuple[dict[str, list[str]], list[str]]:
    """The classes of each module the step ran in full, and the classes it ran by name."""
    full = set(result.command.full_suite_dirs)
    suites: dict[str, list[str]] = {}
    named: list[str] = []
    for name in sorted(result.class_counts):
        directory = result.class_dirs.get(name)
        if directory in full:
            suites.setdefault(directory, []).append(name)
        else:
            named.append(name)
    return suites, named


def render_tests_run(results: list[StepResult]) -> list[str]:
    """Every class each step ran, so the PR states exactly what was tested before review.

    A module run in full is given as counts: openmetadata-service's class list alone is
    ~55,000 characters. If the other lists still pass CLASS_LIST_BUDGET, the longest are
    cut to counts too. Failed tests and all-skipped classes are named above it either way.
    """
    splits = [split_full_suites(result) for result in results]
    listings = [
        ", ".join(describe_class(name, result.class_counts[name]) for name in named)
        for result, (_, named) in zip(results, splits)
    ]
    excess = sum(map(len, listings)) - CLASS_LIST_BUDGET
    counted_only: set[int] = set()
    for index in sorted(
        range(len(listings)), key=lambda i: len(listings[i]), reverse=True
    ):
        if excess <= 0:
            break
        counted_only.add(index)
        excess -= len(listings[index])

    lines = ["", "**Tests run locally**", ""]
    collapsed: list[str] = []
    concurrent = False
    for index, (result, (suites, named)) in enumerate(zip(results, splits)):
        title = f"{result.command.kind} · {result.command.label}"
        parts = [
            f"full {directory.split('/target/', 1)[0]} suite, {count_classes(result, names)}"
            for directory, names in sorted(suites.items())
        ]
        if named and index in counted_only:
            parts.append(
                f"{count_classes(result, named)} (too many to list in the PR description)"
            )
        elif len(named) > INLINE_CLASS_LIMIT:
            parts.append(f"{count_classes(result, named)} (listed below)")
            collapsed += [
                "",
                f"<details><summary>{title}: {plural(len(named), 'class')}</summary>",
                "",
                listings[index],
                "",
                "</details>",
            ]
        elif named:
            parts.append(listings[index])
        lines.append(f"- {title}: {'; '.join(parts) or 'no test reports'}")
        concurrent |= result.command.kind == "integration" and len(named) > 1
    if concurrent:
        lines += [
            "",
            "_Per-class counts come from failsafe's reports, which can credit a test to the wrong "
            "class when classes run concurrently; the step totals above are exact._",
        ]
    return lines + collapsed


def overall_status(plan: Plan, results: list[StepResult]) -> str:
    if len(results) < len(plan.commands) or any(not r.passed for r in results):
        return "FAILED"
    return "PASSED"


def commit_line(commit: str, base: str, dirty: bool) -> str:
    return f"- Commit: `{commit[:12]}` (base `{base}`)" + (
        " — uncommitted changes were present" if dirty else ""
    )


def render_block(
    plan: Plan,
    planner: Planner,
    results: list[StepResult],
    commit: str,
    base: str,
    dirty: bool,
) -> str:
    status = overall_status(plan, results)
    run_minutes = round(sum(r.minutes for r in results), 1)
    lines = [
        BLOCK_START,
        f"**Local Java test run: {status}**",
        "",
        commit_line(commit, base, dirty),
        f"- Finished: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} · {run_minutes} min",
        "",
        "| Step | Scope | Classes | Tests | Failed | Skipped | Min | Result |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for result in results:
        if result.passed:
            verdict = "passed"
        elif result.tests - result.skipped <= 0:
            verdict = "no tests ran"
        else:
            verdict = "FAILED"
        lines.append(
            f"| {result.command.kind} | {result.command.label} | {len(result.classes_run)} | {result.tests} | "
            f"{result.failures + result.errors} | {result.skipped} | {result.minutes} | {verdict} |"
        )
    for command in plan.commands[len(results) :]:
        lines.append(f"| {command.kind} | {command.label} | | | | | | not run |")

    failed = [name for r in results for name in r.failed_tests]
    missing = [
        f"{name} ({r.command.label})" for r in results for name in r.missing_classes
    ]
    if failed:
        lines += ["", f"Failed: {', '.join(f'`{name}`' for name in failed[:30])}"]
    if missing:
        lines += [
            "",
            f"Selected but produced no report: {', '.join(f'`{name}`' for name in missing)}",
        ]
    skipped_only = [
        f"{name} ({r.command.label})" for r in results for name in r.all_skipped_classes
    ]
    if skipped_only:
        lines += [
            "",
            "Every test skipped, so these exercised nothing (check their assumptions — usually the engine): "
            + ", ".join(f"`{name}`" for name in skipped_only),
        ]
    lines += render_tests_run(results)

    reasons = [
        f"- `{trigger}` ← {', '.join(f'`{path}`' for path in sorted(paths)[:5])}"
        + (f" (+{len(paths) - 5} more)" if len(paths) > 5 else "")
        for trigger, paths in sorted(plan.triggers.items())
    ]
    if reasons:
        lines += [
            "",
            "<details><summary>Why these tests</summary>",
            "",
            *reasons,
            "",
            "</details>",
        ]
    if plan.not_run_locally:
        lines += [
            "",
            f"<details><summary>Impacted, not run locally ({len(plan.not_run_locally)})</summary>",
            "",
            *[
                f"- `{simple_name(r)}` → {where}"
                for r, where in sorted(plan.not_run_locally.items())
            ],
            "",
            "</details>",
        ]
    if plan.unmapped_files:
        lines += [
            "",
            f"<details><summary>Impact-map gaps ({len(plan.unmapped_files)}) — smoke ITs ran instead</summary>",
            "",
            *[f"- `{path}`" for path in plan.unmapped_files],
            "",
            "</details>",
        ]
    lines += [
        "",
        "<details><summary>Commands</summary>",
        "",
        "```bash",
        *[shlex.join(command.argv) for command in plan.commands],
        "```",
        "",
        "</details>",
        BLOCK_END,
    ]
    return "\n".join(lines) + "\n"


def render_no_tests_block(plan: Plan, commit: str, base: str, dirty: bool) -> str:
    if plan.not_run_locally:
        summary = [
            "**Local Java test run: NOT NEEDED** — the impacted tests don't run locally:",
            "",
            *[
                f"- `{simple_name(r)}` → {where}"
                for r, where in sorted(plan.not_run_locally.items())
            ],
        ]
    else:
        summary = [
            "**Local Java test run: NOT NEEDED** — no Java unit or integration test is impacted."
        ]
    return (
        "\n".join(
            [BLOCK_START, *summary, "", commit_line(commit, base, dirty), BLOCK_END]
        )
        + "\n"
    )


def upsert_block(body: str, block: str, heading_text: str = DEFAULT_PR_HEADING) -> str:
    block = block.strip()
    pattern = re.compile(
        re.escape(BLOCK_START) + r".*?" + re.escape(BLOCK_END), re.DOTALL
    )
    if pattern.search(body):
        return pattern.sub(lambda _: block, body, count=1)
    heading = body.find(heading_text)
    if heading == -1:
        return body.rstrip() + "\n\n" + block + "\n"
    insert_at = heading + len(heading_text)
    rest = body[insert_at:]
    if rest.lstrip().startswith("<!--"):
        comment_end = rest.find("-->")
        if comment_end != -1:
            insert_at += comment_end + len("-->")
    return body[:insert_at] + "\n\n" + block + "\n" + body[insert_at:]


def update_pr_body(repo_root: Path, block: str, heading_text: str) -> None:
    pr = json.loads(
        subprocess.run(
            ["gh", "pr", "view", "--json", "number,body,url"],
            cwd=repo_root,
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    )
    body = upsert_block(pr.get("body") or "", block, heading_text)
    if len(body) > GITHUB_BODY_LIMIT:
        raise SystemExit(
            f"The PR description would be {len(body):,} characters, over GitHub's limit of "
            f"{GITHUB_BODY_LIMIT:,}. Shorten the rest of it, then re-run with --update-pr; "
            f"the block is in {RESULTS_MARKDOWN}."
        )
    with tempfile.NamedTemporaryFile(
        "w", suffix=".md", delete=False, encoding="utf-8"
    ) as body_file:
        body_file.write(body)
    subprocess.run(
        ["gh", "pr", "edit", str(pr["number"]), "--body-file", body_file.name],
        cwd=repo_root,
        check=True,
    )
    Path(body_file.name).unlink(missing_ok=True)
    print(f"Updated PR description: {pr['url']}")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--base",
        default="origin/main",
        help="Base ref to diff against (default: origin/main)",
    )
    parser.add_argument(
        "--changed-files",
        type=Path,
        help="Use this newline-separated file list instead of git diff",
    )
    parser.add_argument(
        "--json", action="store_true", help="Print the plan as JSON and exit"
    )
    parser.add_argument(
        "--check-map",
        action="store_true",
        help="Report unbucketed ITs and dead patterns in the impact map, then exit",
    )
    parser.add_argument(
        "--add-it",
        default="",
        help="Comma-separated IT classes to run on top of the plan (recorded as added)",
    )
    parser.add_argument(
        "--add-unit",
        default="",
        help="Comma-separated unit test classes to run on top of the plan (recorded as added)",
    )
    parser.add_argument(
        "--run",
        action="store_true",
        help="Run the selected tests and write the results block",
    )
    parser.add_argument(
        "--update-pr",
        action="store_true",
        help="With --run, upsert the results block in the PR body",
    )
    parser.add_argument(
        "--keep-going",
        action="store_true",
        help="With --run, run every step even after one fails",
    )
    parser.add_argument(
        "--allow-concurrent",
        action="store_true",
        help="With --run, start the ITs even if another Testcontainers stack is already running",
    )
    args = parser.parse_args(argv)
    if args.update_pr and not args.run:
        parser.error("--update-pr requires --run")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    repo_root = Path(git(Path.cwd(), "rev-parse", "--show-toplevel"))
    impact_map = json.loads((repo_root / IMPACT_MAP).read_text(encoding="utf-8"))

    if args.check_map:
        problems = audit_impact_map(Repo(repo_root, impact_map), impact_map)
        print(
            "\n".join(problems) or f"{IMPACT_MAP}: every integration test is reachable."
        )
        return 1 if problems else 0

    if args.changed_files:
        changed_files = [
            line.strip()
            for line in args.changed_files.read_text().splitlines()
            if line.strip()
        ]
    else:
        changed_files = collect_changed_files(repo_root, args.base)

    planner = Planner(Repo(repo_root, impact_map), impact_map)
    plan = planner.plan(
        changed_files,
        add_its=[name.strip() for name in args.add_it.split(",") if name.strip()],
        add_units=[name.strip() for name in args.add_unit.split(",") if name.strip()],
    )

    if args.json:
        print(json.dumps(plan.to_json(), indent=2))
        return 0
    print_plan(plan, planner)
    if not args.run:
        return 0

    commit = git(repo_root, "rev-parse", "HEAD")
    dirty = has_uncommitted_changes(repo_root, impact_map["ignore"])
    if not plan.commands:
        block = render_no_tests_block(plan, commit, args.base, dirty)
        results: list[StepResult] = []
    else:
        if any(command.kind == "integration" for command in plan.commands):
            problem = docker_ready(repo_root)
            if problem:
                print(f"\n{problem}", file=sys.stderr)
                return 1
            others = running_testcontainers(repo_root)
            if others and not args.allow_concurrent:
                print(
                    "\nAnother Testcontainers stack is running (probably another checkout's ITs). Two stacks "
                    "rarely fit in Docker's memory and starve each other into timeouts. Wait for it to finish, "
                    "or pass --allow-concurrent:\n  " + "\n  ".join(others),
                    file=sys.stderr,
                )
                return 1
        results = run_commands(repo_root, plan, args.keep_going)
        block = render_block(plan, planner, results, commit, args.base, dirty)

    markdown_path = repo_root / RESULTS_MARKDOWN
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(block, encoding="utf-8")
    print(f"\nResults block written to {RESULTS_MARKDOWN}")
    if args.update_pr:
        update_pr_body(
            repo_root, block, impact_map.get("prHeading", DEFAULT_PR_HEADING)
        )
    else:
        print("Paste it into the PR description, or re-run with --update-pr.")
    return 0 if not results or overall_status(plan, results) == "PASSED" else 1


if __name__ == "__main__":
    sys.exit(main())
