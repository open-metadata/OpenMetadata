#!/usr/bin/env python3

import argparse
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


HUNK_PATTERN = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


@dataclass
class FileCoverage:
    path: str
    executable_lines: list[int]
    covered_lines: list[int]
    missed_lines: list[int]
    non_executable_lines: list[int]

    @property
    def executable_count(self) -> int:
        return len(self.executable_lines)

    @property
    def covered_count(self) -> int:
        return len(self.covered_lines)

    @property
    def missed_count(self) -> int:
        return len(self.missed_lines)

    @property
    def non_executable_count(self) -> int:
        return len(self.non_executable_lines)

    @property
    def coverage_pct(self) -> float | None:
        if not self.executable_count:
            return None
        return (self.covered_count / self.executable_count) * 100.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compute JaCoCo coverage for changed production lines in a PR diff."
    )
    parser.add_argument("--report", required=True, help="Path to jacoco.xml report")
    parser.add_argument(
        "--source-root",
        default="openmetadata-service/src/main/java",
        help="Source root to evaluate for changed production code",
    )
    parser.add_argument(
        "--base-ref",
        required=True,
        help="Git base ref/SHA. If --head-ref is omitted, compare working tree against this ref.",
    )
    parser.add_argument(
        "--head-ref",
        help="Git head ref/SHA. If set, diff is computed with base...head.",
    )
    parser.add_argument(
        "--minimum-coverage",
        type=float,
        default=90.0,
        help="Minimum required changed-line coverage percentage",
    )
    parser.add_argument(
        "--markdown-output",
        required=True,
        help="File to write the Markdown summary to",
    )
    return parser.parse_args()


def run_git_diff(base_ref: str, head_ref: str | None, source_root: str) -> str:
    cmd = ["git", "diff", "--unified=0", "--no-color"]
    if head_ref:
        cmd.append(f"{base_ref}...{head_ref}")
    else:
        cmd.append(base_ref)
    cmd.extend(["--", source_root])
    result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return result.stdout


def parse_changed_lines(diff_text: str) -> dict[str, set[int]]:
    changed_lines: dict[str, set[int]] = defaultdict(set)
    current_file: str | None = None
    current_line: int | None = None

    for line in diff_text.splitlines():
        if line.startswith("+++ "):
            file_path = line[4:]
            if file_path == "/dev/null":
                current_file = None
            elif file_path.startswith("b/"):
                current_file = file_path[2:]
            else:
                current_file = file_path
            current_line = None
            continue

        if line.startswith("@@ "):
            match = HUNK_PATTERN.match(line)
            current_line = int(match.group(1)) if match else None
            continue

        if current_file is None or current_line is None:
            continue

        if line.startswith("+") and not line.startswith("+++"):
            changed_lines[current_file].add(current_line)
            current_line += 1
        elif line.startswith("-") and not line.startswith("---"):
            continue
        elif line.startswith(" "):
            current_line += 1

    return changed_lines


def parse_jacoco_report(report_path: str, source_root: str) -> dict[str, dict[int, bool]]:
    root = ET.parse(report_path).getroot()
    normalized_root = PurePosixPath(source_root)
    coverage: dict[str, dict[int, bool]] = {}

    for package in root.findall("package"):
        package_name = package.attrib.get("name", "")
        package_root = normalized_root / package_name if package_name else normalized_root

        for sourcefile in package.findall("sourcefile"):
            file_path = (package_root / sourcefile.attrib["name"]).as_posix()
            line_coverage: dict[int, bool] = {}
            for line in sourcefile.findall("line"):
                line_number = int(line.attrib["nr"])
                line_coverage[line_number] = int(line.attrib["ci"]) > 0
            coverage[file_path] = line_coverage

    return coverage


def build_file_coverage(
    changed_lines: dict[str, set[int]], jacoco_coverage: dict[str, dict[int, bool]]
) -> list[FileCoverage]:
    files: list[FileCoverage] = []

    for file_path in sorted(changed_lines):
        line_map = jacoco_coverage.get(file_path, {})
        executable_lines = sorted(line for line in changed_lines[file_path] if line in line_map)
        covered_lines = sorted(line for line in executable_lines if line_map.get(line, False))
        missed_lines = sorted(line for line in executable_lines if not line_map.get(line, False))
        non_executable_lines = sorted(line for line in changed_lines[file_path] if line not in line_map)
        files.append(
            FileCoverage(
                path=file_path,
                executable_lines=executable_lines,
                covered_lines=covered_lines,
                missed_lines=missed_lines,
                non_executable_lines=non_executable_lines,
            )
        )

    files.sort(
        key=lambda item: (
            item.coverage_pct if item.coverage_pct is not None else 101.0,
            -item.missed_count,
            item.path,
        )
    )
    return files


def format_line_list(lines: list[int], limit: int = 12) -> str:
    if not lines:
        return "-"
    if len(lines) <= limit:
        return ", ".join(str(line) for line in lines)
    visible = ", ".join(str(line) for line in lines[:limit])
    return f"{visible}, +{len(lines) - limit} more"


def render_markdown(
    files: list[FileCoverage], minimum_coverage: float, source_root: str
) -> tuple[str, bool]:
    changed_files = len(files)
    executable_total = sum(item.executable_count for item in files)
    covered_total = sum(item.covered_count for item in files)
    missed_total = sum(item.missed_count for item in files)
    non_executable_total = sum(item.non_executable_count for item in files)
    overall_pct = (covered_total / executable_total * 100.0) if executable_total else 100.0

    failing_files = [
        item for item in files if item.coverage_pct is not None and item.coverage_pct < minimum_coverage
    ]
    should_fail = executable_total > 0 and (
        overall_pct < minimum_coverage or bool(failing_files)
    )
    status = "FAIL" if should_fail else "PASS"
    status_icon = "❌" if should_fail else "✅"

    lines: list[str] = []
    lines.append("## OpenMetadata Service New-Code Coverage")
    lines.append("")

    if changed_files == 0:
        lines.append(
            f"{status_icon} No changed production Java files under `{source_root}`. Coverage gate skipped."
        )
        return "\n".join(lines) + "\n", False

    lines.append(
        f"{status_icon} **{status}**. Required changed-line coverage: `{minimum_coverage:.2f}%` overall and per touched production file."
    )
    lines.append("")
    lines.append(
        f"- Overall executable changed lines: `{covered_total}/{executable_total}` covered (`{overall_pct:.2f}%`)"
    )
    lines.append(f"- Missed executable changed lines: `{missed_total}`")
    lines.append(f"- Non-executable changed lines ignored by JaCoCo: `{non_executable_total}`")
    lines.append(f"- Changed production files: `{changed_files}`")
    lines.append("")

    if executable_total == 0:
        lines.append(
            "All changed production lines are non-executable from JaCoCo's perspective. Gate passed."
        )
        lines.append("")
    elif failing_files:
        lines.append("Files below threshold:")
        for item in failing_files:
            lines.append(
                f"- `{item.path}`: `{item.covered_count}/{item.executable_count}` covered (`{item.coverage_pct:.2f}%`), uncovered lines `{format_line_list(item.missed_lines)}`"
            )
        lines.append("")

    lines.append("| File | Covered | Missed | Executable | Non-exec | Coverage | Uncovered lines |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: | --- |")
    for item in files:
        coverage_display = (
            f"{item.coverage_pct:.2f}%"
            if item.coverage_pct is not None
            else "N/A"
        )
        lines.append(
            f"| `{item.path}` | {item.covered_count} | {item.missed_count} | {item.executable_count} | {item.non_executable_count} | {coverage_display} | {format_line_list(item.missed_lines)} |"
        )

    lines.append("")
    lines.append(
        f"Only changed executable lines under `{source_root}` are counted. Test files, comments, imports, and non-executable lines are excluded."
    )
    return "\n".join(lines) + "\n", should_fail


def main() -> int:
    args = parse_args()

    diff_text = run_git_diff(args.base_ref, args.head_ref, args.source_root)
    changed_lines = parse_changed_lines(diff_text)
    jacoco_coverage = parse_jacoco_report(args.report, args.source_root)
    files = build_file_coverage(changed_lines, jacoco_coverage)
    markdown, should_fail = render_markdown(files, args.minimum_coverage, args.source_root)

    Path(args.markdown_output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.markdown_output).write_text(markdown, encoding="utf-8")

    if should_fail:
        print(markdown)
        return 1

    print(markdown)
    return 0


if __name__ == "__main__":
    sys.exit(main())
