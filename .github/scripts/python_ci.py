#!/usr/bin/env python3
"""Select Python CI work and validate the required check outcomes."""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTROL_PATHS = (
    ".github/workflows/ci-*.yml",
    ".github/workflows/backend-build-reusable.yml",
    ".github/workflows/python-unit-tests-reusable.yml",
    ".github/workflows/python-integration-tests-reusable.yml",
    ".github/workflows/py-tests*.yml",
    ".github/workflows/py-checkstyle.yml",
    ".github/workflows/py-sonarcloud-nightly.yml",
    ".github/workflows/populate-playwright-caches.yml",
    ".github/actions/setup-openmetadata-test-environment/**",
    ".github/actions/python-checkstyle/**",
    ".github/scripts/python_ci.py",
    ".github/scripts/tests/test_python_ci.py",
    ".github/scripts/tests/test_nox_cli.py",
    "Makefile",
)
TEST_PATHS = (
    "ingestion/**",
    "openmetadata-spec/**",
    ".github/workflows/py-cli-e2e-tests*.yml",
    "openmetadata-service/src/main/java/org/openmetadata/service/resources/**",
    "openmetadata-service/src/main/java/org/openmetadata/service/JsonPatchMessageBodyReader.java",
    "openmetadata-service/src/main/java/org/openmetadata/service/JsonPatchProvider.java",
    "openmetadata-service/src/main/java/org/openmetadata/service/ResourceRegistry.java",
)
STYLE_PATHS = ("ingestion/**", "openmetadata-airflow-apis/**", "openmetadata-spec/**")
FIELDS = ("run_style", "run_static", "run_unit", "run_integration", "prepare_spacy_model", "build_backend")
JOBS = {
    "static": "run_static",
    "unit": "run_unit",
    "integration": "run_integration",
    "prepare-spacy-model": "prepare_spacy_model",
    "backend": "build_backend",
}


def read_policy(root: Path = ROOT) -> dict:
    policy = json.loads((root / "ingestion/python-versions.json").read_text())
    versions = policy.get("tested")
    if (
        not isinstance(versions, list)
        or not versions
        or any(not isinstance(v, str) or not re.fullmatch(r"3\.\d+", v) for v in versions)
    ):
        raise ValueError("tested must contain Python major.minor versions")
    if versions != sorted(set(versions), key=lambda v: tuple(map(int, v.split(".")))):
        raise ValueError("tested must be unique and ordered")
    if policy.get("image") not in versions:
        raise ValueError("image Python must be tested")
    return {**policy, "minimum": versions[0]}


def check_policy(root: Path = ROOT) -> None:
    policy = read_policy(root)
    config = (root / "ingestion/pyproject.toml").read_text()
    minimum = re.escape(policy["minimum"])
    for pattern in (
        rf'^requires-python\s*=\s*">={minimum}"',
        rf'^pythonVersion\s*=\s*"{minimum}"',
        rf'^target-version\s*=\s*"py{policy["minimum"].replace(".", "")}"',
    ):
        if not re.search(pattern, config, re.MULTILINE):
            raise ValueError(f"Python minimum configuration drift: {pattern}")
    for name in (
        "ingestion/Dockerfile",
        "ingestion/Dockerfile.ci",
        "ingestion/operators/docker/Dockerfile",
        "ingestion/operators/docker/Dockerfile.ci",
    ):
        source = (root / name).read_text()
        versions = re.findall(r"^FROM .*?python[:]?([0-9]+\.[0-9]+)", source, re.MULTILINE)
        if versions != [policy["image"]]:
            raise ValueError(f"Image Python configuration drift: {name}")


def select_work(event: str, paths: list[str], policy: dict, *, full_matrix: bool = False) -> dict:
    if event not in {"pull_request_target", "merge_group", "schedule", "workflow_dispatch"}:
        raise ValueError(f"Unsupported event: {event}")
    if not isinstance(paths, list) or any(not isinstance(p, str) or not p for p in paths):
        raise ValueError("Changed paths must be a JSON list of nonempty strings")
    full = event in {"schedule", "workflow_dispatch"}
    controls = any(fnmatch.fnmatchcase(p, pattern) for p in paths for pattern in CONTROL_PATHS)
    tests = full or controls or any(fnmatch.fnmatchcase(p, pattern) for p in paths for pattern in TEST_PATHS)
    style = full or controls or any(fnmatch.fnmatchcase(p, pattern) for p in paths for pattern in STYLE_PATHS)
    return {
        "run_style": style,
        "run_static": tests,
        "run_unit": tests,
        "run_integration": tests,
        "prepare_spacy_model": tests,
        "build_backend": tests,
        "minimum": policy["minimum"],
        "image": policy["image"],
        "versions": policy["tested"] if event == "schedule" or full_matrix else [policy["image"]],
    }


def verify(needs: dict, check: str) -> None:
    changes = needs.get("changes", {})
    if changes.get("result") != "success":
        raise ValueError("Python selection did not succeed")
    outputs = changes.get("outputs", {})
    plan = json.loads(outputs.get("plan", "null"))
    if not isinstance(plan, dict) or any(type(plan.get(key)) is not bool for key in FIELDS):
        raise ValueError("Python selection is missing explicit boolean fields")
    if any(outputs.get(key) != json.dumps(plan[key]) for key in FIELDS):
        raise ValueError("Python selection outputs disagree with the plan")
    if plan["prepare_spacy_model"] != (plan["run_unit"] or plan["run_integration"]):
        raise ValueError("Inconsistent model selection")
    if plan["build_backend"] != plan["run_integration"]:
        raise ValueError("Inconsistent backend selection")
    if check == "tests":
        for name, field in JOBS.items():
            expected = "success" if plan[field] else "skipped"
            actual = needs.get(name, {}).get("result")
            if actual != expected:
                raise ValueError(f"{name}: expected {expected}, got {actual}")


def prepare_coverage(root: Path = ROOT) -> None:
    files = sorted((root / "ingestion/coverage-data").rglob(".coverage"))
    if not files:
        raise ValueError("No coverage data downloaded")
    for index, source in enumerate(files):
        source.rename(root / "ingestion" / f".coverage.ci-{index}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["policy", "plan", "check-policy", "verify", "prepare-coverage"])
    parser.add_argument("--event", default=os.environ.get("GITHUB_EVENT_NAME"))
    parser.add_argument("--full-matrix", action="store_true", help="Test every declared Python version")
    parser.add_argument("--check", choices=["tests", "style"], default="tests")
    args = parser.parse_args()
    if args.command == "prepare-coverage":
        prepare_coverage()
        return
    if args.command == "verify":
        verify(json.loads(os.environ["NEEDS_JSON"]), args.check)
        return
    if args.command == "check-policy":
        check_policy()
        return
    policy = read_policy()
    if args.command == "policy":
        result = policy
    else:
        paths = [] if args.event in {"schedule", "workflow_dispatch"} else json.loads(os.environ["CHANGED_FILES"])
        result = select_work(args.event, paths, policy, full_matrix=args.full_matrix)
    sys.stdout.write(json.dumps(result) + "\n")
    if output := os.environ.get("GITHUB_OUTPUT"):
        with Path(output).open("a", encoding="utf-8") as stream:
            stream.write(f"plan={json.dumps(result, separators=(',', ':'))}\n")
            for key, value in result.items():
                encoded = value if isinstance(value, str) else json.dumps(value, separators=(",", ":"))
                stream.write(f"{key}={encoded}\n")


if __name__ == "__main__":
    main()
