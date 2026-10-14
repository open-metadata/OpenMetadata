#!/usr/bin/env python3
"""Test the CI workflows locally with act (https://github.com/nektos/act) before GitHub runs them.

  scenarios  A workflow's real job graph (needs, if, outputs, matrices, and the plan job's
             sampling step) with every other job's work replaced by a stub that passes
             or fails on cue. Each scenario states the result it expects for every job,
             so a wrong condition shows up as a mismatch. Needs Docker and act.
  job        One job exactly as written, in a throwaway copy of the repository with the
             workflows under test in place. Practical for the light jobs: plan,
             static-json, static-python, static-ci, ci-summary.
  list       The scenarios and what each one checks.

    python3 .github/scripts/ci_local.py scenarios [--workflows target/ci-workflows] [--only NAME,...]
    python3 .github/scripts/ci_local.py job static-ci [--workflows target/ci-workflows] [--event merge_group]

Without PyYAML installed, the script re-runs itself through `uv run --with pyyaml`.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import copy
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - environment bootstrap
    if shutil.which("uv") and not os.environ.get("CI_LOCAL_REEXEC"):
        os.environ["CI_LOCAL_REEXEC"] = "1"
        os.execvp("uv", ["uv", "run", "--quiet", "--no-project", "--with", "pyyaml", "python", __file__, *sys.argv[1:]])
    sys.exit("ci_local.py needs PyYAML: pip install pyyaml")

REPO = Path(__file__).resolve().parents[2]
REPOSITORY = "open-metadata/OpenMetadata"
STUB_IMAGE = "python:3.11-slim-bookworm"
JOB_IMAGE = "catthehacker/ubuntu:act-latest"
BASE_SHA = "610a7f9b33cacbb23eae1c8aa86d65fdc0f2ada1"
HEAD_SHA = "9aac6e95c795d2a658bd3ede35980c2d5bdeb98e"
PR_NUMBER = 35297
NEEDS_MARKER = "ci-local-needs:"
FILTERS = ("java", "backend", "ui", "python", "e2e", "ci")
# Jobs whose `run:` steps stay real in a scenario; everything else becomes a stub.
REAL_JOBS = {"ci.yml": ("plan", "ci-summary")}
RESULTS = ("success", "failure", "skipped")
# Steps that only make sense on a hosted runner; a local real run drops them.
LOCAL_SKIP_USES = ("jlumbroso/free-disk-space",)
# A Maven repository for the job containers, shared between local runs so dependencies
# download once. Never the host's ~/.m2: a job that installs would overwrite its jars.
M2_VOLUME = "ci-local-m2"


# ------------------------------------------------------------------- scenarios


@dataclass(frozen=True)
class Scenario:
    name: str
    about: str
    event: str
    payload: dict
    success: tuple[str, ...]
    failure: tuple[str, ...] = ()
    areas: tuple[str, ...] = ()
    variables: dict = field(default_factory=dict)
    fail: tuple[str, ...] = ()
    steps: dict = field(default_factory=dict)
    workflow: str = "ci.yml"

    def expected(self, jobs: list[str]) -> dict[str, str]:
        """Every job of the workflow: the named successes and failures, the rest skipped."""
        unknown = set(self.success) | set(self.failure)
        unknown -= set(jobs)
        if unknown:
            raise ValueError(f"scenario {self.name} names jobs the workflow does not have: {sorted(unknown)}")
        return {job: "success" if job in self.success else "failure" if job in self.failure else "skipped" for job in jobs}


def pr_event(draft: bool = False) -> dict:
    return {
        "action": "synchronize",
        "number": PR_NUMBER,
        "pull_request": {
            "number": PR_NUMBER,
            "draft": draft,
            "head": {"sha": HEAD_SHA, "ref": "feature", "repo": {"full_name": REPOSITORY}},
            "base": {"sha": BASE_SHA, "ref": "main"},
        },
        "repository": {"full_name": REPOSITORY},
    }


def queue_event() -> dict:
    return {
        "merge_group": {
            "head_sha": HEAD_SHA,
            "base_sha": BASE_SHA,
            "head_ref": f"refs/heads/gh-readonly-queue/main/pr-{PR_NUMBER}-{BASE_SHA}",
            "base_ref": "refs/heads/main",
        },
        "repository": {"full_name": REPOSITORY},
    }


def gate_event(event: str) -> dict:
    return {"workflow_run": {"id": 500, "event": event, "head_sha": HEAD_SHA, "conclusion": "failure"}}


EVERY_AREA = FILTERS
STATIC = ("static-java", "static-python", "static-ui", "static-json", "static-ci")
QUEUE_SUITES = ("build-java", "unit-java", "unit-ui", "python", "it", "playwright")
MQ = {"CI_SHADOW_MQ_PERCENT": "100"}

SCENARIOS = (
    Scenario(
        "pr-backend-change",
        "A Java-only PR: its static checks, then the Java unit tests; no queue-tier job.",
        "pull_request", pr_event(),
        areas=("java", "backend", "e2e"),
        success=("plan", "static-java", "static-ui", "static-json", "unit-java", "ci-summary"),
    ),
    Scenario(
        "pr-format-fails",
        "A formatting failure starts no suite, and the PR run cancels itself.",
        "pull_request", pr_event(),
        areas=("java", "backend", "ui", "python", "e2e"),
        fail=("static-java",),
        success=("plan", "static-python", "static-ui", "static-json", "fail-fast"),
        failure=("static-java", "ci-summary"),
    ),
    Scenario(
        "pr-draft",
        "A draft runs the static checks only.",
        "pull_request", pr_event(draft=True),
        areas=("java", "backend", "ui", "python", "e2e"),
        success=("plan", "static-java", "static-python", "static-ui", "static-json", "ci-summary"),
    ),
    Scenario(
        "pr-jest-shard-fails",
        "One failing Jest shard fails the run and nothing else.",
        "pull_request", pr_event(),
        areas=("ui", "e2e"),
        fail=("unit-ui:2",),
        success=("plan", "static-ui", "static-json", "unit-java"),
        failure=("unit-ui", "ci-summary"),
    ),
    Scenario(
        "pr-outside-sample",
        "A PR outside the shadow sample runs nothing and marks itself for the gate.",
        "pull_request", pr_event(),
        areas=EVERY_AREA,
        variables={"CI_SHADOW_PR_PERCENT": "0"},
        success=("plan", "ci-summary"),
        steps={"plan/Not sampled": "success"},
    ),
    Scenario(
        "mq-clean",
        "A queue entry builds once and runs every suite; nothing to verify.",
        "merge_group", queue_event(),
        areas=EVERY_AREA,
        variables=MQ,
        success=("plan", *STATIC, *QUEUE_SUITES, "ci-summary"),
        steps={"plan/Not sampled": "skipped"},
    ),
    Scenario(
        "mq-static-fails",
        "A static failure in the queue skips every suite through needs, without self-cancelling.",
        "merge_group", queue_event(),
        areas=EVERY_AREA,
        variables=MQ,
        fail=("static-ui",),
        success=("plan", "static-java", "static-python", "static-json", "static-ci", "build-java"),
        failure=("static-ui", "ci-summary"),
    ),
    Scenario(
        "mq-it-lane-fails",
        "One failing IT lane starts verification; the other suites are unaffected.",
        "merge_group", queue_event(),
        areas=EVERY_AREA,
        variables=MQ,
        fail=("it:postgres-opensearch/parallel",),
        success=("plan", *STATIC, "build-java", "unit-java", "unit-ui", "python", "playwright", "verify-java"),
        failure=("it", "ci-summary"),
    ),
    Scenario(
        "mq-build-fails",
        "A failed reactor build skips the IT lanes and verification, not the other suites.",
        "merge_group", queue_event(),
        areas=EVERY_AREA,
        variables=MQ,
        fail=("build-java",),
        success=("plan", *STATIC, "unit-java", "unit-ui", "python", "playwright"),
        failure=("build-java", "ci-summary"),
    ),
    Scenario(
        "mq-outside-sample",
        "A queue entry outside the shadow sample runs nothing.",
        "merge_group", queue_event(),
        areas=EVERY_AREA,
        variables={"CI_SHADOW_MQ_PERCENT": "0"},
        success=("plan", "ci-summary"),
        steps={"plan/Not sampled": "success"},
    ),
    Scenario(
        "mq-enforce-tests-every-entry",
        "Once the gate enforces, sampling is off and every entry is tested.",
        "merge_group", queue_event(),
        areas=EVERY_AREA,
        variables={"CI_SHADOW_MQ_PERCENT": "0", "MERGE_GATE_MODE": "enforce"},
        success=("plan", *STATIC, *QUEUE_SUITES, "ci-summary"),
        steps={"plan/Not sampled": "skipped"},
    ),
    Scenario(
        "manual-run",
        "A manual run has nothing to diff against, so it runs everything.",
        "workflow_dispatch", {"inputs": {}},
        success=("plan", *STATIC, *QUEUE_SUITES, "ci-summary"),
    ),
    Scenario(
        "manual-run-it-fails",
        "A manual run is never verified: it has no queue parent and no verdict to inform.",
        "workflow_dispatch", {"inputs": {}},
        fail=("it:mysql-elasticsearch/rdf",),
        success=("plan", *STATIC, "build-java", "unit-java", "unit-ui", "python", "playwright"),
        failure=("it", "ci-summary"),
    ),
    Scenario(
        "gate-queue-run",
        "A finished queue run is decided and recorded.",
        "workflow_run", gate_event("merge_group"),
        workflow="merge-gate.yml",
        success=("decide", "record"),
    ),
    Scenario(
        "gate-pr-run",
        "A finished PR run is decided; only queue entries are recorded.",
        "workflow_run", gate_event("pull_request"),
        workflow="merge-gate.yml",
        success=("decide",),
    ),
    Scenario(
        "gate-other-run",
        "A manually dispatched CI run gets no verdict.",
        "workflow_run", gate_event("workflow_dispatch"),
        workflow="merge-gate.yml",
        success=(),
    ),
    Scenario(
        "gate-decide-fails",
        "Nothing is recorded from a decision that failed.",
        "workflow_run", gate_event("merge_group"),
        workflow="merge-gate.yml",
        fail=("decide",),
        success=(),
        failure=("decide",),
    ),
    Scenario(
        "gate-sweep",
        "The schedule only sweeps.",
        "schedule", {"schedule": "*/10 * * * *"},
        workflow="merge-gate.yml",
        success=("sweep",),
    ),
)


# ------------------------------------------------------------------- stubbing


class _Dumper(yaml.SafeDumper):
    pass


def _represent_str(dumper: yaml.SafeDumper, data: str):
    style = "|" if "\n" in data else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style=style)


_Dumper.add_representer(str, _represent_str)


def dump(doc: dict) -> str:
    return yaml.dump(doc, Dumper=_Dumper, sort_keys=False, width=10_000)


def load_workflow(path: Path) -> dict:
    doc = yaml.safe_load(path.read_text())
    # YAML 1.1 reads the `on:` key as the boolean true.
    if True in doc:
        doc["on"] = doc.pop(True)
    return doc


def matrix_keys(job: dict) -> list[str]:
    matrix = (job.get("strategy") or {}).get("matrix") or {}
    return [key for key in matrix if key not in ("include", "exclude")]


def stub_step(job_id: str, job: dict, fail: tuple[str, ...]) -> dict:
    if job_id in fail:
        return {"name": "stub (fails on cue)", "run": f'echo "ci-local: {job_id} fails"; exit 1'}
    legs = [entry.split(":", 1)[1] for entry in fail if entry.startswith(f"{job_id}:")]
    if not legs:
        return {"name": "stub", "run": 'echo "ci-local: stub passed"'}
    leg = "/".join("${{ matrix.%s }}" % key for key in matrix_keys(job))
    cases = "|".join(f'"{value}"' for value in legs)
    return {
        "name": "stub (one leg fails on cue)",
        "env": {"CI_LOCAL_LEG": leg},
        "run": f'case "$CI_LOCAL_LEG" in {cases}) echo "ci-local: $CI_LOCAL_LEG fails"; exit 1;; esac\n'
        'echo "ci-local: stub passed"',
    }


def real_steps(job_id: str, job: dict, areas: tuple[str, ...]) -> list[dict]:
    """A kept job's `run:` steps as written. Actions are dropped, except the path
    filter, which reports the scenario's changed areas instead."""
    steps = []
    for step in job.get("steps") or []:
        uses = str(step.get("uses") or "")
        if "paths-filter" in uses:
            outputs = " ".join(f"{area}={'true' if area in areas else 'false'}" for area in FILTERS)
            stub = {key: step[key] for key in ("name", "id", "if") if key in step}
            stub["run"] = f'printf "%s\\n" {outputs} >> "$GITHUB_OUTPUT"'
            steps.append(stub)
        elif "run" in step:
            steps.append(copy.deepcopy(step))
    if job_id == "ci-summary":
        steps.append(
            {
                "name": "ci-local needs",
                "if": "${{ always() }}",
                "env": {"CI_LOCAL_NEEDS": "${{ toJSON(needs) }}"},
                "run": "python3 -c 'import json, os; print(\"%s\", json.dumps(json.loads(os.environ[\"CI_LOCAL_NEEDS\"])))'"
                % NEEDS_MARKER,
            }
        )
    return steps


# GitHub's hosted image has Maven; act's Ubuntu image does not (setup-java brings only
# the JDK). The build enforces Maven >= 3.8, newer than Ubuntu's package.
MAVEN_VERSION = "3.9.11"
HOSTED_TOOLS_STEP = {
    "name": "ci-local: tools the hosted runner image has",
    "run": (
        "if ! command -v mvn >/dev/null 2>&1; then\n"
        f"  tarball=/root/.m2/.ci-local/apache-maven-{MAVEN_VERSION}-bin.tar.gz\n"
        '  mkdir -p "$(dirname "$tarball")"\n'
        '  [ -s "$tarball" ] || curl -fsSL --retry 3 -o "$tarball" '
        f"https://archive.apache.org/dist/maven/maven-3/{MAVEN_VERSION}/binaries/apache-maven-{MAVEN_VERSION}-bin.tar.gz\n"
        '  tar -xzf "$tarball" -C /opt\n'
        f'  echo /opt/apache-maven-{MAVEN_VERSION}/bin >> "$GITHUB_PATH"\n'
        "fi"
    ),
}


def local_job(job: dict) -> dict:
    """A job kept whole for a local run: the hosted-runner-only steps dropped, and the
    tools the hosted image has but act's image lacks installed first."""
    job = copy.deepcopy(job)
    if "steps" in job:
        steps = [s for s in job["steps"] if not str(s.get("uses") or "").startswith(LOCAL_SKIP_USES)]
        job["steps"] = [copy.deepcopy(HOSTED_TOOLS_STEP), *steps]
    return job


def stub_workflow(doc: dict, scenario: Scenario, whole: frozenset = frozenset()) -> dict:
    """The workflow with its graph intact and its work stubbed: names, needs, ifs,
    strategies and outputs stay; called workflows become plain jobs. Jobs in `whole`
    run as written (minus LOCAL_SKIP_USES steps)."""
    real = REAL_JOBS.get(scenario.workflow, ())
    jobs = {}
    for job_id, job in doc["jobs"].items():
        if job_id in whole:
            jobs[job_id] = local_job(job)
            continue
        stub = {key: copy.deepcopy(job[key]) for key in ("name", "needs", "if", "strategy", "outputs", "env") if key in job}
        stub["runs-on"] = "ubuntu-latest"
        if job_id in real:
            stub["steps"] = real_steps(job_id, job, scenario.areas)
        else:
            stub["steps"] = [stub_step(job_id, job, scenario.fail)]
        jobs[job_id] = stub
    workflow = {"name": f"{doc.get('name', 'workflow')} [{scenario.name}]", "on": doc["on"]}
    if "env" in doc:
        workflow["env"] = copy.deepcopy(doc["env"])
    workflow["jobs"] = jobs
    return workflow


# ------------------------------------------------------------------- act


def act_binary() -> str:
    act = shutil.which("act")
    if not act:
        sys.exit("act is not installed: brew install act (https://nektosact.com)")
    return act


def ensure_image(image: str) -> None:
    present = subprocess.run(["docker", "image", "inspect", image], capture_output=True)
    if present.returncode != 0:
        print(f"pulling {image} …", flush=True)
        subprocess.run(["docker", "pull", "-q", image], check=True)


def scratch_repo(root: Path) -> None:
    """act reads github.repository from the origin remote and github.sha from HEAD."""
    for args in (
        ["init", "-q"],
        ["config", "user.email", "ci-local@example.invalid"],
        ["config", "user.name", "ci-local"],
        ["remote", "add", "origin", f"https://github.com/{REPOSITORY}.git"],
        ["add", "-A"],
        ["commit", "-qm", "ci-local"],
    ):
        subprocess.run(["git", *args], cwd=root, check=True, capture_output=True)


def run_act(act: str, root: Path, event: str, workflow: Path, payload: dict, variables: dict, image: str, extra=()):
    event_file = root / ".ci-local-event.json"
    event_file.write_text(json.dumps(payload))
    command = [
        act, event, "-W", str(workflow), "-e", str(event_file),
        "-P", f"ubuntu-latest={image}", "--json", "--rm", "--pull=false", *extra,
    ]
    for name, value in variables.items():
        command += ["--var", f"{name}={value}"]
    return subprocess.run(command, cwd=root, capture_output=True, text=True, timeout=3600)


def parse_log(stdout: str) -> tuple[dict[str, list[str]], dict[str, str], dict | None, list[str]]:
    """(results per job id, results per `job/step name`, the needs printed by
    ci-summary, the log lines) from act's JSON log."""
    jobs: dict[str, list[str]] = {}
    steps: dict[str, str] = {}
    needs = None
    lines = []
    for line in stdout.splitlines():
        try:
            record = json.loads(line)
        except ValueError:
            continue
        job_id = record.get("jobID")
        message = str(record.get("msg") or "").rstrip()
        if message:
            lines.append(f"{(record.get('job') or '').strip()}: {message}")
        if record.get("jobResult") and job_id:
            jobs.setdefault(job_id, []).append(record["jobResult"])
        if record.get("stepResult") and job_id and record.get("step"):
            steps[f"{job_id}/{record['step']}"] = record["stepResult"]
        if message.strip().startswith(NEEDS_MARKER):
            needs = json.loads(message.strip()[len(NEEDS_MARKER) :])
    return jobs, steps, needs, lines


def job_results(job_ids: list[str], jobs: dict[str, list[str]], needs: dict | None) -> dict[str, str]:
    results = {}
    for job_id in job_ids:
        if needs and job_id in needs:
            results[job_id] = needs[job_id]["result"]
        elif job_id in jobs:
            results[job_id] = "failure" if "failure" in jobs[job_id] else jobs[job_id][-1]
        else:
            results[job_id] = "skipped"
    return results


@dataclass
class Outcome:
    scenario: Scenario
    mismatches: list[str]
    results: dict[str, str]
    seconds: float
    log: list[str]
    error: str = ""


def run_scenario(act: str, workflows: Path, scenario: Scenario, work: Path) -> Outcome:
    start = time.monotonic()
    doc = load_workflow(workflows / scenario.workflow)
    job_ids = list(doc["jobs"])
    root = work / scenario.name
    (root / ".github" / "workflows").mkdir(parents=True)
    workflow = root / ".github" / "workflows" / scenario.workflow
    workflow.write_text(dump(stub_workflow(doc, scenario)))
    scratch_repo(root)
    try:
        process = run_act(act, root, scenario.event, workflow, scenario.payload, scenario.variables, STUB_IMAGE)
    except subprocess.TimeoutExpired:
        return Outcome(scenario, ["act timed out"], {}, time.monotonic() - start, [], "timeout")
    jobs, steps, needs, lines = parse_log(process.stdout)
    if not jobs and process.returncode != 0:
        # Every job skipped is a clean exit with no job records; anything else is act failing.
        return Outcome(scenario, ["act failed before any job ran"], {}, time.monotonic() - start, lines, process.stderr[-2000:])
    results = job_results(job_ids, jobs, needs)
    expected = scenario.expected(job_ids)
    mismatches = [
        f"{job_id}: expected {expected[job_id]}, got {results[job_id]}"
        for job_id in job_ids
        if results[job_id] != expected[job_id]
    ]
    for step, want in scenario.steps.items():
        got = steps.get(step, "skipped")
        if got != want:
            mismatches.append(f"step {step}: expected {want}, got {got}")
    return Outcome(scenario, mismatches, results, time.monotonic() - start, lines)


def cmd_scenarios(args: argparse.Namespace) -> int:
    act = act_binary()
    chosen = [s for s in SCENARIOS if not args.only or s.name in args.only]
    if args.only and len(chosen) != len(args.only):
        known = {s.name for s in SCENARIOS}
        sys.exit(f"unknown scenario(s): {', '.join(sorted(set(args.only) - known))}")
    ensure_image(STUB_IMAGE)
    work = Path(tempfile.mkdtemp(prefix="ci-local-"))
    print(f"{len(chosen)} scenario(s) from {args.workflows}, {args.parallel} at a time; scratch {work}", flush=True)
    failed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.parallel) as pool:
        futures = [pool.submit(run_scenario, act, args.workflows, s, work) for s in chosen]
        for future in concurrent.futures.as_completed(futures):
            outcome = future.result()
            ok = not outcome.mismatches
            failed += not ok
            mark = "PASS" if ok else "FAIL"
            print(f"{mark}  {outcome.scenario.name:<30} {outcome.seconds:5.0f}s  {outcome.scenario.about}", flush=True)
            for mismatch in outcome.mismatches:
                print(f"        {mismatch}")
            if not ok and args.verbose:
                print("\n".join(f"        | {line}" for line in outcome.log[-80:]))
                if outcome.error:
                    print(f"        stderr: {outcome.error}")
    if args.keep:
        print(f"scratch kept: {work}")
    else:
        shutil.rmtree(work, ignore_errors=True)
    print(f"\n{len(chosen) - failed}/{len(chosen)} scenarios behaved as expected")
    return 1 if failed else 0


def cmd_list(_args: argparse.Namespace) -> int:
    for scenario in SCENARIOS:
        print(f"{scenario.name:<30} {scenario.workflow:<15} {scenario.event:<18} {scenario.about}")
    return 0


# ------------------------------------------------------------------- one real job


def _git_paths(*args: str) -> list[str]:
    out = subprocess.run(["git", *args, "-z"], cwd=REPO, check=True, capture_output=True).stdout
    return [path.decode() for path in out.split(b"\0") if path]


def _place(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_symlink() or destination.exists():
        destination.unlink()
    if source.is_symlink():
        os.symlink(os.readlink(source), destination)
    elif source.is_file():
        shutil.copy2(source, destination)


def _commit(root: Path, message: str) -> str:
    subprocess.run(["git", "add", "-A"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-q", "--allow-empty", "-m", message], cwd=root, check=True, capture_output=True)
    return subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, check=True, capture_output=True, text=True).stdout.strip()


def apply_patch(root: Path, patch: Path | None) -> None:
    if patch:
        subprocess.run(["git", "apply", "--whitespace=nowarn", str(patch.resolve())], cwd=root, check=True)


def copy_tree(target: Path, workflows: Path, base_patch: Path | None = None, entry_patch: Path | None = None) -> tuple[str, str]:
    """A throwaway repository with two commits, like a queue entry: `base` is the real
    HEAD, `entry` adds the working tree's changes and the workflows under test. A
    plain copy with its own history, so nothing here can reach the real repository.
    A patch can be laid on either commit (a failure broken on main, or one the entry
    introduces). Returns (base, entry) commit SHAs."""
    changed = set(_git_paths("diff", "--name-only", "HEAD"))
    for path in _git_paths("ls-files", "--cached"):
        source, destination = REPO / path, target / path
        if path in changed:
            head = subprocess.run(["git", "show", f"HEAD:{path}"], cwd=REPO, capture_output=True)
            if head.returncode == 0:
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(head.stdout)
            continue
        _place(source, destination)
    subprocess.run(["git", "init", "-q"], cwd=target, check=True)
    for args in (
        ["config", "user.email", "ci-local@example.invalid"],
        ["config", "user.name", "ci-local"],
        ["remote", "add", "origin", f"https://github.com/{REPOSITORY}.git"],
    ):
        subprocess.run(["git", *args], cwd=target, check=True)
    apply_patch(target, base_patch)
    base = _commit(target, "base: HEAD of the real repository")
    for path in sorted(changed | set(_git_paths("ls-files", "--others", "--exclude-standard"))):
        source = REPO / path
        if source.exists() or source.is_symlink():
            _place(source, target / path)
        elif (target / path).exists():
            (target / path).unlink()
    if workflows.resolve() != (REPO / ".github" / "workflows").resolve():
        for staged in sorted(workflows.glob("*.y*ml")):
            _place(staged, target / ".github" / "workflows" / staged.name)
    apply_patch(target, entry_patch)
    return base, _commit(target, "entry: the working tree and the workflows under test")


# act's artifact server speaks the v4 artifact protocol only; later majors of the
# artifact actions fail in CreateArtifact. Local runs swap the major in the throwaway
# copy (workflows and composite actions), never in the repository.
ARTIFACT_ACTION = re.compile(r"(actions/(?:upload|download)-artifact)@v(?:[5-9]|\d\d+)\b")


def localize_artifact_actions(root: Path) -> list[str]:
    changed = []
    for path in [*root.glob(".github/workflows/*.y*ml"), *root.glob(".github/actions/**/action.y*ml"), *root.glob(".ci-local/*.y*ml")]:
        text = path.read_text()
        local = ARTIFACT_ACTION.sub(r"\1@v4", text)
        if local != text:
            path.write_text(local)
            changed.append(str(path.relative_to(root)))
    return changed


ACT_DECORATION = re.compile(r"^\s*(?:⭐|✅|❌|🐳|⚙|🚀|🏁|☁|🧪|❓|❗|💬|🔧)")
GH_ACTION = re.compile(r"^[\w.-]+/[\w.-]+(?:/[\w./-]+)?@[\w.-]+$")


def github_step_name(step: str) -> str:
    """GitHub names an unnamed `uses:` step "Run owner/repo@ref"; act shows the bare ref."""
    return f"Run {step}" if GH_ACTION.match(step) else step


def job_logs(stdout: str) -> dict[str, dict]:
    """Per job display name (workflow prefix dropped): its result, the step that failed,
    and a GitHub-shaped log of its steps' raw output, so the gate's readers see what
    they would see on GitHub."""
    jobs: dict[str, dict] = {}
    for line in stdout.splitlines():
        try:
            record = json.loads(line)
        except ValueError:
            continue
        display = str(record.get("job") or "").strip()
        if "/" not in display:
            continue
        name = display.split("/", 1)[1].strip()
        job = jobs.setdefault(name, {"id": record.get("jobID"), "result": None, "failed_step": None, "steps": [], "errors": []})
        step = github_step_name(str(record.get("step") or "").strip()) if record.get("step") else ""
        if step and (not job["steps"] or job["steps"][-1][0] != step):
            job["steps"].append((step, []))
        message = str(record.get("msg") or "").rstrip()
        if "::error" in message and job["steps"]:
            # GitHub turns ::error:: into an annotation (the gate's job reason) and an
            # ##[error] log line; act only echoes the command.
            text = message.split("::", 2)[-1].strip()
            job["errors"].append(text)
            job["steps"][-1][1].append(f"##[error]{text}")
        elif record.get("raw_output") and job["steps"] and not ACT_DECORATION.match(message):
            job["steps"][-1][1].append(message)
        if record.get("stepResult") == "failure" and step and record.get("stage") != "Post" and not job["failed_step"]:
            job["failed_step"] = step
        if record.get("jobResult"):
            job["result"] = record["jobResult"]
    for job in jobs.values():
        log = []
        for step, output in job["steps"]:
            log.append(f"##[group]Run {step}")
            log.append("##[endgroup]")
            log += output
            if step == job["failed_step"]:
                log.append("##[error]Process completed with exit code 1.")
        job["log"] = "\n".join(log)
    return jobs


def local_gate(stdout: str, artifacts_dir: Path, event: str, attempt: int, triage_mode: str) -> tuple[dict, list[dict]]:
    """What merge-gate.yml would decide for this local run, with the gate's own code:
    failed jobs from act's log, outcomes and verify documents from the artifact store,
    the failing step's log read by merge_gate_triage, then decide (queue) or decide_pr."""
    scripts = str(Path(__file__).resolve().parent)
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    import merge_gate_evidence as evidence_mod
    import merge_gate_policy as gate
    import merge_gate_triage as triage_reader

    policy_doc = json.loads((REPO / ".github" / "merge-gate" / "policy.json").read_text())
    policy = gate.Policy.from_dict(policy_doc)
    outcomes: dict[str, dict] = {}
    verified: list = []
    for archive_path in sorted(artifacts_dir.glob("*/*/*.zip")):
        name = archive_path.parent.name
        # As the gate does: only evidence and verify artifacts, only the files it reads.
        wanted = "verify.json" if name.startswith(evidence_mod.VERIFY_PREFIX) else "outcome.json" if name.startswith(evidence_mod.EVIDENCE_PREFIX) else None
        if not wanted:
            continue
        with evidence_mod.read_zip(archive_path.read_bytes()) as archive:
            for member in archive.infolist():
                if not member.filename.endswith(wanted):
                    continue
                data = json.loads(evidence_mod.member_bytes(archive, member, evidence_mod.MAX_MEMBER_BYTES))
                if wanted == "verify.json":
                    verified += evidence_mod.verified_tests(data)
                else:
                    outcomes[evidence_mod.ATTEMPT_SUFFIX.sub("", name[len(evidence_mod.EVIDENCE_PREFIX) :])] = data
    logs, failed = {}, []
    for index, (name, job) in enumerate(job_logs(stdout).items(), start=1):
        if job["result"] != "failure":
            continue
        outcome = outcomes.get(evidence_mod.job_slug(name)) or {}
        logs[index] = job["log"]
        failed.append(
            gate.FailedJob(
                name=name,
                conclusion="failure",
                failed_step=job["failed_step"],
                reason="\n".join(job["errors"]),
                outcome=outcome.get("classification"),
                failing_tests=tuple(test for test, _ in evidence_mod.failing_tests(outcome)),
                job_id=index,
            )
        )
    failed, readings = triage_reader.read_jobs(
        "local", "local", failed, policy, policy_doc, "",
        blind_retry_left=attempt < policy.max_attempts,
        env={**os.environ, "CI_AI_TRIAGE_MODE": triage_mode},
        log_fetcher=lambda owner, repo, job_id, token: logs[job_id],
    )
    evidence = gate.Evidence(attempt=attempt, entry_age_minutes=0, failed_jobs=tuple(failed), verified=tuple(verified))
    decision = gate.decide(evidence, policy) if event == "merge_group" else gate.decide_pr(evidence, policy)
    return decision.as_dict(), readings


def print_gate(decision: dict, readings: list[dict], event: str) -> None:
    tier = "queue entry" if event == "merge_group" else "PR head"
    print(f"\nmerge gate ({tier}, decided locally with the gate's code): {decision['verdict'].upper()} — {decision['summary']}")
    for reason in decision.get("reasons") or []:
        print(f"  reason: {reason}")
    for key in ("forgiven", "blocking"):
        for item in decision.get(key) or []:
            print(f"  {key}: {json.dumps(item)}")
    if decision.get("rerunJobs"):
        print(f"  would re-run: {', '.join(decision['rerunJobs'])}")
    for reading in readings:
        extra = f" · ai: {reading['ai']['verdict']} ({reading['ai']['outcome']})" if reading.get("ai") else ""
        print(f"  log of {reading['job']}: {reading['signal'] or 'nothing recognised'} {reading['why']}{extra}")


def testcontainers_host() -> str:
    info = subprocess.run(["docker", "info", "--format", "{{.OperatingSystem}}"], capture_output=True, text=True)
    return "host.docker.internal" if "Docker Desktop" in info.stdout else "127.0.0.1"


def cmd_job(args: argparse.Namespace) -> int:
    act = act_binary()
    doc = load_workflow(args.workflows / args.workflow)
    unknown = {args.job, *args.real} - set(doc["jobs"])
    if unknown:
        sys.exit(f"{args.workflow} has no job {', '.join(sorted(unknown))}; jobs: {', '.join(doc['jobs'])}")
    ensure_image(args.image)
    work = Path(tempfile.mkdtemp(prefix="ci-local-job-"))
    print(f"copying the working tree to {work} …", flush=True)
    base, entry = copy_tree(work, args.workflows, args.inject_base, args.inject_entry)
    payload = {"pull_request": pr_event(), "merge_group": queue_event()}.get(args.event, {"inputs": {}})
    if args.event == "merge_group":
        # The entry's diff is exactly this working tree's change set.
        payload["merge_group"].update(base_sha=base, head_sha=entry)
    variables = {"CI_SHADOW_MQ_PERCENT": "100", "CI_SHADOW_PR_PERCENT": "100", **dict(v.split("=", 1) for v in args.var)}
    # The job, plan and --real jobs run as written; every other job the target needs is
    # a passing stub. Written outside .github/workflows, which tests read as committed.
    whole = frozenset({args.job, "plan", *args.real})
    pseudo = Scenario(f"job-{args.job}", "", args.event, payload, success=(), areas=FILTERS, workflow=args.workflow)
    workflow = work / ".ci-local" / args.workflow
    workflow.parent.mkdir()
    workflow.write_text(dump(stub_workflow(doc, pseudo, whole)))
    swapped = localize_artifact_actions(work)
    if swapped:
        print(f"artifact actions pinned to v4 for act in the scratch copy: {', '.join(swapped)}", flush=True)
    artifacts = work / ".ci-local-artifacts"
    extra = ["-j", args.job, "--bind", "--artifact-server-path", str(artifacts)]
    for leg in args.matrix:
        extra += ["--matrix", leg]
    if args.m2_volume:
        extra += ["--container-options", f"-v {args.m2_volume}:/root/.m2"]
    if args.offline:
        extra += ["--network", "none"]
    else:
        # Inside a job container Testcontainers would dial the network gateway. On Docker
        # Desktop only its own route reaches every published port (OpenSearch's is refused
        # on the VM's loopback); on a Linux daemon the loopback is right.
        extra += ["--env", f"TESTCONTAINERS_HOST_OVERRIDE={testcontainers_host()}"]
        # Ryuk, Testcontainers' reaper, never starts its server when launched from an act
        # job ("Timed out waiting for Ryuk", no logs). It only removes leftover containers;
        # the job's own shutdown stops them, so local runs go without it.
        extra += ["--env", "TESTCONTAINERS_RYUK_DISABLED=true"]
    for pair in args.env:
        extra += ["--env", pair]
    print(f"running {args.workflow} job {args.job} on {args.event} with act (real: {', '.join(sorted(whole))}) …", flush=True)
    process = run_act(act, work, args.event, workflow, payload, variables, args.image, extra=extra)
    jobs, _, _, lines = parse_log(process.stdout)
    stem = REPO / "target" / "ci-local" / f"{args.workflow.split('.')[0]}-{args.job}-{time.strftime('%Y%m%d-%H%M%S')}"
    log = stem.with_suffix(".log")
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text("\n".join(lines) + "\n" + process.stderr)
    stem.with_suffix(".jsonl").write_text(process.stdout)
    print("\n".join(lines[-args.tail :]))
    print("\njobs run (the asked-for job and the jobs it needs):")
    for job_id, results in jobs.items():
        print(f"  {job_id}: {'failure' if 'failure' in results else results[-1]}")
    result = "failure" if "failure" in jobs.get(args.job, []) else (jobs.get(args.job) or ["not run"])[-1]
    if args.workflow == "ci.yml" and args.event in ("merge_group", "pull_request"):
        decision, readings = local_gate(process.stdout, artifacts, args.event, args.attempt, args.triage)
        print_gate(decision, readings, args.event)
        stem.with_suffix(".gate.json").write_text(json.dumps({"decision": decision, "triage": readings}, indent=1, default=str))
    print(f"\n{args.job}: {result}; full log {log.relative_to(REPO)}; scratch {'kept at ' + str(work) if args.keep else 'removed'}")
    if not args.keep:
        shutil.rmtree(work, ignore_errors=True)
    return 0 if result == "success" else 1


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("scenarios", "job"):
        sub = commands.add_parser(name)
        sub.add_argument("--workflows", type=Path, default=REPO / ".github" / "workflows", help="directory holding the workflows under test")
        sub.add_argument("--keep", action="store_true", help="keep the scratch directory")
    scenarios = commands.choices["scenarios"]
    scenarios.add_argument("--only", type=lambda value: [v for v in value.split(",") if v], default=[])
    scenarios.add_argument("--parallel", type=int, default=3)
    scenarios.add_argument("--verbose", action="store_true", help="print act's log for a failing scenario")
    job = commands.choices["job"]
    job.add_argument("job")
    job.add_argument("--workflow", default="ci.yml")
    # merge_group by default: its path filter diffs commits with git, while a
    # pull_request filter asks the GitHub API for a real PR's files.
    job.add_argument("--event", choices=("pull_request", "merge_group", "workflow_dispatch"), default="merge_group")
    job.add_argument("--image", default=JOB_IMAGE)
    job.add_argument("--var", action="append", default=[], help="NAME=VALUE repository variable")
    job.add_argument("--real", action="append", default=[], help="another needed job to run as written (default: stubbed)")
    job.add_argument("--matrix", action="append", default=[], help="KEY:VALUE, runs only the matching matrix legs")
    job.add_argument("--inject-entry", type=Path, help="patch applied to the entry commit only (a regression it introduces)")
    job.add_argument("--inject-base", type=Path, help="patch applied to the base commit too (a failure already on main)")
    job.add_argument("--m2-volume", default=M2_VOLUME, help="Docker volume used as the containers' ~/.m2 ('' for none)")
    job.add_argument("--offline", action="store_true", help="no network in the job containers: a real network failure")
    job.add_argument("--env", action="append", default=[], help="NAME=VALUE for every job (e.g. MAVEN_OPTS=-Xmx3g)")
    job.add_argument("--attempt", type=int, default=1, help="the run attempt the local gate decision assumes")
    job.add_argument("--triage", choices=("off", "shadow", "on"), default="off", help="CI_AI_TRIAGE_MODE for the local gate decision")
    job.add_argument("--tail", type=int, default=60, help="log lines to print")
    commands.add_parser("list")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    return {"scenarios": cmd_scenarios, "job": cmd_job, "list": cmd_list}[args.command](args)


if __name__ == "__main__":
    raise SystemExit(main())
