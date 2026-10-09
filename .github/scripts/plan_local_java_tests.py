#!/usr/bin/env python3
"""Plan, run, and report the Java tests a branch must pass before it is queued.

Pull-request CI runs the Java unit tests only. The integration tests (ITs) run
in the merge queue, and the JavaUIIT, search-it and scale suites run nightly in
openmetadata-nightly. An IT a change breaks is therefore first seen when the PR
is ejected from the queue, unless the author ran it. This planner maps the
branch diff to the unit tests and ITs it can break and builds the Maven commands
that run them in the failsafe lane and engine profile CI uses.

``.github/java-tests/impact-map.json`` holds ownership rules only: areas own code
by directory and tests by name pattern. The rest is read from the code (who names
a changed class or method, which areas call it, which engine a test assumes), and
whatever the planner cannot place runs more tests, never fewer.

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
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import cached_property
from pathlib import Path
from typing import Any

IMPACT_MAP = ".github/java-tests/impact-map.json"
RESULTS_DIR = "target/java-tests"
RESULTS_MARKDOWN = f"{RESULTS_DIR}/local-pr-results.md"
BLOCK_START = "<!-- local-java-test-results:start -->"
BLOCK_END = "<!-- local-java-test-results:end -->"
DEFAULT_PR_HEADING = "#### Backend integration tests"
# The summary each surefire/failsafe execution prints when it finishes. Per-class lines end in
# "Time elapsed: … -- in <class>", so only the summaries match in full.
MAVEN_TOTALS = re.compile(
    r"\[(?:INFO|WARNING|ERROR)\] Tests run: (\d+), Failures: (\d+), Errors: (\d+), "
    r"Skipped: (\d+)(?:, Flakes: \d+)?"
)

# Surefire's default includes; openmetadata-service overrides them with the same four.
UNIT_TEST_CLASS = re.compile(r"^(Test\w+|\w+Test|\w+Tests|\w+TestCase)$")
IT_CLASS = re.compile(r"^\w+(IT|Test)$")
CONVENTION_SUFFIXES = ("Repository", "Resource", "Mapper", "Index")
MIN_STEM_LENGTH = 3
WORD = re.compile(r"[A-Za-z_]\w*")
COMMENT = re.compile(r"/\*.*?\*/|//[^\n]*", re.DOTALL)
IMPORT_OR_PACKAGE = re.compile(r"^(?:import|package)\s[^;]*;", re.MULTILINE)
HUNK_CONTEXT = re.compile(r"^@@ [^@]* @@ (.*)$")
METHOD_DECLARATION = re.compile(
    r"^[+-]\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|protected|private|static|final|abstract|"
    r"synchronized|default|native)\s+)*(?:<[^>]+>\s+)?[\w.$<>\[\], ?]+\s+(\w+)\s*\("
)
METHOD_BODY_START = re.compile(
    r"^[ \t]*(?:@\w+(?:\([^)]*\))?\s*)*(?:(?:public|protected|private|static|final|abstract|"
    r"synchronized|default|native)\s+)*(?:<[^>]+>\s+)?[\w.$<>\[\], ?]+\s+(\w+)\s*\([^;{]*\)"
    r"\s*(?:throws\s+[\w.,\s]+)?\{",
    re.MULTILINE,
)
NOT_METHOD_NAMES = {
    "if", "for", "while", "switch", "catch", "return", "new", "throw", "else", "try",
    "case", "assert", "super", "this", "synchronized",
}  # fmt: skip
MIN_METHOD_NAME_LENGTH = 4
# A helper most IT classes go through (SdkClients, TestNamespace) carries a change to every IT.
UNIVERSAL_HELPER_SHARE = 0.5
# Past this share of the merge-queue lanes, a selection is the full suite in all but name.
FULL_SUITE_SHARE = 0.6
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
    engine: str = ""
    lane: str = ""


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
    # Why every merge-queue IT runs: reason -> the changed files behind it.
    full_suite: dict[str, set[str]] = field(default_factory=dict)
    # Engines the changed code (anything but a test class) runs on; smoke runs on each.
    smoke_engines: set[str] = field(default_factory=set)
    smoke_on_default_engine: bool = False
    commands: list[Command] = field(default_factory=list)

    def has_tests(self) -> bool:
        return bool(
            self.unit_tests
            or self.full_unit_modules
            or self.integration_tests
            or self.full_suite
        )

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
            "fullSuite": {
                reason: sorted(files)
                for reason, files in sorted(self.full_suite.items())
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


def class_fqn(path: str) -> str | None:
    """Fully qualified name of the class a Java source file declares."""
    for root in ("/src/main/java/", "/src/test/java/"):
        if root in path and path.endswith(".java"):
            return path.split(root, 1)[1][: -len(".java")].replace("/", ".")
    return None


def is_pattern(test: str) -> bool:
    """A glob or a path; a bare class name is one test, which the map must not list."""
    return any(char in test for char in "*?[/")


def ant_to_fnmatch(pattern: str) -> str:
    """A failsafe <exclude> as an fnmatch pattern over paths under the IT source root."""
    return pattern.replace("**/", "*")


def methods_using(text: str, symbol: str) -> set[str]:
    """Names of the methods in a Java source whose bodies mention `symbol`."""
    code = COMMENT.sub(" ", re.sub(r'"(?:\\.|[^"\\])*"', '""', text))
    found: set[str] = set()
    for declaration in METHOD_BODY_START.finditer(code):
        depth, end = 1, declaration.end()
        while depth and end < len(code):
            depth += {"{": 1, "}": -1}.get(code[end], 0)
            end += 1
        if re.search(rf"\b{re.escape(symbol)}\b", code[declaration.end() : end]):
            found.add(declaration.group(1))
    return found - NOT_METHOD_NAMES


def word_index(sources: dict[str, str]) -> dict[str, set[str]]:
    """Which files mention each identifier, as `git grep -w` would find it."""
    index: dict[str, set[str]] = {}
    for path, text in sources.items():
        for word in set(WORD.findall(text)):
            index.setdefault(word, set()).add(path)
    return index


def plural(count: int, noun: str) -> str:
    return (
        f"{count} {noun}"
        if count == 1
        else f"{count} {noun}es"
        if noun.endswith("s")
        else f"{count} {noun}s"
    )


def committed_files(repo_root: Path, ref: str) -> list[str]:
    """The files of commit `ref` (blobs only: a submodule is not a file of the checkout)."""
    files = []
    for line in git(repo_root, "ls-tree", "-r", ref).splitlines():
        meta, _, path = line.partition("\t")
        if meta.split()[1:2] == ["blob"]:
            files.append(path)
    return files


def read_blobs(repo_root: Path, ref: str, paths: list[str]) -> dict[str, str]:
    """The contents of `paths` at `ref`, read in one `git cat-file --batch`; a path the
    commit lacks is left out."""
    if not paths:
        return {}
    out = subprocess.run(
        ["git", "cat-file", "--batch"],
        cwd=repo_root,
        input="".join(f"{ref}:{path}\n" for path in paths).encode(),
        capture_output=True,
        check=True,
    ).stdout
    blobs: dict[str, str] = {}
    offset = 0
    for path in paths:
        end = out.index(b"\n", offset)
        header = out[offset:end].split()
        offset = end + 1
        if header[-1:] == [b"missing"] or len(header) != 3:
            continue
        size = int(header[2])
        blobs[path] = out[offset : offset + size].decode("utf-8", errors="replace")
        offset += size + 1
    return blobs


def branch_changes(
    repo_root: Path, merge_base: str, head: str | None
) -> tuple[list[str], list[str]]:
    """(changed, deleted) files since `merge_base`: in commit `head` when given, which is
    what a push sends; else in the working tree, untracked files included."""
    target = [head] if head else []
    changed = git(
        repo_root, "diff", "--name-only", "--no-renames", merge_base, *target
    ).splitlines()
    if not head:
        changed += git(
            repo_root, "ls-files", "--others", "--exclude-standard"
        ).splitlines()
    deleted = git(
        repo_root,
        "diff",
        "--name-only",
        "--no-renames",
        "--diff-filter=D",
        merge_base,
        *target,
    ).splitlines()
    return sorted({path for path in changed if path}), [p for p in deleted if p]


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


def collect_changed_methods(
    repo_root: Path, base: str, paths: list[str]
) -> dict[str, set[str]]:
    """Names of the Java methods the branch changes, per file.

    Git's java diff driver names the method around each hunk; a hunk that adds a method
    names the one before it, so methods declared on changed lines count too. Extra names
    only add tests.
    """
    if not paths:
        return {}
    merge_base = git(repo_root, "merge-base", base, "HEAD")
    with tempfile.TemporaryDirectory() as scratch:
        attributes = Path(scratch) / "attributes"
        attributes.write_text("*.java diff=java\n", encoding="utf-8")
        diff = git(
            repo_root,
            "-c",
            f"core.attributesFile={attributes}",
            "diff",
            "-U0",
            "--no-renames",
            merge_base,
            "--",
            *paths,
        )
    methods: dict[str, set[str]] = {}
    current = None
    for line in diff.splitlines():
        if line.startswith("diff --git "):
            current = line.split(" b/", 1)[-1]
            continue
        if current is None or line.startswith(("+++", "---")):
            continue
        names = []
        hunk = HUNK_CONTEXT.match(line)
        if hunk:
            names = re.findall(r"(\w+)\s*\(", hunk.group(1))[:1]
        elif line.startswith(("+", "-")):
            names = METHOD_DECLARATION.findall(line)
        methods.setdefault(current, set()).update(
            name
            for name in names
            if len(name) >= MIN_METHOD_NAME_LENGTH and name not in NOT_METHOD_NAMES
        )
    return {path: names for path, names in methods.items() if names}


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
    """Read-only view of the checkout the planner selects from: the working tree, or with
    `ref` the tree of that commit (what a push sends, whatever the working tree holds)."""

    def __init__(self, root: Path, impact_map: dict[str, Any], ref: str | None = None):
        self.root = root
        self.ref = ref
        self.maven = impact_map["maven"]
        self.it_root = self.maven["integrationTestSourceRoot"]
        self.owned_roots = impact_map.get("ownedRoots", [])
        self.shared_infrastructure = impact_map.get("sharedInfrastructure", [])
        self._imports: dict[str, dict[str, str]] = {}
        if ref:
            self.files = committed_files(root, ref)
        else:
            files = git(
                root, "ls-files", "--cached", "--others", "--exclude-standard"
            ).splitlines()
            self.files = [path for path in files if (root / path).is_file()]
        self.file_set = set(self.files)
        self.pom = self._read(f"{self.maven['integrationTestModule']}/pom.xml")
        self.it_classes = self._integration_test_classes()
        self.unit_test_classes = self._unit_test_classes()
        self.lanes = self._lane_membership()

    def _read(self, path: str) -> str:
        if self.ref:
            return read_blobs(self.root, self.ref, [path]).get(path, "")
        return (self.root / path).read_text(encoding="utf-8", errors="replace")

    def _read_all(self, paths: list[str]) -> dict[str, str]:
        if self.ref:
            return read_blobs(self.root, self.ref, paths)
        return {path: self._read(path) for path in paths}

    def exists(self, path: str) -> bool:
        """Whether `path` is a file or a directory of the checkout."""
        if not self.ref:
            return (self.root / path).exists()
        directory = path.rstrip("/") + "/"
        return path in self.file_set or any(f.startswith(directory) for f in self.files)

    @cached_property
    def it_sources(self) -> dict[str, str]:
        """The Java the ITs are made of: the IT tree, and the client code they call the
        server through (`testSideSources`, the SDK)."""
        roots = (self.it_root + "/", *self.maven.get("testSideSources", []))
        return self._read_all(
            [
                path
                for path in self.files
                if path.startswith(roots) and path.endswith(".java")
            ]
        )

    @cached_property
    def it_words(self) -> dict[str, set[str]]:
        return word_index(self.it_sources)

    @cached_property
    def production_sources(self) -> dict[str, str]:
        return self._read_all(
            [
                path
                for path in self.files
                if path.endswith(".java")
                and "/src/main/java/" in path
                and matches(path, self.owned_roots)
            ]
        )

    @cached_property
    def production_words(self) -> dict[str, set[str]]:
        return word_index(self.production_sources)

    @cached_property
    def production_classes(self) -> dict[str, str]:
        """Fully qualified class name -> the production source file that declares it."""
        return {
            fqn: path
            for path in self.files
            if "/src/main/java/" in path and (fqn := class_fqn(path))
        }

    @cached_property
    def universal_helpers(self) -> set[str]:
        """Helpers most ITs go through, and the shared IT bootstrap every IT starts from."""
        prefix = self.it_root + "/"
        its = {prefix + relative for relative in self.it_classes}
        return {
            path
            for path in self.it_sources
            if path not in its
            and (
                matches(path, self.shared_infrastructure)
                or len(self.it_words.get(simple_name(path), set()) & its)
                > UNIVERSAL_HELPER_SHARE * len(its)
            )
        }

    def imports(self, path: str, text: str) -> dict[str, str]:
        """Simple name -> fully qualified name of each class a Java file imports."""
        cached = self._imports.get(path)
        if cached is None:
            cached = {}
            for static, name in re.findall(
                r"^import\s+(static\s+)?([\w.]+)\s*;", text, re.MULTILINE
            ):
                owner = name.rsplit(".", 1)[0] if static else name
                cached[owner.rsplit(".", 1)[-1]] = owner
            self._imports[path] = cached
        return cached

    def names_class(self, path: str, text: str, fqn: str) -> bool:
        """Whether a file mentioning the simple name of `fqn` means that class. One that
        imports another class of the same name does not; one that imports neither may
        mean it through its package, a fully qualified name or a comment, so it counts."""
        simple = fqn.rsplit(".", 1)[-1]
        imported = self.imports(path, text).get(simple)
        return imported is None or imported == fqn or fqn in text

    @cached_property
    def class_headers(self) -> dict[str, str]:
        """Each IT class's annotations and declaration, without comments."""
        prefix = self.it_root + "/"
        headers = {}
        for relative, name in self.it_classes.items():
            text = self.it_sources.get(prefix + relative, "")
            declaration = re.search(rf"\bclass\s+{re.escape(name)}\b", text)
            if not declaration:
                continue
            start = 0
            for statement in IMPORT_OR_PACKAGE.finditer(text, 0, declaration.start()):
                start = statement.end()
            headers[relative] = COMMENT.sub(" ", text[start : declaration.end()])
        return headers

    @cached_property
    def never_run(self) -> set[str]:
        """IT classes no lane runs: abstract bases, class-level @Disabled, suite-profile excludes."""
        never = {
            relative
            for relative, header in self.class_headers.items()
            if re.search(r"\babstract\b|@Disabled\b", header)
        }
        for suite in self.maven["suites"].values():
            profile = re.search(
                rf"<id>{re.escape(suite['profile'])}</id>(.*?)</profile>",
                self.pom,
                re.DOTALL,
            )
            excludes = [
                ant_to_fnmatch(exclude)
                for exclude in re.findall(
                    r"<exclude>([^<]+)</exclude>", profile.group(1) if profile else ""
                )
            ]
            never |= {
                relative
                for relative in self.it_classes
                if any(fnmatch.fnmatchcase(relative, p) for p in suite["tests"])
                and any(fnmatch.fnmatchcase(relative, e) for e in excludes)
            }
        return never

    @cached_property
    def conditional(self) -> dict[str, str]:
        """IT classes enabled only by a system property the IT pom never sets."""
        return {
            relative: prop
            for relative, header in self.class_headers.items()
            for prop in re.findall(
                r'@EnabledIfSystemProperty\s*\(\s*named\s*=\s*"([^"]+)"', header
            )
            if prop not in self.pom
        }

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
        lanes: dict[str, list[str]] = {}
        for lane, config in self.maven["lanes"].items():
            patterns: list[str] = []
            for prop in config.get("pomProperties", []):
                found = re.search(
                    rf"<{re.escape(prop)}>([^<]*)</{re.escape(prop)}>", self.pom
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
                    self.pom,
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
        add_areas: list[str] = (),
        changed_methods: dict[str, set[str]] | None = None,
        reason: str = "",
    ) -> Plan:
        plan = Plan(changed_files=changed_files)
        for path in changed_files:
            if matches(path, self.map["ignore"]):
                continue
            self._plan_file(plan, path, (changed_methods or {}).get(path, set()))
        if plan.smoke_on_default_engine:
            self._add_smoke(plan, "code other than a test class changed", set())
        if plan.smoke_engines:
            self._add_smoke(
                plan, "code other than a test class changed", plan.smoke_engines
            )
        self._add_author_choices(plan, add_its, add_units, add_areas, reason)

        lane_its = self._lane_its()
        selected = lane_its & set(plan.integration_tests)
        if not plan.full_suite and len(selected) > FULL_SUITE_SHARE * len(lane_its):
            plan.full_suite[
                f"{len(selected)} of the {len(lane_its)} merge-queue ITs were selected"
            ] = set()
        if plan.full_suite:
            for relative in lane_its:
                self._add_it(plan, relative, "full suite", set())
        self._drop_unrunnable(plan)
        plan.commands = self._commands(plan)
        return plan

    def _add_author_choices(
        self,
        plan: Plan,
        add_its: list[str],
        add_units: list[str],
        add_areas: list[str],
        reason: str,
    ) -> None:
        """Tests the author or agent adds to the plan. Nothing can take tests out of it."""
        if not (add_its or add_units or add_areas):
            return
        if not reason:
            raise SystemExit(
                'Say why the plan needs these tests: --reason "<the effect it missed>"'
            )
        label = f"added by author: {reason}"
        for name in add_its:
            paths = [
                relative
                for relative, it_name in self.repo.it_classes.items()
                if it_name == name
            ]
            if not paths:
                raise SystemExit(f"--add-it: no integration test class is named {name}")
            for relative in paths:
                self._add_it(plan, relative, label, set())
            plan.triggers.setdefault(label, set()).add(name)
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
                self._add_unit(plan, module, name, label)
            plan.triggers.setdefault(label, set()).add(name)
        for name in add_areas:
            area = next((a for a in self.map["areas"] if a["name"] == name), None)
            if area is None:
                raise SystemExit(
                    f"--add-area: no area is named {name}. Areas: "
                    + ", ".join(a["name"] for a in self.map["areas"])
                )
            self._add_area(plan, area, label, set(), f"area {name}")

    def _lane_its(self) -> set[str]:
        """Every IT the merge queue runs: the lane classes, not the suites or what no lane runs."""
        not_local = [p for rule in self.maven["notRunLocally"] for p in rule["tests"]]
        return {
            relative
            for relative, name in self.repo.it_classes.items()
            if self.lane_for(relative) in self.maven["lanes"]
            and relative not in self.repo.never_run
            and relative not in self.repo.conditional
            and not any(self._it_pattern_matches(relative, name, p) for p in not_local)
        }

    def _plan_file(self, plan: Plan, path: str, methods: set[str]) -> None:
        engines = self._engines_for(path)
        it_prefix = self.repo.it_root + "/"
        test_source = self._is_test_source(path)
        owned = False

        if path.startswith(it_prefix):
            relative = path[len(it_prefix) :]
            if relative in self.repo.it_classes:
                self._add_it(plan, relative, "changed", engines)
                plan.triggers.setdefault("changed test", set()).add(path)
                owned = True
            elif path in self.repo.universal_helpers:
                # Every IT calls it, so only the changed methods tell which ITs it affects.
                found = [
                    self._add_referencing_its(
                        plan, path, method, engines, is_method=True
                    )
                    for method in sorted(methods)
                ]
                if not any(found):
                    plan.full_suite.setdefault(
                        f"{simple_name(path)} is used by most ITs", set()
                    ).add(path)
                owned = True
            elif path.endswith(".java"):
                owned = self._add_referencing_its(
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
            owned = True
        elif "/src/main/java/" in path and path.endswith(".java"):
            name = simple_name(path)
            # Classes outside the unit modules (the SDK, spec helpers) still get the unit
            # tests that use them; only a unit module's own classes must have one.
            covered = self._add_unit_tests_for_class(plan, name, path)
            if module and not covered and (self.repo.root / path).exists():
                plan.untested_classes.append(path)
            self._add_referencing_its(plan, path, name, engines)
            for method in sorted(methods):
                self._add_referencing_its(
                    plan, path, method, engines, is_method=True, owner=name
                )
            self._add_callers(plan, path, name, engines, methods)
        elif module and f"{module}/src/main/resources/" in path:
            self._add_unit_tests_for_resource(plan, path)

        generated = generated_class_name(path)
        if generated:
            self._add_referencing_unit_tests(
                plan, generated, f"schema {path.rsplit('/', 1)[-1]} changed"
            )

        for area in self.map["areas"]:
            if matches(path, area["sources"]):
                self._add_area(plan, area, f"area {area['name']}", engines, path)
                owned = True

        stem = convention_stem(path)
        if stem and self._add_entity(plan, stem, f"entity {stem}", engines, path):
            owned = True

        if matches(path, self.map["sharedInfrastructure"]):
            plan.full_suite.setdefault("shared infrastructure", set()).add(path)
            for owner in self._full_suite_modules(path):
                plan.full_unit_modules.setdefault(owner, set()).add(f"{path} changed")
            owned = True

        test_class = path.startswith(it_prefix) and (
            path[len(it_prefix) :] in self.repo.it_classes
        )
        if not test_class and (not test_source or path.startswith(it_prefix)):
            if engines:
                plan.smoke_engines |= engines
            else:
                plan.smoke_on_default_engine = True
        if owned:
            return
        if path.startswith(it_prefix):
            # Test code no IT reaches breaks nothing, but NOT NEEDED would hide the gap.
            plan.unmapped_files.append(path)
            self._add_smoke(plan, f"no IT uses {path}", engines)
        elif not test_source:
            plan.unmapped_files.append(path)
            plan.full_suite.setdefault("no area owns the file", set()).add(path)

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
        if relative in self.repo.conditional:
            plan.not_run_locally[relative] = (
                f"only with -D{self.repo.conditional[relative]}=true, which no CI lane sets"
            )
            return
        if relative in self.repo.never_run:
            return
        selection = plan.integration_tests.setdefault(relative, Selection())
        selection.reasons.add(reason)
        if engines:
            selection.engines.update(engines)
        else:
            selection.wants_default = True

    def _add_area(
        self,
        plan: Plan,
        area: dict[str, Any],
        reason: str,
        engines: set[str],
        trigger: str,
    ) -> None:
        if area.get("fullSuite"):
            plan.full_suite.setdefault(f"area {area['name']}", set()).add(trigger)
        area_engines = set(area.get("engines", [])) | engines
        for pattern in area["tests"]:
            for relative in self.repo.it_paths_matching(pattern):
                self._add_it(plan, relative, reason, area_engines)
        plan.triggers.setdefault(reason, set()).add(trigger)

    def _add_entity(
        self, plan: Plan, stem: str, reason: str, engines: set[str], trigger: str
    ) -> bool:
        hits = [
            relative
            for relative, name in self.repo.it_classes.items()
            if stem_matches(stem, name)
        ]
        for relative in hits:
            self._add_it(plan, relative, reason, engines)
        if hits:
            plan.triggers.setdefault(reason, set()).add(trigger)
        return bool(hits)

    def _add_callers(
        self,
        plan: Plan,
        path: str,
        symbol: str,
        engines: set[str],
        methods: set[str],
    ) -> None:
        """Run the entity tests of the production code that calls the change.

        A change reaches its callers: TestCaseRepository calls TableRepository's delete
        cleanup, so the TestCase ITs run. When the diff names the changed methods, the
        callers are the files that use the class and one of them, or a method of the class
        that calls them; a widely used class is mostly called for other things. Adding the
        callers' whole areas instead doubled the median plan on recent main commits.
        """
        fqn = class_fqn(path)
        callers = {
            caller
            for caller in self.repo.production_words.get(symbol, set()) - {path}
            if not fqn
            or self.repo.names_class(caller, self.repo.production_sources[caller], fqn)
        }
        if methods:
            reached = self._methods_reaching(path, methods)
            callers = {
                caller
                for caller in callers
                if any(caller in self.repo.production_words.get(m, ()) for m in reached)
            }
        stems = {convention_stem(caller) for caller in callers}
        for stem in sorted(stems - {None}):
            self._add_entity(plan, stem, f"called from entity {stem}", engines, path)

    def _methods_reaching(self, path: str, methods: set[str]) -> set[str]:
        """The changed methods, plus the methods of the same class that call them."""
        text = self.repo.production_sources.get(path, "")
        reached = set(methods)
        frontier = set(methods)
        while frontier:
            frontier = {
                caller for name in frontier for caller in methods_using(text, name)
            } - reached
            reached |= frontier
        return reached

    def _test_rule_matches(
        self, relative: str, name: str, rule: dict[str, Any]
    ) -> bool:
        if any(
            self._it_pattern_matches(relative, name, p) for p in rule.get("tests", [])
        ):
            return True
        source = self.repo.it_sources.get(f"{self.repo.it_root}/{relative}", "")
        return any(re.search(regex, source) for regex in rule.get("assumes", []))

    @staticmethod
    def _it_pattern_matches(relative: str, name: str, pattern: str) -> bool:
        return fnmatch.fnmatchcase(relative if "/" in pattern else name, pattern)

    def _add_smoke(self, plan: Plan, reason: str, engines: set[str]) -> None:
        for pattern in self.map["smoke"]:
            for relative in self.repo.it_paths_matching(pattern):
                self._add_it(plan, relative, "smoke", engines)
        plan.triggers.setdefault("smoke", set()).add(reason)

    def _add_referencing_its(
        self,
        plan: Plan,
        path: str,
        symbol: str,
        engines: set[str],
        is_method: bool = False,
        owner: str = "",
    ) -> bool:
        """Select the ITs that name `symbol`, directly or through IT-tree helpers.

        Helpers reach the tests through other helpers (AuthBackend -> TokenRefresher ->
        SdkClients -> every IT), and a base class such as BaseEntityIT through its
        subclasses, so both are followed. A helper most ITs use (SdkClients) is followed
        only through its methods that mention the symbol: a change that breaks such a helper
        outright fails every IT, so any selection catches it; a narrower break shows in the
        ITs calling those methods. A name more than `integrationTestReferenceCap` IT files
        mention (`getId`) says nothing about which tests matter, and is skipped. A method of
        a production class counts only where its class is named too: BaseEntityIT's own
        `createEntity` is not EntityRepository's.
        """
        prefix = self.repo.it_root + "/"
        if is_method and self._too_common(symbol, path):
            return False
        referencing: set[str] = set()
        seen = {path}
        followed = {symbol}
        # (name, the class it names, or None for a method name)
        pending = [(symbol, None if is_method else class_fqn(path))]
        while pending:
            current, fqn = pending.pop()
            hits = self.repo.it_words.get(current, set()) - seen
            if owner and current == symbol:
                hits &= self.repo.it_words.get(owner, set())
            for hit in sorted(hits):
                text = self.repo.it_sources[hit]
                if fqn and not self.repo.names_class(hit, text, fqn):
                    continue
                seen.add(hit)
                relative = hit[len(prefix) :]
                if (
                    relative in self.repo.it_classes
                    and relative not in self.repo.never_run
                ):
                    referencing.add(relative)
                    continue
                if hit in self.repo.universal_helpers:
                    names = {
                        (name, None)
                        for name in methods_using(text, current)
                        if not self._too_common(name, hit)
                    }
                else:
                    names = {(simple_name(hit), class_fqn(hit))}
                for name, name_fqn in sorted(names, key=lambda item: item[0]):
                    if name not in followed:
                        followed.add(name)
                        pending.append((name, name_fqn))
        for relative in sorted(referencing):
            self._add_it(plan, relative, f"uses {symbol}", engines)
        return bool(referencing)

    def _too_common(self, method: str, path: str) -> bool:
        return (
            len(self.repo.it_words.get(method, set()) - {path}) > self.it_reference_cap
        )

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
            if self._test_rule_matches(relative, name, rule):
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
                    engine=engine,
                    lane=lane,
                )
            )
        return commands


def map_rule_problems(repo: Repo, impact_map: dict[str, Any]) -> list[str]:
    """Rules the map breaks by itself: engines and profiles the IT pom lacks, missing
    generated-source paths, single test names, and rule patterns that match nothing."""
    maven = impact_map["maven"]
    module = maven["integrationTestModule"]
    areas = impact_map["areas"]
    problems: list[str] = []

    engines = {maven["defaultEngine"]}
    engines |= {
        engine for suite in maven["suites"].values() for engine in suite["engines"]
    }
    engines |= {engine for area in areas for engine in area.get("engines", [])}
    for key in ("engineRules", "testEngines"):
        engines |= {
            engine for rule in impact_map.get(key, []) for engine in rule["engines"]
        }
    engines |= set(maven.get("ciWorkflows", {}))
    problems += [
        f"engine '{e}' is not a profile in {module}/pom.xml"
        for e in sorted(engines)
        if f"<id>{e}</id>" not in repo.pom
    ]
    problems += [
        f"suite '{name}': profile '{suite['profile']}' is not in {module}/pom.xml"
        for name, suite in maven["suites"].items()
        if f"<id>{suite['profile']}</id>" not in repo.pom
    ]
    problems += [
        f"generatedSources '{source['module']}': '{path}' does not exist"
        for source in maven.get("generatedSources", [])
        for path in (source["module"], *source["inputs"])
        if not repo.exists(path)
    ]

    def check_tests(owner: str, patterns: list[str]) -> None:
        for pattern in patterns:
            if not is_pattern(pattern):
                problems.append(
                    f"{owner}: '{pattern}' names a single test; match tests by pattern"
                )
            elif not repo.it_paths_matching(pattern):
                problems.append(
                    f"{owner}: test pattern '{pattern}' matches no test class"
                )

    for area in areas:
        problems += [
            f"area '{area['name']}': '{pattern}' names a single test; match tests by pattern"
            for pattern in area["tests"]
            if not is_pattern(pattern)
        ]
    for rule in impact_map.get("testEngines", []):
        check_tests("testEngines", rule.get("tests", []))
        problems += [
            f"testEngines: '{regex}' matches no test source"
            for regex in rule.get("assumes", [])
            if not any(re.search(regex, text) for text in repo.it_sources.values())
        ]
    for rule in maven["notRunLocally"]:
        check_tests("notRunLocally", rule["tests"])
    problems += [
        f"smoke: '{test}' matches no test class"
        for test in impact_map["smoke"]
        if not repo.it_paths_matching(test)
    ]
    return problems


def dead_area_patterns(
    repo: Repo, impact_map: dict[str, Any]
) -> list[tuple[str, str, str]]:
    """(area, "tests" or "sources", pattern) for each area pattern that matches nothing."""
    dead: list[tuple[str, str, str]] = []
    for area in impact_map["areas"]:
        dead += [
            (area["name"], "tests", pattern)
            for pattern in area["tests"]
            if is_pattern(pattern) and not repo.it_paths_matching(pattern)
        ]
        dead += [
            (area["name"], "sources", pattern)
            for pattern in area["sources"]
            if not any(fnmatch.fnmatchcase(path, pattern) for path in repo.files)
        ]
    return dead


def dead_pattern_problem(area: str, kind: str, pattern: str) -> str:
    if kind == "tests":
        return f"area '{area}': test pattern '{pattern}' matches no test class"
    return f"area '{area}': source '{pattern}' matches no file"


def unowned_file(
    path: str, impact_map: dict[str, Any], it_names: Iterable[str]
) -> bool:
    """Whether a production file needs an area and has none.

    Files outside `ownedRoots`, ignored files and shared infrastructure need none. An
    entity file whose name an IT carries (TableRepository.java, TableResourceIT) is owned
    by that convention.
    """
    if (
        not matches(path, impact_map.get("ownedRoots", []))
        or matches(path, impact_map["ignore"])
        or matches(path, impact_map["sharedInfrastructure"])
        or any(matches(path, area["sources"]) for area in impact_map["areas"])
    ):
        return False
    stem = convention_stem(path)
    return not (stem and any(stem_matches(stem, name) for name in it_names))


def unowned_its(repo: Repo, impact_map: dict[str, Any]) -> dict[str, str]:
    """IT classes (path under the IT root -> name) that a lane runs and that no area,
    entity name or notRunLocally rule claims."""
    stems = {convention_stem(path) for path in repo.files} - {None}
    owned = {
        relative
        for area in impact_map["areas"]
        for pattern in area["tests"]
        for relative in repo.it_paths_matching(pattern)
    }
    elsewhere = [
        pattern
        for rule in impact_map["maven"]["notRunLocally"]
        for pattern in rule["tests"]
    ]
    return {
        relative: name
        for relative, name in sorted(repo.it_classes.items(), key=lambda item: item[1])
        if relative not in owned
        and relative not in repo.never_run
        and relative not in repo.conditional
        and not any(stem_matches(stem, name) for stem in stems)
        and not any(Planner._it_pattern_matches(relative, name, p) for p in elsewhere)
    }


def suggest_area(repo: Repo, impact_map: dict[str, Any], path: str) -> str:
    """Which area an unowned file most likely belongs to, and why; empty when nothing says.

    An IT goes where the other ITs in its package are; any file goes where most of the
    code it imports is.
    """
    areas = impact_map["areas"]
    prefix = repo.it_root + "/"
    votes: Counter[str] = Counter()
    if path.startswith(prefix):
        package = path[len(prefix) :].rsplit("/", 1)[0]
        for relative, name in repo.it_classes.items():
            if relative.rsplit("/", 1)[0] == package and prefix + relative != path:
                votes.update(
                    area["name"]
                    for area in areas
                    if any(
                        Planner._it_pattern_matches(relative, name, pattern)
                        for pattern in area["tests"]
                    )
                )
        if votes:
            return f"'{votes.most_common(1)[0][0]}' owns the other ITs in its package"
    text = repo._read(path) if path in repo.file_set else ""
    for fqn in repo.imports(path, text).values():
        target = repo.production_classes.get(fqn)
        if target and target != path:
            votes.update(
                area["name"] for area in areas if matches(target, area["sources"])
            )
    if votes:
        ranked = ", ".join(
            f"'{name}' ({count})" for name, count in votes.most_common(3)
        )
        return f"the code it imports belongs to {ranked}"
    return ""


def unowned_file_problems(
    repo: Repo, impact_map: dict[str, Any], paths: list[str]
) -> list[str]:
    """One line per directory of unowned files: the glob to add and the likely area."""
    by_directory: dict[str, list[str]] = {}
    for path in paths:
        by_directory.setdefault(path.rsplit("/", 1)[0], []).append(path)
    problems = []
    for directory, files in sorted(by_directory.items()):
        names = sorted(path.rsplit("/", 1)[-1] for path in files)
        hint = next(
            (
                hint
                for hint in (suggest_area(repo, impact_map, p) for p in sorted(files))
                if hint
            ),
            "",
        )
        problems.append(
            f"no area owns {plural(len(names), 'file')} in {directory}/ "
            f"({', '.join(names[:3])}{', ...' if len(names) > 3 else ''}); "
            f'add "{directory}/**" to the sources of the area for that code'
            + (f" ({hint})" if hint else "")
            + "; until then a change there runs the full suite"
        )
    return problems


def unowned_it_problem(
    repo: Repo, impact_map: dict[str, Any], relative: str, name: str
) -> str:
    hint = suggest_area(repo, impact_map, f"{repo.it_root}/{relative}")
    return (
        f"{name} ({repo.it_root}/{relative}): no area owns it; add a test pattern that "
        "matches it to the area for the code it tests" + (f" ({hint})" if hint else "")
    )


def audit_impact_map(repo: Repo, impact_map: dict[str, Any]) -> list[str]:
    """Where the map leaves code or tests without an owner, or lists tests one by one.

    Empty when every IT and every production file under `ownedRoots` has an owner. An
    unowned production file runs the full suite, so a gap costs time, never a missed test.
    """
    it_names = list(repo.it_classes.values())
    return (
        map_rule_problems(repo, impact_map)
        + [dead_pattern_problem(*dead) for dead in dead_area_patterns(repo, impact_map)]
        + [
            unowned_it_problem(repo, impact_map, relative, name)
            for relative, name in unowned_its(repo, impact_map).items()
        ]
        + unowned_file_problems(
            repo,
            impact_map,
            [path for path in repo.files if unowned_file(path, impact_map, it_names)],
        )
    )


def owner_problems(
    repo: Repo, impact_map: dict[str, Any], paths: list[str]
) -> list[str]:
    """For files an agent just wrote: the ones no area owns, and where they likely belong."""
    it_names = list(repo.it_classes.values())
    problems = unowned_file_problems(
        repo,
        impact_map,
        [path for path in paths if unowned_file(path, impact_map, it_names)],
    )
    prefix = repo.it_root + "/"
    its = [
        path[len(prefix) :]
        for path in paths
        if path.startswith(prefix) and path[len(prefix) :] in repo.it_classes
    ]
    if its:
        unowned = unowned_its(repo, impact_map)
        problems += [
            unowned_it_problem(repo, impact_map, relative, unowned[relative])
            for relative in its
            if relative in unowned
        ]
    return problems


def branch_map_problems(
    repo: Repo,
    impact_map: dict[str, Any],
    base_map: dict[str, Any] | None,
    changed: list[str],
    deleted: list[str],
) -> list[str]:
    """What a branch leaves wrong in the map, to fix before its PR is raised.

    The agent that adds code or tests owns them in the map, so these are the branch's
    problems: code or ITs it adds or edits that no area owns, patterns it empties by
    deleting what they matched or adds matching nothing, and rules its map edits break.
    Problems the base branch already had are not the branch's to fix.
    """
    present = set(repo.files)
    touched = [path for path in changed if path in present]
    it_names = list(repo.it_classes.values())
    problems = unowned_file_problems(
        repo,
        impact_map,
        [path for path in touched if unowned_file(path, impact_map, it_names)],
    )
    prefix = repo.it_root + "/"
    problems += [
        unowned_it_problem(repo, impact_map, relative, name)
        for relative, name in unowned_its(repo, impact_map).items()
        if prefix + relative in touched
    ]

    before = {
        (area["name"], kind, pattern)
        for area in (base_map or {}).get("areas", [])
        for kind in ("tests", "sources")
        for pattern in area.get(kind, [])
    }
    removed_its = {
        path[len(prefix) :]: simple_name(path)
        for path in deleted
        if path.startswith(prefix) and path.endswith(".java")
    }
    for area, kind, pattern in dead_area_patterns(repo, impact_map):
        emptied = (
            any(
                Planner._it_pattern_matches(relative, name, pattern)
                for relative, name in removed_its.items()
            )
            if kind == "tests"
            else any(fnmatch.fnmatchcase(path, pattern) for path in deleted)
        )
        if emptied:
            problems.append(
                dead_pattern_problem(area, kind, pattern)
                + "; this branch deleted what it matched, so remove it"
            )
        elif (area, kind, pattern) not in before:
            problems.append(
                dead_pattern_problem(area, kind, pattern)
                + "; this branch added it, so fix or remove it"
            )

    if IMPACT_MAP in changed:
        try:
            old = set(map_rule_problems(repo, base_map)) if base_map else set()
        except KeyError:
            old = set()
        problems += [p for p in map_rule_problems(repo, impact_map) if p not in old]
    return problems


def check_branch(
    repo_root: Path,
    repo: Repo,
    impact_map: dict[str, Any],
    base: str,
    head: str | None = None,
) -> list[str]:
    """branch_map_problems against `base`: for commit `head` when given (a push sends that,
    so `repo` and `impact_map` must be read at it), else for the working tree. None when
    the base can't be resolved, so a missing fetch never blocks a push."""
    try:
        merge_base = git(repo_root, "merge-base", base, head or "HEAD")
    except subprocess.CalledProcessError:
        print(
            f"No merge base with '{base}'; the impact-map check is skipped.",
            file=sys.stderr,
        )
        return []
    try:
        base_map = json.loads(git(repo_root, "show", f"{merge_base}:{IMPACT_MAP}"))
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        base_map = None
    changed, deleted = branch_changes(repo_root, merge_base, head)
    return branch_map_problems(repo, impact_map, base_map, changed, deleted)


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
    if plan.full_suite:
        print(
            f"\n[integration] FULL suite: every merge-queue IT on {planner.default_engine}"
        )
        for reason, paths in sorted(plan.full_suite.items()):
            shown = ", ".join(sorted(paths)[:3]) + (" ..." if len(paths) > 3 else "")
            print(f"  <- {reason}" + (f": {shown}" if shown else ""))
        ci = planner.maven.get("ciWorkflows", {}).get(planner.default_engine)
        if ci:
            dispatch = f'gh workflow run "{ci["workflow"]}" --ref <branch> {ci.get("inputs", "")}'
            print(
                f"  Run it below, or in CI on your branch: {dispatch.strip()}, then record "
                'the run: make java_affected_run ARGS="--ci-run <run-id>"'
            )
    if plan.integration_tests:
        shown = {
            relative: selection
            for relative, selection in plan.integration_tests.items()
            if not plan.full_suite
            or selection.reasons != {"full suite"}
            or selection.run_engines != [planner.default_engine]
        }
        title = "also selected for their own reasons" if plan.full_suite else ""
        print(f"\n[integration] {plural(len(shown), 'class')} {title}".rstrip())
        by_lane: dict[str, list[str]] = {}
        for relative in shown:
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
            f"\nImpact-map gaps: no area owns these, so the full suite runs (test code: the smoke set). "
            f"Add the directory to an area in {IMPACT_MAP}:"
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
    # Set when a passed CI run of the full suite on this engine stands in for the step.
    ci_url: str = ""
    # The totals are Maven's own summary rather than the reports' sum (see run_commands).
    exact_totals: bool = False

    @property
    def class_total(self) -> int:
        """Test classes that reported; a nested class's tests belong to its outer classes."""
        return sum(1 for name in self.classes_run if "$" not in name)

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
        if self.ci_url:
            return True
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


def newest_file(repo_root: Path, paths: list[str]) -> tuple[float, str]:
    """The most recently modified file at or under `paths`, with its modification time."""
    newest = (0.0, "")
    for path in paths:
        root = repo_root / path
        candidates = (
            [root] if root.is_file() else root.rglob("*") if root.is_dir() else []
        )
        for candidate in candidates:
            if not candidate.is_file():
                continue
            modified = candidate.stat().st_mtime
            if modified > newest[0]:
                newest = (modified, candidate.relative_to(repo_root).as_posix())
    return newest


def stale_generated_modules(
    repo_root: Path, sources: list[dict[str, Any]]
) -> dict[str, str]:
    """Modules whose generated code predates a change to its inputs, with the newest input.

    jsonschema2pojo reuses a `javaType` class it finds compiled in the module's target/classes
    instead of generating it, so after a pull or branch switch that changes a schema, an
    incremental build keeps the old class: a merge that added TableType.DeltaLake left
    TableResourceIT failing to compile. A clean generation writes every file in one go, so
    the oldest generated file dates the last one.
    """
    stale: dict[str, str] = {}
    for source in sources:
        output = repo_root / source["output"]
        generated = (
            [f.stat().st_mtime for f in output.rglob("*") if f.is_file()]
            if output.is_dir()
            else []
        )
        changed_at, changed = newest_file(repo_root, source["inputs"])
        if generated and changed_at > min(generated):
            stale[source["module"]] = changed
    return stale


def clean_command(modules: list[str]) -> list[str]:
    return ["mvn", "-B", "-q", "clean", "-pl", ",".join(modules)]


def run_step(argv: list[str], repo_root: Path) -> tuple[int, list[int] | None]:
    """Run a step with its output shown, returning the exit code and Maven's totals.

    The totals (tests, failures, errors, skipped) add up the summary each surefire or
    failsafe execution prints; None when the build printed none.
    """
    totals: list[int] | None = None
    with subprocess.Popen(
        argv,
        cwd=repo_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        errors="replace",
    ) as process:
        for line in process.stdout or []:
            sys.stdout.write(line)
            sys.stdout.flush()
            summary = MAVEN_TOTALS.fullmatch(line.strip())
            if summary:
                counts = [int(group) for group in summary.groups()]
                totals = (
                    counts
                    if totals is None
                    else [a + b for a, b in zip(totals, counts)]
                )
    return process.returncode, totals


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


def ci_evidence(
    repo_root: Path,
    run_ids: list[str],
    head: str,
    workflows: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Engine -> the URL of a passed CI run on HEAD and the lanes it covers, per --ci-run.

    A lane counts only if every job `laneJobs` names for it ran and passed in that run: a
    workflow may not run a lane at all (the Redis workflow has no rdf lane), and one whose
    change detection skipped its lanes still concludes "success".
    """
    covered: dict[str, dict[str, Any]] = {}
    for run_id in run_ids:
        run = json.loads(
            subprocess.run(
                [
                    "gh",
                    "run",
                    "view",
                    run_id,
                    "--json",
                    "headSha,status,conclusion,url,workflowName,jobs",
                ],
                cwd=repo_root,
                check=True,
                capture_output=True,
                text=True,
            ).stdout
        )
        engine = next(
            (e for e, w in workflows.items() if w["workflow"] == run["workflowName"]),
            None,
        )
        if engine is None:
            raise SystemExit(
                f"--ci-run {run_id} is '{run['workflowName']}', not an integration-test workflow "
                f"({', '.join(w['workflow'] for w in workflows.values())})."
            )
        if run["headSha"] != head:
            raise SystemExit(
                f"--ci-run {run_id} tested {run['headSha'][:12]}, not HEAD {head[:12]}. "
                "Run the workflow on this commit."
            )
        if (run["status"], run["conclusion"]) != ("completed", "success"):
            raise SystemExit(
                f"--ci-run {run_id} is {run['status']}/{run['conclusion'] or '-'}, not a passed run."
            )
        passed = {
            job["name"] for job in run.get("jobs", []) if job["conclusion"] == "success"
        }
        lanes = {
            lane
            for lane, jobs in workflows[engine]["laneJobs"].items()
            if jobs and set(jobs) <= passed
        }
        if not lanes:
            raise SystemExit(
                f"--ci-run {run_id} ran no integration-test lane to the end: its lane jobs were "
                "skipped or failed."
            )
        covered[engine] = {"url": run["url"], "lanes": lanes}
    return covered


def ci_url(ci: dict[str, dict[str, Any]], command: Command) -> str | None:
    """The CI run that stands in for a step, if one covers its engine and lane."""
    evidence = ci.get(command.engine)
    return evidence["url"] if evidence and command.lane in evidence["lanes"] else None


def run_commands(
    repo_root: Path,
    plan: Plan,
    keep_going: bool,
    ci: dict[str, dict[str, Any]] | None = None,
) -> list[StepResult]:
    """Run the plan's steps. A step a CI run covers is taken from that run, which ran its
    whole lane on that engine."""
    results: list[StepResult] = []
    for command in plan.commands:
        url = ci_url(ci or {}, command)
        if url:
            results.append(StepResult(command, 0, 0.0, ci_url=url))
            continue
        for directory in command.report_dirs:
            shutil.rmtree(repo_root / directory, ignore_errors=True)
        print(f"\n$ {shlex.join(command.argv)}\n", flush=True)
        started = time.monotonic()
        exit_code, totals = run_step(command.argv, repo_root)
        result = StepResult(
            command, exit_code, round((time.monotonic() - started) / 60, 1)
        )
        collect_reports(repo_root, command.report_dirs, result)
        if totals:
            # The reports undercount: failsafe writes one per class name, so a nested class
            # several ITs inherit (BaseEntityIT$…) keeps only its last run.
            result.tests, result.failures, result.errors, result.skipped = totals
            result.exact_totals = True
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
    classes = sum(1 for name in names if "$" not in name)
    if result.exact_totals and set(names) == set(result.class_counts):
        executed = result.tests - result.skipped
    else:
        executed = sum(
            result.class_counts[name][0] - result.class_counts[name][1]
            for name in names
        )
    return f"{plural(classes, 'class')}, {plural(executed, 'test')} executed"


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
    concurrent = nested = False
    for index, (result, (suites, named)) in enumerate(zip(results, splits)):
        title = f"{result.command.kind} · {result.command.label}"
        if result.ci_url:
            lines.append(
                f"- {title}: every lane class, in [this CI run]({result.ci_url})"
            )
            continue
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
        nested |= any("$" in name for name in result.class_counts)
    if concurrent or nested:
        exact = all(result.exact_totals for result in results if not result.ci_url)
        lines += [
            "",
            "_Per-class counts come from the test reports, which can credit a test to the wrong "
            "class when classes run concurrently, and keep only the last run of a nested class "
            "that several test classes inherit. "
            + (
                "The step totals above are Maven's own counts._"
                if exact
                else "The step totals above are Maven's own counts where it printed them, "
                "and the reports' sum where it did not._"
            ),
        ]
    return lines + collapsed


def overall_status(plan: Plan, results: list[StepResult]) -> str:
    if len(results) < len(plan.commands) or any(not r.passed for r in results):
        return "FAILED"
    return "PASSED"


def display_command(argv: list[str]) -> str:
    """A step's command as the PR shows it; a full-suite class list would fill the body."""
    shown = [
        f"-Dit.test=<{arg.count(',') + 1} classes>"
        if arg.startswith("-Dit.test=") and arg.count(",") >= INLINE_CLASS_LIMIT
        else arg
        for arg in argv
    ]
    return shlex.join(shown)


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
        if result.ci_url:
            lines.append(
                f"| {result.command.kind} | {result.command.label} | | | | | | "
                f"passed in [CI]({result.ci_url}) |"
            )
            continue
        if result.passed:
            verdict = "passed"
        elif result.tests - result.skipped <= 0:
            verdict = "no tests ran"
        else:
            verdict = "FAILED"
        lines.append(
            f"| {result.command.kind} | {result.command.label} | {result.class_total} | {result.tests} | "
            f"{result.failures + result.errors} | {result.skipped} | {result.minutes} | {verdict} |"
        )
    for command in plan.commands[len(results) :]:
        lines.append(f"| {command.kind} | {command.label} | | | | | | not run |")

    failed = [name for r in results for name in r.failed_tests]
    # Failures Maven counted in a report a later run of the same nested class overwrote.
    unnamed = sum(
        max(0, r.failures + r.errors - len(r.failed_tests))
        for r in results
        if r.exact_totals
    )
    missing = [
        f"{name} ({r.command.label})" for r in results for name in r.missing_classes
    ]
    if failed or unnamed:
        named = [f"`{name}`" for name in failed[:30]]
        if unnamed:
            named.append(f"{unnamed} more the reports lost (see the Maven output)")
        lines += ["", f"Failed: {', '.join(named)}"]
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
        f"- **full suite** ← {reason}"
        + (f": {', '.join(f'`{path}`' for path in sorted(paths)[:5])}" if paths else "")
        + (f" (+{len(paths) - 5} more)" if len(paths) > 5 else "")
        for reason, paths in sorted(plan.full_suite.items())
    ] + [
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
        *[display_command(command.argv) for command in plan.commands],
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
        help="Report unowned ITs and production files, single-test entries and dead "
        "patterns in the impact map, then exit",
    )
    parser.add_argument(
        "--check-owner",
        nargs="+",
        metavar="PATH",
        help="Report which of these files no area owns and where they likely belong, then "
        "exit (the agent hook runs it on every file an agent writes)",
    )
    parser.add_argument(
        "--check-branch",
        action="store_true",
        help="Report the map problems this branch introduces against --base, then exit "
        "(the hooks run it before git push and gh pr create)",
    )
    parser.add_argument(
        "--head",
        metavar="REF",
        help="With --check-branch, check commit REF, which is what a push sends: its files, "
        "its map and its diff from --base, whatever the working tree holds",
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
        "--add-area",
        default="",
        help="Comma-separated impact-map areas whose tests run on top of the plan",
    )
    parser.add_argument(
        "--reason",
        default="",
        help="Why the plan needs the --add-* tests; required with them, shown in the PR",
    )
    parser.add_argument(
        "--ci-run",
        action="append",
        default=[],
        metavar="RUN_ID",
        help="With --run, a passed CI integration-test run on HEAD that stands in for the "
        "lane steps on its engine (repeat for more engines)",
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
    if args.ci_run and not args.run:
        parser.error("--ci-run requires --run")
    if args.head and not args.check_branch:
        parser.error("--head requires --check-branch")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    repo_root = Path(git(Path.cwd(), "rev-parse", "--show-toplevel"))
    impact_map = json.loads((repo_root / IMPACT_MAP).read_text(encoding="utf-8"))

    if args.check_map:
        problems = audit_impact_map(Repo(repo_root, impact_map), impact_map)
        print(
            "\n".join(problems)
            or f"{IMPACT_MAP}: every integration test and production file has an owner."
        )
        return 1 if problems else 0

    if args.check_owner:
        root = repo_root.resolve()
        paths = []
        for raw in args.check_owner:
            candidate = Path(raw)
            if not candidate.is_absolute():
                candidate = Path.cwd() / candidate
            try:
                paths.append(candidate.resolve().relative_to(root).as_posix())
            except ValueError:
                continue
        problems = owner_problems(Repo(repo_root, impact_map), impact_map, paths)
        if problems:
            print(
                f"Own the new code in {IMPACT_MAP} now, in the same change:\n"
                + "\n".join(f"- {problem}" for problem in problems)
            )
        return 1 if problems else 0

    if args.check_branch:
        if args.head:
            try:
                impact_map = json.loads(
                    git(repo_root, "show", f"{args.head}:{IMPACT_MAP}")
                )
            except (subprocess.CalledProcessError, json.JSONDecodeError):
                print(f"{args.head} has no readable {IMPACT_MAP}; nothing to check.")
                return 0
        problems = check_branch(
            repo_root,
            Repo(repo_root, impact_map, ref=args.head),
            impact_map,
            args.base,
            args.head,
        )
        print(
            f"Fix {IMPACT_MAP} in this branch before you raise the PR:\n"
            + "\n".join(f"- {problem}" for problem in problems)
            if problems
            else f"{IMPACT_MAP}: this branch leaves the map complete."
        )
        return 1 if problems else 0

    changed_methods: dict[str, set[str]] = {}
    if args.changed_files:
        changed_files = [
            line.strip()
            for line in args.changed_files.read_text().splitlines()
            if line.strip()
        ]
    else:
        changed_files = collect_changed_files(repo_root, args.base)
        changed_methods = collect_changed_methods(
            repo_root,
            args.base,
            [
                path
                for path in changed_files
                if path.endswith(".java") and (repo_root / path).exists()
            ],
        )

    def names(value: str) -> list[str]:
        return [name.strip() for name in value.split(",") if name.strip()]

    planner = Planner(Repo(repo_root, impact_map), impact_map)
    plan = planner.plan(
        changed_files,
        add_its=names(args.add_it),
        add_units=names(args.add_unit),
        add_areas=names(args.add_area),
        changed_methods=changed_methods,
        reason=args.reason.strip(),
    )

    if args.json:
        print(json.dumps(plan.to_json(), indent=2))
        return 0
    print_plan(plan, planner)
    if not args.changed_files:
        map_problems = check_branch(repo_root, planner.repo, impact_map, args.base)
        if map_problems:
            print(
                f"\nFix {IMPACT_MAP} in this branch before you raise the PR "
                "(the pre-PR hook blocks on these):"
            )
            for problem in map_problems:
                print(f"  - {problem}")
    stale = (
        stale_generated_modules(repo_root, planner.maven.get("generatedSources", []))
        if plan.commands
        else {}
    )
    why_clean = "; ".join(
        f"{module} predates {changed}" for module, changed in sorted(stale.items())
    )
    if stale and not args.run:
        print(
            f"\nGenerated code is older than its inputs ({why_clean}), so an incremental build "
            "would compile the old classes. --run cleans it first; by hand, start with:\n"
            f"  {shlex.join(clean_command(sorted(stale)))}"
        )
    if not args.run:
        return 0

    commit = git(repo_root, "rev-parse", "HEAD")
    dirty = has_uncommitted_changes(repo_root, impact_map["ignore"])
    if not plan.commands:
        block = render_no_tests_block(plan, commit, args.base, dirty)
        results: list[StepResult] = []
    else:
        ci = ci_evidence(
            repo_root, args.ci_run, commit, planner.maven.get("ciWorkflows", {})
        )
        if any(
            command.kind == "integration" and not ci_url(ci, command)
            for command in plan.commands
        ):
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
        if stale and any(not ci_url(ci, command) for command in plan.commands):
            clean = clean_command(sorted(stale))
            print(
                f"\nCleaning first: generated code is older than its inputs ({why_clean}).\n"
                f"$ {shlex.join(clean)}",
                flush=True,
            )
            if subprocess.run(clean, cwd=repo_root, check=False).returncode:
                print(f"\n{shlex.join(clean)} failed.", file=sys.stderr)
                return 1
        results = run_commands(repo_root, plan, args.keep_going, ci)
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
