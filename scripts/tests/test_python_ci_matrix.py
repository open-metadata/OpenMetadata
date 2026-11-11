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

"""Behavior checks for Python CI interpreter selection and required-job results."""

import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/prepare_classification_models.py"
WORKFLOW = ROOT / ".github/workflows/py-tests-shared.yml"


def workflow_script(job, step, workflow=WORKFLOW):
    source = workflow.read_text().split(f"\n  {job}:\n", 1)[1]
    lines = source.splitlines()
    start = next(index for index, line in enumerate(lines) if line.strip() == step)
    start = next(index for index in range(start, len(lines)) if lines[index].strip() == "run: |") + 1
    end = start
    while end < len(lines) and (not lines[end].strip() or lines[end].startswith("          ")):
        end += 1
    return textwrap.dedent("\n".join(lines[start:end]))


class PythonTestMatrixTest(unittest.TestCase):
    def plan(self, versions, full_suite=False, event="pull_request"):
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory)
            (project / "pyproject.toml").write_text(
                "[tool.openmetadata.python-environments]\nsupported-python = " + json.dumps(versions) + "\n"
            )
            result = subprocess.run(
                [sys.executable, "-I", "-S", str(SCRIPT), "test-matrix", "--project", directory, "--event", event]
                + (["--full-suite"] if full_suite else []),
                capture_output=True,
                text=True,
                check=False,
                timeout=10,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_pr_runs_units_on_highest_and_static_on_lowest(self):
        self.assertEqual(
            self.plan(["3.10", "3.11", "3.12"]),
            {
                "versions": ["3.12"],
                "run-integration": False,
                "static-version": "3.10",
                "coverage-version": "3.12",
            },
        )

    def test_nightly_retains_full_matrix_and_combines_same_version_coverage(self):
        self.assertEqual(
            self.plan(["3.10", "3.11", "3.12"], event="schedule"),
            {
                "versions": ["3.10", "3.11", "3.12"],
                "run-integration": True,
                "static-version": "3.10",
                "coverage-version": "3.10",
            },
        )

    def test_merge_queue_runs_unit_and_integration_on_highest_and_static_on_lowest(self):
        self.assertEqual(
            self.plan(["3.10", "3.11", "3.12"], event="merge_group"),
            {
                "versions": ["3.12"],
                "run-integration": True,
                "static-version": "3.10",
                "coverage-version": "3.12",
            },
        )

    def test_support_changes_use_numeric_order_without_relying_on_list_order(self):
        plan = self.plan(["3.14", "3.9", "3.11"])
        self.assertEqual(plan["versions"], ["3.14"])
        self.assertEqual(plan["static-version"], "3.9")
        self.assertEqual(plan["coverage-version"], "3.14")

    def test_single_supported_version(self):
        for full_suite in (False, True):
            with self.subTest(full_suite=full_suite):
                plan = self.plan(["3.12"], full_suite, event="workflow_dispatch")
                self.assertEqual(plan["versions"], ["3.12"])
                self.assertEqual(plan["static-version"], "3.12")
                self.assertEqual(plan["coverage-version"], "3.12")

    def test_matrix_step_exports_usable_job_outputs(self):
        script = workflow_script("changes", "- id: matrix", ROOT / ".github/workflows/py-tests.yml")
        cases = (
            ("pull_request", "false", ["3.12"], "false"),
            ("pull_request", "true", ["3.12"], "false"),
            ("merge_group", "false", ["3.12"], "true"),
            ("schedule", "false", ["3.10", "3.11", "3.12"], "true"),
            ("workflow_dispatch", "true", ["3.10", "3.11", "3.12"], "true"),
            ("workflow_dispatch", "false", ["3.12"], "true"),
        )
        for event, full_suite, expected, integration in cases:
            with self.subTest(event=event, full_suite=full_suite), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "scripts").symlink_to(SCRIPT.parent, target_is_directory=True)
                project = root / "ingestion"
                project.mkdir()
                (project / "pyproject.toml").write_text(
                    '[tool.openmetadata.python-environments]\nsupported-python = ["3.10", "3.11", "3.12"]\n'
                )
                output = root / "outputs"
                result = subprocess.run(
                    ["bash", "-e", "-o", "pipefail", "-c", script],
                    cwd=root,
                    env={**os.environ, "CI_EVENT": event, "FULL_SUITE": full_suite, "GITHUB_OUTPUT": str(output)},
                    capture_output=True,
                    text=True,
                    timeout=10,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                values = dict(line.split("=", 1) for line in output.read_text().splitlines())
                self.assertEqual(json.loads(values["versions"]), expected)
                self.assertEqual(values["static-version"], "3.10")
                self.assertEqual(values["run-integration"], integration)

    def test_required_status_rejects_failed_or_missing_static_checks(self):
        script = workflow_script("verify", "- name: Verify all expected Python jobs completed")
        base = {
            "RUN_INTEGRATION": "false",
            "BUILD_RESULT": "skipped",
            "UNIT_RESULT": "success",
            "STATIC_RESULT": "success",
            "INTEGRATION_RESULT": "skipped",
        }
        cases = [
            ({}, 0),
            ({"STATIC_RESULT": "failure"}, 1),
            ({"STATIC_RESULT": "skipped"}, 1),
            ({"UNIT_RESULT": "failure"}, 1),
            ({"RUN_INTEGRATION": "true", "BUILD_RESULT": "success", "INTEGRATION_RESULT": "success"}, 0),
            ({"RUN_INTEGRATION": "true"}, 1),
            ({"RUN_INTEGRATION": "true", "BUILD_RESULT": "success", "INTEGRATION_RESULT": "failure"}, 1),
            ({"UNIT_RESULT": "skipped", "STATIC_RESULT": "skipped"}, 1),
        ]
        for changes, expected in cases:
            with self.subTest(changes=changes):
                result = subprocess.run(
                    ["bash", "-e", "-c", script],
                    env={**os.environ, **base, **changes},
                    capture_output=True,
                    text=True,
                    timeout=10,
                    check=False,
                )
                self.assertEqual(result.returncode, expected, result.stdout + result.stderr)

    def test_entrypoint_status_requires_preparation_and_selected_pipeline(self):
        script = workflow_script(
            "py-tests-status", "- name: Verify the selected Python pipeline succeeded", ROOT / ".github/workflows/py-tests.yml"
        )
        base = {
            "CHANGES_RESULT": "success",
            "PYTHON_CHANGED": "true",
            "MODELS_RESULT": "success",
            "PIPELINE_RESULT": "success",
        }
        cases = (
            ({}, 0),
            ({"MODELS_RESULT": "failure"}, 1),
            ({"MODELS_RESULT": "skipped"}, 1),
            ({"PIPELINE_RESULT": "failure"}, 1),
            ({"PIPELINE_RESULT": "skipped"}, 1),
            ({"CHANGES_RESULT": "failure"}, 1),
            ({"PYTHON_CHANGED": "false", "MODELS_RESULT": "skipped", "PIPELINE_RESULT": "skipped"}, 0),
            ({"PYTHON_CHANGED": "false"}, 1),
            ({"PYTHON_CHANGED": ""}, 1),
        )
        for changes, expected in cases:
            with self.subTest(changes=changes):
                result = subprocess.run(
                    ["bash", "-e", "-c", script],
                    env={**os.environ, **base, **changes},
                    capture_output=True,
                    text=True,
                    timeout=10,
                    check=False,
                )
                self.assertEqual(result.returncode, expected, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
