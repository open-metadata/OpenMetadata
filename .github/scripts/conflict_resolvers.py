#!/usr/bin/env python3
"""Merge-queue conflict resolution: the mechanical part, and the checks on the rest.

Runs in a checkout where `git merge origin/main` has just stopped with conflicts on a
PR branch. It never runs PR code.

  classify   sort every conflicted path into one of:
               generated  output of the JSON schemas: take main's, then regenerate
               lockfile   yarn.lock: take main's, then `yarn install` in its directory
               locale     UI locale JSON: three-way merge of keys
               human      .github/** and .claude/**: never resolved by a model
               sensitive  migrations and poms: the model may resolve, a person re-queues
               ai         everything else: the Claude resolver
  apply      write the mechanical resolutions and stage them; locale files whose
             same key both sides changed differently fall back to `ai`
  check      after the model's edits: no conflict markers, no edit outside the
             conflicted set, and the lines either side added that the resolution
             no longer contains

The re-queue rule follows from the result: automatic only when every conflict was
mechanical and nothing was dropped; a person re-queues anything a model touched,
because approvals survive pushes in this repository.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import shlex
import subprocess
import sys
from collections import Counter
from dataclasses import asdict, dataclass, field
from pathlib import Path

UI = "openmetadata-ui/src/main/resources/ui"
GENERATED = (
    f"{UI}/src/generated/**",
    f"{UI}/src/jsons/**",
    f"{UI}/public/jsons/**",
)
LOCKFILES = ("yarn.lock", "**/yarn.lock")
LOCALES = (f"{UI}/src/locale/languages/*.json",)
HUMAN_ONLY = (".github/**", ".claude/**")
SENSITIVE = ("bootstrap/sql/**", "pom.xml", "**/pom.xml")
MARKERS = ("<<<<<<< ", "=======", ">>>>>>> ")
# Regeneration steps, mirroring typescript-type-generation.yml.
REGENERATE = {
    "generated": [
        ["yarn", "install", "--frozen-lockfile"],
        ["bash", "-c", f"cd {UI} && ./json2ts-generate-all.sh -l true"],
        ["bash", "-c", f"cd {UI} && yarn install --frozen-lockfile --ignore-scripts && yarn parse-schema"],
    ],
}


@dataclass
class Plan:
    generated: list[str] = field(default_factory=list)
    lockfile: list[str] = field(default_factory=list)
    locale: list[str] = field(default_factory=list)
    human: list[str] = field(default_factory=list)
    sensitive: list[str] = field(default_factory=list)
    ai: list[str] = field(default_factory=list)

    def conflicted(self) -> list[str]:
        return sorted(
            self.generated + self.lockfile + self.locale + self.human + self.sensitive + self.ai
        )

    def mechanical_only(self) -> bool:
        return not (self.human or self.sensitive or self.ai)


def matches(path: str, patterns: tuple[str, ...]) -> bool:
    for pattern in patterns:
        if pattern.endswith("/**") and path.startswith(pattern[:-2]):
            return True
        if fnmatch.fnmatchcase(path, pattern):
            return True
    return False


def git(*args: str, cwd: Path, check: bool = True, text: bool = True) -> str:
    completed = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=text, check=False
    )
    if check and completed.returncode:
        raise RuntimeError(f"git {' '.join(args)}: {completed.stderr.strip()}")
    return completed.stdout


def conflicted_paths(repo: Path) -> list[str]:
    output = git("diff", "--name-only", "--diff-filter=U", cwd=repo)
    return sorted(line for line in output.splitlines() if line)


def classify(paths: list[str]) -> Plan:
    plan = Plan()
    for path in paths:
        if matches(path, HUMAN_ONLY):
            plan.human.append(path)
        elif matches(path, GENERATED):
            plan.generated.append(path)
        elif matches(path, LOCKFILES):
            plan.lockfile.append(path)
        elif matches(path, LOCALES):
            plan.locale.append(path)
        elif matches(path, SENSITIVE):
            plan.sensitive.append(path)
        else:
            plan.ai.append(path)
    return plan


def stage(repo: Path, path: str, number: int) -> str | None:
    """A conflicted file's version: 1 base, 2 ours (the PR), 3 theirs (main)."""
    completed = subprocess.run(
        ["git", "show", f":{number}:{path}"], cwd=repo, capture_output=True, text=True, check=False
    )
    return completed.stdout if completed.returncode == 0 else None


class LocaleConflict(Exception):
    """Both sides changed the same key differently."""


def merge_json(base: object, ours: object, theirs: object, path: str = "") -> object:
    """Three-way merge of nested JSON objects, key by key."""
    if ours == theirs:
        return ours
    if base == ours:
        return theirs
    if base == theirs:
        return ours
    if not all(isinstance(value, dict) for value in (ours, theirs)):
        raise LocaleConflict(path or "<root>")
    base = base if isinstance(base, dict) else {}
    merged = {}
    for key in sorted(set(ours) | set(theirs) | set(base)):
        missing = object()
        value = merge_json(
            base.get(key, missing),
            ours.get(key, missing),
            theirs.get(key, missing),
            f"{path}.{key}" if path else key,
        )
        if value is not missing:
            merged[key] = value
    return merged


def dump_locale(document: object) -> str:
    """The repository's locale format: sorted keys, two-space indent, raw UTF-8."""
    return json.dumps(document, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def apply(repo: Path, plan: Plan) -> tuple[Plan, list[list[str]]]:
    """Resolve and stage the mechanical conflicts. Returns the plan with any locale file
    that could not be merged moved to `ai`, and the regeneration commands to run."""
    for path in plan.generated + plan.lockfile:
        git("checkout", "--theirs", "--", path, cwd=repo)
        git("add", "--", path, cwd=repo)
    still_locale = []
    for path in plan.locale:
        versions = [stage(repo, path, n) for n in (1, 2, 3)]
        try:
            base, ours, theirs = (json.loads(v) if v else {} for v in versions)
            merged = merge_json(base, ours, theirs)
        except (LocaleConflict, json.JSONDecodeError):
            plan.ai.append(path)
            continue
        (repo / path).write_text(dump_locale(merged), encoding="utf-8")
        git("add", "--", path, cwd=repo)
        still_locale.append(path)
    plan.locale = still_locale
    commands: list[list[str]] = []
    if plan.generated:
        commands += REGENERATE["generated"]
    for lockfile in plan.lockfile:
        # The path comes from the PR; quote it before it reaches a shell.
        directory = shlex.quote(str(Path(lockfile).parent) or ".")
        commands.append(["bash", "-c", f"cd {directory} && yarn install --ignore-scripts"])
    if plan.locale:
        commands.append(["bash", "-c", f"cd {UI} && yarn i18n"])
    return plan, commands


def marker_lines(text: str) -> list[int]:
    return [
        number
        for number, line in enumerate(text.splitlines(), 1)
        if line.startswith(MARKERS[0]) or line == MARKERS[1] or line.startswith(MARKERS[2])
    ]


def normalized(text: str) -> Counter:
    """Non-blank lines as a multiset, ignoring indentation and a trailing comma, which
    moves whenever an element is appended after the last one in a list."""
    return Counter(
        line.strip().rstrip(",") for line in text.splitlines() if line.strip().rstrip(",")
    )


def added_lines(base: str, side: str) -> Counter:
    """Lines a side added relative to the base."""
    return normalized(side) - normalized(base)


def dropped_lines(base: str, ours: str, theirs: str, resolved: str) -> dict[str, list[str]]:
    """Lines one side added that the resolution no longer contains. Unless the other
    side deleted or rewrote them on purpose, that is a change the resolution lost."""
    resolved_lines = normalized(resolved)
    return {
        side: sorted((added_lines(base, text) - resolved_lines).elements())
        for side, text in (("pr", ours), ("main", theirs))
    }


@dataclass
class CheckResult:
    markers: dict[str, list[int]] = field(default_factory=dict)
    outside_scope: list[str] = field(default_factory=list)
    dropped: dict[str, dict[str, list[str]]] = field(default_factory=dict)

    def ok(self) -> bool:
        return not (self.markers or self.outside_scope)

    def requeue(self, plan: Plan) -> str:
        if not self.ok():
            return "none"
        dropped_any = any(lines for sides in self.dropped.values() for lines in sides.values())
        return "auto" if plan.mechanical_only() and not dropped_any else "human"


def check(repo: Path, plan: Plan, originals: dict[str, tuple[str, str, str]]) -> CheckResult:
    """Verify the tree after mechanical resolution, the model's edits and regeneration,
    before anything is staged.

    The merge staged everything it merged cleanly and the mechanical step staged its
    own resolutions, so the only unstaged or new files may be the conflicted ones and
    regenerated output. Anything else is an edit outside the conflict.
    `originals` holds each conflicted file's (base, ours, theirs) from before any
    resolution, since staging a file discards its index stages.
    """
    result = CheckResult()
    unstaged = set(git("diff", "--name-only", cwd=repo).splitlines())
    untracked = set(git("ls-files", "--others", "--exclude-standard", cwd=repo).splitlines())
    touched = {path for path in unstaged | untracked if path}
    allowed = set(plan.conflicted()) | {path for path in touched if matches(path, GENERATED)}
    result.outside_scope = sorted(touched - allowed)
    for path in plan.conflicted():
        file = repo / path
        if not file.exists():
            continue
        text = file.read_text(encoding="utf-8", errors="replace")
        if lines := marker_lines(text):
            result.markers[path] = lines
        # Mechanical merges cannot drop a key by construction; model edits can.
        if path in originals and path in plan.ai + plan.sensitive:
            base, ours, theirs = originals[path]
            result.dropped[path] = dropped_lines(base, ours, theirs, text)
    return result


def capture_originals(repo: Path, paths: list[str]) -> dict[str, tuple[str, str, str]]:
    return {path: tuple(stage(repo, path, n) or "" for n in (1, 2, 3)) for path in paths}


def finalize(repo: Path, plan: Plan) -> list[str]:
    """Stage the resolved files and return what still blocks the merge commit: unmerged
    paths, and conflict markers in what was staged (whitespace findings are ignored, as
    the backport resolver does, since the code may already carry them)."""
    for path in plan.conflicted():
        if (repo / path).exists():
            git("add", "--", path, cwd=repo)
        else:
            git("rm", "--cached", "--quiet", "--", path, cwd=repo, check=False)
    problems = [f"unmerged: {path}" for path in conflicted_paths(repo)]
    report = git("diff", "--cached", "--check", cwd=repo, check=False)
    problems += [line for line in report.splitlines() if "conflict marker" in line.lower()]
    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("classify", "apply"):
        command = sub.add_parser(name)
        command.add_argument("--out", type=Path, required=True)
    for name in ("check", "finalize"):
        command = sub.add_parser(name)
        command.add_argument("--plan", type=Path, required=True)
        command.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)

    if args.command in ("classify", "apply"):
        paths = conflicted_paths(args.repo)
        plan = classify(paths)
        originals = capture_originals(args.repo, paths)
        commands: list[list[str]] = []
        if args.command == "apply":
            plan, commands = apply(args.repo, plan)
        payload = {
            "plan": asdict(plan),
            "regenerate": commands,
            "originals": {path: list(versions) for path, versions in originals.items()},
        }
        args.out.write_text(json.dumps(payload, indent=1))
        print(json.dumps({key: len(value) for key, value in asdict(plan).items()}))
        return 0

    payload = json.loads(args.plan.read_text())
    plan = Plan(**payload["plan"])
    if args.command == "finalize":
        problems = finalize(args.repo, plan)
        args.out.write_text(json.dumps({"ok": not problems, "problems": problems}, indent=1))
        print(json.dumps({"ok": not problems, "problems": len(problems)}))
        return 0 if not problems else 1
    originals = {path: tuple(v) for path, v in payload["originals"].items()}
    result = check(args.repo, plan, originals)
    report = {**asdict(result), "ok": result.ok(), "requeue": result.requeue(plan)}
    args.out.write_text(json.dumps(report, indent=1))
    print(json.dumps({"ok": report["ok"], "requeue": report["requeue"]}))
    return 0 if result.ok() else 1


if __name__ == "__main__":
    sys.exit(main())
