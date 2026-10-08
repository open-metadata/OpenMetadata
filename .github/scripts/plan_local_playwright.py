#!/usr/bin/env python3
"""Plan, run, and report the Playwright specs a branch must pass locally.

Pull-request checks no longer run Playwright; the merge queue runs the full
suite. Before merging, developers run the impact-mapped subset locally. This
wrapper feeds the branch diff to ``select_playwright_tests.py`` — the same
planner CI uses — so the local selection never drifts from the CI one.

    python .github/scripts/plan_local_playwright.py               # list + command
    python .github/scripts/plan_local_playwright.py --run         # run + write results
    python .github/scripts/plan_local_playwright.py --run --update-pr --workers=2

Unknown flags (``--workers=2``, ``--headed``, ...) are forwarded to
``npx playwright test``.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
SELECTOR_PATH = SCRIPT_DIR / "select_playwright_tests.py"
UI_ROOT = "openmetadata-ui/src/main/resources/ui"
IMPACT_MAP = ".github/playwright/impact-map.json"
RESULTS_JSON = "playwright/output/results.json"
RESULTS_MARKDOWN = "playwright/output/local-pr-results.md"
BLOCK_START = "<!-- local-playwright-results:start -->"
BLOCK_END = "<!-- local-playwright-results:end -->"
PLAYWRIGHT_HEADING = "#### Playwright (UI) tests"

_SELECTOR_SPEC = importlib.util.spec_from_file_location(
    "select_playwright_tests", SELECTOR_PATH
)
assert _SELECTOR_SPEC is not None and _SELECTOR_SPEC.loader is not None
SELECTOR = importlib.util.module_from_spec(_SELECTOR_SPEC)
sys.modules[_SELECTOR_SPEC.name] = SELECTOR
_SELECTOR_SPEC.loader.exec_module(SELECTOR)


@dataclass
class LocalPlan:
    specs: list[str]
    reasons: dict[str, str]
    changed_files: list[str]
    unmapped_code_files: list[str] = field(default_factory=list)
    delegated_changed_specs: list[str] = field(default_factory=list)
    deleted_changed_specs: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {
            "specs": self.specs,
            "reasons": self.reasons,
            "changedFiles": self.changed_files,
            "unmappedCodeFiles": self.unmapped_code_files,
            "delegatedChangedSpecs": self.delegated_changed_specs,
            "deletedChangedSpecs": self.deleted_changed_specs,
        }


def git(repo_root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=repo_root, check=True, capture_output=True, text=True
    ).stdout.strip()


def collect_changed_files(repo_root: Path, base: str) -> list[str]:
    try:
        merge_base = git(repo_root, "merge-base", base, "HEAD")
    except subprocess.CalledProcessError:
        sys.exit(
            f"No merge base between '{base}' and HEAD. Fetch it first "
            "(git fetch origin main) or pass another ref with --base."
        )
    # --no-renames reports both sides of a rename, so a moved spec or source
    # file maps through its old path as well as its new one.
    tracked = git(
        repo_root, "diff", "--name-only", "--no-renames", merge_base
    ).splitlines()
    untracked = git(
        repo_root, "ls-files", "--others", "--exclude-standard"
    ).splitlines()
    return sorted({path for path in [*tracked, *untracked] if path})


def run_selector(repo_root: Path, changed_files: list[str]) -> dict[str, Any]:
    with tempfile.TemporaryDirectory() as tmp:
        changed_path = Path(tmp, "changed-files.txt")
        output_path = Path(tmp, "plan.json")
        changed_path.write_text("\n".join(changed_files) + "\n", encoding="utf-8")
        subprocess.run(
            [
                sys.executable,
                str(SELECTOR_PATH),
                "--event-name",
                "pull_request",
                "--changed-files",
                str(changed_path),
                "--impact-map",
                IMPACT_MAP,
                "--output",
                str(output_path),
            ],
            cwd=repo_root,
            check=True,
            env={
                key: value
                for key, value in os.environ.items()
                if key != "GITHUB_OUTPUT"
            },
        )
        return json.loads(output_path.read_text(encoding="utf-8"))


def resolve_entries(entries: list[dict[str, Any]], repo_root: Path) -> set[str]:
    selected: dict[str, set[str]] = {}
    for entry in entries:
        SELECTOR.add_selection(selected, entry, repo_root)
    return set(selected)


def build_plan(repo_root: Path, changed_files: list[str]) -> LocalPlan:
    impact_map = json.loads((repo_root / IMPACT_MAP).read_text(encoding="utf-8"))
    delegated = impact_map.get("delegatedSpecs", [])
    plan = run_selector(repo_root, changed_files)

    # A PR with unmapped code paths stays on the targeted plan (smoke, the
    # canary slice and whatever it did map); the merge queue runs the full
    # suite. Add the canaries here too and surface the gap so the impact map
    # gets extended.
    unmapped_code_files: list[str] = plan.get("unmappedCodeFiles", [])
    add_canaries = bool(unmapped_code_files)

    selected = {selector["spec"] for selector in plan["selectors"]}
    canary_specs = resolve_entries(impact_map["canary"], repo_root)
    if add_canaries:
        selected |= canary_specs
    selected = {spec for spec in selected if not SELECTOR.matches(spec, delegated)}

    direct = set(plan.get("directChangedSpecs", []))
    smoke = resolve_entries(impact_map["smoke"], repo_root)
    canaries_requested = (
        add_canaries
        or plan.get("sharedInfrastructureChanged")
        or plan.get("unmappedChange")
    )
    reasons: dict[str, str] = {}
    for spec in selected:
        if spec in direct:
            reasons[spec] = "changed"
        elif spec in smoke:
            reasons[spec] = "smoke"
        elif canaries_requested and spec in canary_specs:
            reasons[spec] = "canary"
        else:
            reasons[spec] = "impact-mapped"

    return LocalPlan(
        specs=sorted(
            spec for spec in selected if (repo_root / UI_ROOT / spec).is_file()
        ),
        reasons=reasons,
        changed_files=changed_files,
        unmapped_code_files=sorted(unmapped_code_files),
        delegated_changed_specs=plan.get("delegatedChangedSpecs", []),
        deleted_changed_specs=plan.get("deletedChangedSpecs", []),
    )


def playwright_command(specs: list[str], extra_args: list[str]) -> list[str]:
    # No --project filter: Playwright routes each file to every project whose
    # testMatch/grep claims it (Basic, chromium, DomainIsolation, ...), which is
    # what an ordinary local run does.
    return ["npx", "playwright", "test", *specs, *extra_args]


def print_plan(plan: LocalPlan, command: list[str]) -> None:
    print(f"Changed files vs base: {len(plan.changed_files)}")
    print(f"Playwright specs to run locally: {len(plan.specs)}\n")
    for reason in ("changed", "impact-mapped", "canary", "smoke"):
        specs = [spec for spec in plan.specs if plan.reasons.get(spec) == reason]
        if specs:
            print(f"[{reason}]")
            for spec in specs:
                print(f"  {spec}")
            print()
    if plan.delegated_changed_specs:
        print("Changed specs owned by dedicated workflows (not run here):")
        for spec in plan.delegated_changed_specs:
            print(f"  {spec}")
        print()
    if plan.unmapped_code_files:
        print(
            "Impact-map gaps: CI would run the FULL suite for these files. Add mappings to "
            f"{IMPACT_MAP} so the selection is precise:"
        )
        for path in plan.unmapped_code_files:
            print(f"  {path}")
        print()
    print("Run with:")
    print(f"  cd {UI_ROOT} && {shlex.join(command)}")
    print("Or run and record results for the PR description:")
    print('  make playwright_affected_run ARGS="--update-pr"')


def summarize_results(
    report: dict[str, Any], ui_root: Path
) -> dict[str, dict[str, int]]:
    per_file: dict[str, dict[str, int]] = {}
    test_dir = Path(
        report.get("config", {}).get("rootDir") or ui_root / "playwright/e2e"
    )

    def visit(suite: dict[str, Any]) -> None:
        for spec in suite.get("specs", []):
            file_path = spec.get("file") or suite.get("file", "")
            relative = _relative_spec(file_path, test_dir, ui_root)
            counts = per_file.setdefault(
                relative, {"passed": 0, "failed": 0, "flaky": 0, "skipped": 0}
            )
            for test in spec.get("tests", []):
                status = test.get("status")
                key = {
                    "expected": "passed",
                    "unexpected": "failed",
                    "flaky": "flaky",
                }.get(status, "skipped")
                counts[key] += 1
        for child in suite.get("suites", []):
            visit(child)

    for suite in report.get("suites", []):
        visit(suite)
    return per_file


def _relative_spec(file_path: str, test_dir: Path, ui_root: Path) -> str:
    path = Path(file_path)
    if not path.is_absolute():
        path = test_dir / path
    try:
        return str(path.resolve().relative_to(ui_root.resolve()))
    except ValueError:
        return file_path


def render_block(
    plan: LocalPlan,
    per_file: dict[str, dict[str, int]],
    report: dict[str, Any],
    command: list[str],
    commit: str,
    base: str,
    dirty: bool,
) -> str:
    totals = {
        key: sum(counts[key] for counts in per_file.values())
        for key in ("passed", "failed", "flaky", "skipped")
    }
    not_run = [spec for spec in plan.specs if spec not in per_file]
    if totals["failed"] or not_run:
        status = "FAILED"
    elif totals["passed"] + totals["flaky"] == 0:
        status = "NO TESTS EXECUTED"
    else:
        status = "PASSED"
    stats = report.get("stats", {})
    duration_minutes = round(float(stats.get("duration", 0)) / 60000, 1)
    version = report.get("config", {}).get("version", "unknown")

    lines = [
        BLOCK_START,
        f"**Local Playwright run: {status}**",
        "",
        f"- Commit: `{commit[:12]}` (base `{base}`)"
        + (" — uncommitted changes were present" if dirty else ""),
        f"- Started: {stats.get('startTime', 'unknown')} · Playwright {version} · {duration_minutes} min",
        (
            f"- Totals: {totals['passed']} passed, {totals['failed']} failed, "
            f"{totals['flaky']} flaky, {totals['skipped']} skipped across {len(plan.specs)} selected specs"
        ),
        "",
        "| Spec | Reason | Passed | Failed | Flaky | Skipped |",
        "| --- | --- | ---: | ---: | ---: | ---: |",
    ]
    for spec in sorted(per_file):
        counts = per_file[spec]
        reason = plan.reasons.get(spec, "setup")
        lines.append(
            f"| `{spec}` | {reason} | {counts['passed']} | {counts['failed']} | {counts['flaky']} | {counts['skipped']} |"
        )
    for spec in not_run:
        lines.append(f"| `{spec}` | {plan.reasons.get(spec, '')} | not run | | | |")
    if plan.unmapped_code_files:
        lines += [
            "",
            (
                f"<details><summary>Impact-map gaps ({len(plan.unmapped_code_files)}) — "
                "CI would run the full suite for these; canaries were run locally</summary>"
            ),
            "",
            *[f"- `{path}`" for path in plan.unmapped_code_files],
            "",
            "</details>",
        ]
    lines += [
        "",
        "<details><summary>Command</summary>",
        "",
        "```bash",
        f"cd {UI_ROOT} && {shlex.join(command)}",
        "```",
        "",
        "</details>",
        BLOCK_END,
    ]
    return "\n".join(lines) + "\n"


def upsert_block(body: str, block: str) -> str:
    block = block.strip()
    pattern = re.compile(
        re.escape(BLOCK_START) + r".*?" + re.escape(BLOCK_END), re.DOTALL
    )
    if pattern.search(body):
        return pattern.sub(lambda _: block, body, count=1)
    heading = body.find(PLAYWRIGHT_HEADING)
    if heading == -1:
        return body.rstrip() + "\n\n" + block + "\n"
    insert_at = heading + len(PLAYWRIGHT_HEADING)
    rest = body[insert_at:]
    stripped = rest.lstrip()
    if stripped.startswith("<!--"):
        comment_end = rest.find("-->")
        if comment_end != -1:
            insert_at += comment_end + len("-->")
    return body[:insert_at] + "\n\n" + block + "\n" + body[insert_at:]


def update_pr_body(repo_root: Path, block: str) -> None:
    pr = json.loads(
        subprocess.run(
            ["gh", "pr", "view", "--json", "number,body,url"],
            cwd=repo_root,
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    )
    with tempfile.NamedTemporaryFile(
        "w", suffix=".md", delete=False, encoding="utf-8"
    ) as body_file:
        body_file.write(upsert_block(pr.get("body") or "", block))
    subprocess.run(
        ["gh", "pr", "edit", str(pr["number"]), "--body-file", body_file.name],
        cwd=repo_root,
        check=True,
    )
    Path(body_file.name).unlink(missing_ok=True)
    print(f"Updated PR description: {pr['url']}")


def parse_args(argv: list[str] | None = None) -> tuple[argparse.Namespace, list[str]]:
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
        "--run",
        action="store_true",
        help="Run the selected specs and write the results block",
    )
    parser.add_argument(
        "--update-pr",
        action="store_true",
        help="With --run, upsert the results block in the PR body",
    )
    args, extra = parser.parse_known_args(argv)
    if args.update_pr and not args.run:
        parser.error("--update-pr requires --run")
    return args, [arg for arg in extra if arg != "--"]


def main(argv: list[str] | None = None) -> int:
    args, extra_args = parse_args(argv)
    repo_root = Path(git(Path.cwd(), "rev-parse", "--show-toplevel"))
    ui_root = repo_root / UI_ROOT

    if args.changed_files:
        changed_files = [
            line.strip()
            for line in args.changed_files.read_text().splitlines()
            if line.strip()
        ]
    else:
        changed_files = collect_changed_files(repo_root, args.base)

    plan = build_plan(repo_root, changed_files)
    command = playwright_command(plan.specs, extra_args)

    if args.json:
        print(json.dumps({**plan.to_json(), "command": command}, indent=2))
        return 0
    print_plan(plan, command)
    if not args.run:
        return 0

    results_path = ui_root / RESULTS_JSON
    results_path.unlink(missing_ok=True)
    print(f"\n$ {shlex.join(command)}\n", flush=True)
    # Every CI lane sets PLAYWRIGHT_IS_OSS; without it auth.setup.ts calls the
    # Collate-only ingestionRunners API and fails before any spec runs.
    env = {**os.environ}
    env.setdefault("PLAYWRIGHT_IS_OSS", "true")
    exit_code = subprocess.run(command, cwd=ui_root, env=env, check=False).returncode
    if not results_path.exists():
        print(
            f"Playwright did not write {RESULTS_JSON}; no results block produced.",
            file=sys.stderr,
        )
        return exit_code or 1

    report = json.loads(results_path.read_text(encoding="utf-8"))
    block = render_block(
        plan,
        summarize_results(report, ui_root),
        report,
        command,
        commit=git(repo_root, "rev-parse", "HEAD"),
        base=args.base,
        dirty=bool(git(repo_root, "status", "--porcelain")),
    )
    markdown_path = ui_root / RESULTS_MARKDOWN
    markdown_path.write_text(block, encoding="utf-8")
    print(f"\nResults block written to {markdown_path.relative_to(repo_root)}")
    if args.update_pr:
        update_pr_body(repo_root, block)
    else:
        print("Paste it into the PR description, or re-run with --update-pr.")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
