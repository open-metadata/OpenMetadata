#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Generate a one-line CSV summary from Snyk JSON reports.
"""

import argparse
import csv
import glob
import json
import os
import re
from collections.abc import Iterable
from typing import Any

DEFAULT_INPUT_FOLDER = "security-report"
DEFAULT_OUTPUT_FILE = "security-report/vulnerability_one_line_findings.csv"
FIELD_NAMES = [
    "severity",
    "report_file",
    "module",
    "package_manager",
    "vulnerability",
    "cwe",
    "location",
    "manifest",
    "introduced_through",
    "reason",
]
SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def normalize(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, list):
        return ", ".join(normalize(item) for item in value if normalize(item))

    return re.sub(r"\s+", " ", str(value)).strip()


def severity_label(value: Any) -> str:
    severity = normalize(value).lower()
    return severity.capitalize() if severity else ""


def first_value(*values: Any) -> str:
    for value in values:
        normalized_value = normalize(value)
        if normalized_value:
            return normalized_value

    return ""


def dict_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def path_value(*values: Any) -> str:
    path_parts = [normalize(value) for value in values if normalize(value)]
    return " > ".join(path_parts)


def introduced_through(vulnerability: dict[str, Any]) -> str:
    dependency_paths = vulnerability.get("from") or vulnerability.get("upgradePath") or []

    if isinstance(dependency_paths, list):
        return " and ".join(normalize(path) for path in dependency_paths if normalize(path))

    return normalize(dependency_paths)


def cwe_value(vulnerability: dict[str, Any]) -> str:
    identifiers = vulnerability.get("identifiers") or {}
    return first_value(
        identifiers.get("CWE"),
        identifiers.get("CWE-ID"),
        vulnerability.get("cwe"),
        vulnerability.get("cwes"),
    )


def dependency_rows(
    report_file: str, report: dict[str, Any]
) -> Iterable[dict[str, str]]:
    vulnerabilities = report.get("vulnerabilities") or report.get("issues") or []
    if not isinstance(vulnerabilities, list):
        return

    manifest = path_value(
        report.get("projectName") or report.get("displayTargetFile"),
        report.get("targetFile") or report.get("path"),
    )

    for vulnerability in vulnerabilities:
        if not isinstance(vulnerability, dict):
            continue

        yield {
            "severity": severity_label(vulnerability.get("severity")),
            "report_file": report_file,
            "module": first_value(
                vulnerability.get("packageName"),
                vulnerability.get("name"),
                vulnerability.get("moduleName"),
            ),
            "package_manager": first_value(
                vulnerability.get("packageManager"), report.get("packageManager")
            ),
            "vulnerability": first_value(
                vulnerability.get("title"),
                vulnerability.get("issueTitle"),
                vulnerability.get("id"),
            ),
            "cwe": cwe_value(vulnerability),
            "location": first_value(
                vulnerability.get("file"),
                vulnerability.get("filename"),
                vulnerability.get("filePath"),
            ),
            "manifest": manifest,
            "introduced_through": introduced_through(vulnerability),
            "reason": first_value(
                vulnerability.get("description"),
                vulnerability.get("overview"),
                vulnerability.get("message"),
            ),
        }


def code_rule_lookup(run: dict[str, Any]) -> dict[str, dict[str, Any]]:
    tool = dict_value(run.get("tool"))
    driver = dict_value(tool.get("driver"))
    rules = driver.get("rules") or []

    if not isinstance(rules, list):
        return {}

    return {normalize(rule.get("id")): rule for rule in rules if isinstance(rule, dict)}


def code_location(result: dict[str, Any]) -> str:
    locations = result.get("locations") or []
    if not locations or not isinstance(locations, list):
        return ""

    physical_location = dict_value(dict_value(locations[0]).get("physicalLocation"))
    artifact_location = dict_value(physical_location.get("artifactLocation"))
    region = dict_value(physical_location.get("region"))
    file_path = normalize(artifact_location.get("uri"))
    line = normalize(region.get("startLine"))

    return f"{file_path}:{line}" if file_path and line else file_path


def code_cwe(result: dict[str, Any], rule: dict[str, Any]) -> str:
    properties = dict_value(result.get("properties"))
    rule_properties = dict_value(rule.get("properties"))

    return first_value(
        properties.get("cwe"),
        properties.get("cwes"),
        rule_properties.get("cwe"),
        rule_properties.get("cwes"),
        rule_properties.get("tags"),
    )


def code_rows(report_file: str, report: dict[str, Any]) -> Iterable[dict[str, str]]:
    runs = report.get("runs") or []
    if not isinstance(runs, list):
        return

    for run in runs:
        if not isinstance(run, dict):
            continue

        rules = code_rule_lookup(run)
        results = run.get("results") or []
        if not isinstance(results, list):
            continue

        for result in results:
            if not isinstance(result, dict):
                continue

            rule_id = normalize(result.get("ruleId"))
            rule = rules.get(rule_id, {})
            message = dict_value(result.get("message"))
            short_description = dict_value(rule.get("shortDescription"))

            yield {
                "severity": severity_label(
                    first_value(
                        dict_value(result.get("properties")).get("severity"),
                        result.get("level"),
                    )
                ),
                "report_file": report_file,
                "module": rule_id,
                "package_manager": "snyk-code",
                "vulnerability": first_value(
                    short_description.get("text"), result.get("ruleId")
                ),
                "cwe": code_cwe(result, rule),
                "location": code_location(result),
                "manifest": "",
                "introduced_through": "",
                "reason": first_value(message.get("text"), result.get("message")),
            }


def report_rows(report_path: str) -> Iterable[dict[str, str]]:
    report_file = f"{os.path.basename(report_path)}.pdf"

    with open(report_path, encoding="utf-8") as file:
        report = json.load(file)

    reports = report if isinstance(report, list) else [report]
    for item in reports:
        if not isinstance(item, dict):
            continue

        yield from dependency_rows(report_file, item)
        yield from code_rows(report_file, item)


def sort_key(row: dict[str, str]) -> tuple[int, str, str, str]:
    return (
        SEVERITY_ORDER.get(row["severity"].lower(), 4),
        row["report_file"],
        row["module"],
        row["vulnerability"],
    )


def generate_csv(input_folder: str, output_file: str) -> None:
    rows = []
    for report_path in sorted(glob.glob(os.path.join(input_folder, "*.json"))):
        rows.extend(report_rows(report_path))

    output_folder = os.path.dirname(output_file)
    if output_folder:
        os.makedirs(output_folder, exist_ok=True)
    with open(output_file, "w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FIELD_NAMES)
        writer.writeheader()
        writer.writerows(sorted(rows, key=sort_key))

    print(f"Generated {output_file} with {len(rows)} findings.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-folder", default=DEFAULT_INPUT_FOLDER)
    parser.add_argument("--output-file", default=DEFAULT_OUTPUT_FILE)

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    generate_csv(args.input_folder, args.output_file)


if __name__ == "__main__":
    main()
