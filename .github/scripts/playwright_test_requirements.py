"""Read test requirements from Playwright's native collection report."""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

SECRET_TAG = "requires-secrets"
UI_ROOT = Path("openmetadata-ui/src/main/resources/ui")


def reported_specs(report: dict, test_dir: str = "playwright/e2e"):
    def visit(suite, owner_file=""):
        file = owner_file or suite.get("file", "")
        file = file.replace("\\", "/")
        for spec in suite.get("specs", []):
            source = (file or spec.get("file", "")).replace("\\", "/")
            if "/playwright/" in source:
                source = "playwright/" + source.split("/playwright/", 1)[1]
            elif not source.startswith("playwright/"):
                source = f"{test_dir}/{source}"
            yield source, spec
        for child in suite.get("suites", []):
            yield from visit(child, file)

    for suite in report.get("suites", []):
        yield from visit(suite)


def requirements(reports: list[dict]) -> tuple[set[str], set[str]]:
    public, secret = set(), set()
    for report in reports:
        if report.get("errors"):
            raise ValueError("Playwright collection reported errors")
        root = report.get("config", {}).get("rootDir", "").replace("\\", "/")
        test_dir = (
            "playwright/" + root.split("/playwright/", 1)[1]
            if "/playwright/" in root
            else "playwright/e2e"
        )
        for file, spec in reported_specs(report, test_dir):
            if spec.get("tests"):
                tags = {tag.lstrip("@") for tag in spec.get("tags", [])}
                (secret if SECRET_TAG in tags else public).add(file)
    return public, secret


def collect_requirements(specs: list[str], repo: Path) -> list[dict]:
    groups: dict[str, list[str]] = {}
    for spec in specs:
        if spec.startswith("playwright/helper-tests/"):
            config = "playwright/helper-tests.config.ts"
        elif spec.startswith("playwright/browser-tests/"):
            config = "playwright/browser-helper-tests.config.ts"
        else:
            config = "playwright.config.ts"
        groups.setdefault(config, []).append(spec)
    reports = []
    for config, files in groups.items():
        result = subprocess.run(
            [
                "yarn",
                "-s",
                "playwright",
                "test",
                "--list",
                "--reporter=json",
                f"--config={config}",
                *[re.escape(file) for file in files],
            ],
            cwd=repo / UI_ROOT,
            env={
                **os.environ,
                "PLAYWRIGHT_COLLECT_REQUIREMENTS": "true",
                "PLAYWRIGHT_SKIP_REQUIRES_SECRETS": "false",
                "PLAYWRIGHT_RUN_CHANGED_NIGHTLY": "true",
                "PLAYWRIGHT_IS_OSS": "true",
                "PW_PROTOCOL": "h2",
            },
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode:
            raise ValueError(
                f"Playwright collection failed for {config}: {result.stderr.strip()}"
            )
        reports.append(json.loads(result.stdout))
    return reports
